import { spawn, ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";
import type { Channel, StreamingConfig } from "@shared/schema";

const STREAMS_DIR = path.join(process.cwd(), "streams");

interface StreamState {
  process: ChildProcess | null;
  channelId: string;
  videoUrls: string[];
  currentVideoIndex: number;
  segmentCounter: number;
  shouldRestart: boolean;
  lastError: string | null;
  config: StreamingConfig;
}

// Active streaming states
const activeStreams: Map<string, StreamState> = new Map();

// Ensure streams directory exists
function ensureStreamsDir(channelId: string): string {
  const channelDir = path.join(STREAMS_DIR, channelId);
  if (!fs.existsSync(channelDir)) {
    fs.mkdirSync(channelDir, { recursive: true });
  }
  return channelDir;
}

// Clean up stream files
function cleanupStream(channelId: string): void {
  const channelDir = path.join(STREAMS_DIR, channelId);
  if (fs.existsSync(channelDir)) {
    try {
      const files = fs.readdirSync(channelDir);
      for (const file of files) {
        try {
          fs.unlinkSync(path.join(channelDir, file));
        } catch (e) {
          // Ignore file deletion errors
        }
      }
    } catch (e) {
      // Ignore directory read errors
    }
  }
}

// Get current segment number from existing files
function getNextSegmentNumber(channelDir: string): number {
  if (!fs.existsSync(channelDir)) {
    return 0;
  }
  
  const files = fs.readdirSync(channelDir);
  const segmentNumbers = files
    .filter(f => f.startsWith("segment_") && f.endsWith(".ts"))
    .map(f => {
      const match = f.match(/segment_(\d+)\.ts/);
      return match ? parseInt(match[1], 10) : 0;
    });
  
  if (segmentNumbers.length === 0) {
    return 0;
  }
  
  return Math.max(...segmentNumbers) + 1;
}

// Start FFmpeg for a single video with segment continuation
function startFFmpegProcess(
  channelId: string,
  videoUrl: string,
  channelDir: string,
  startNumber: number,
  config: StreamingConfig
): ChildProcess {
  const playlistPath = path.join(channelDir, "playlist.m3u8");
  
  // Calculate GOP size based on segment duration (assuming 30fps)
  const gopSize = config.segmentDuration * 30;
  
  // FFmpeg arguments for HLS output with segment continuation
  const ffmpegArgs = [
    "-hide_banner",
    "-loglevel", "error",
    "-threads", config.threads.toString(),
    "-thread_queue_size", "2048",
    "-re", // Real-time read
    "-i", videoUrl,
    "-c:v", "libx264",
    "-preset", config.preset,
    "-tune", "zerolatency",
    "-profile:v", "baseline",
    "-level", "3.0",
    "-pix_fmt", "yuv420p",
    "-g", gopSize.toString(),
    "-keyint_min", gopSize.toString(),
    "-sc_threshold", "0",
    "-b:v", `${config.videoBitrate}k`,
    "-maxrate", `${config.videoBitrate}k`,
    "-bufsize", `${config.videoBitrate * 2}k`,
    "-c:a", "aac",
    "-ar", "44100",
    "-b:a", `${config.audioBitrate}k`,
    "-ac", "2",
    "-f", "hls",
    "-hls_time", config.segmentDuration.toString(),
    "-hls_list_size", config.playlistSize.toString(),
    "-hls_delete_threshold", "2",
    "-start_number", startNumber.toString(),
    "-hls_flags", startNumber > 0 
      ? "append_list+delete_segments+omit_endlist+independent_segments" 
      : "delete_segments+omit_endlist+independent_segments",
    "-hls_segment_filename", path.join(channelDir, "segment_%d.ts"),
    playlistPath,
  ];

  return spawn("ffmpeg", ffmpegArgs, {
    stdio: ["ignore", "pipe", "pipe"],
  });
}

// Start the next video in the playlist
async function playNextVideo(state: StreamState): Promise<void> {
  if (!state.shouldRestart) {
    return;
  }

  const channelDir = ensureStreamsDir(state.channelId);
  
  // Get the next segment number to continue sequence
  const startNumber = getNextSegmentNumber(channelDir);
  state.segmentCounter = startNumber;
  
  const videoUrl = state.videoUrls[state.currentVideoIndex];
  console.log(`[Stream ${state.channelId}] Playing video ${state.currentVideoIndex + 1}/${state.videoUrls.length} starting at segment ${startNumber}: ${videoUrl}`);
  
  const ffmpeg = startFFmpegProcess(state.channelId, videoUrl, channelDir, startNumber, state.config);
  state.process = ffmpeg;
  state.lastError = null;

  let stderrBuffer = "";
  
  ffmpeg.stderr?.on("data", (data) => {
    stderrBuffer += data.toString();
    const message = data.toString().trim();
    if (message) {
      console.error(`[Stream ${state.channelId}] FFmpeg: ${message}`);
      state.lastError = message;
    }
  });

  ffmpeg.on("error", (err) => {
    console.error(`[Stream ${state.channelId}] FFmpeg error: ${err.message}`);
    state.lastError = err.message;
    
    // Try to continue with next video after a delay
    if (state.shouldRestart) {
      setTimeout(() => {
        state.currentVideoIndex = (state.currentVideoIndex + 1) % state.videoUrls.length;
        playNextVideo(state);
      }, 2000);
    }
  });

  ffmpeg.on("close", (code) => {
    console.log(`[Stream ${state.channelId}] Video finished with code ${code}`);
    
    if (!state.shouldRestart) {
      return;
    }

    // Move to next video (loop back to start if at end)
    state.currentVideoIndex = (state.currentVideoIndex + 1) % state.videoUrls.length;
    
    // Use configured transition delay before starting next video
    setTimeout(() => playNextVideo(state), state.config.transitionDelay);
  });

  // Update activeStreams with new process
  activeStreams.set(state.channelId, state);
}

export async function startStream(channel: Channel): Promise<boolean> {
  if (channel.videos.length === 0) {
    console.log(`[Stream ${channel.id}] Cannot start: no videos`);
    return false;
  }

  // Stop existing stream if any
  await stopStream(channel.id);

  const channelDir = ensureStreamsDir(channel.id);
  
  // Get video URLs in order
  const videoUrls = channel.videos
    .sort((a, b) => a.order - b.order)
    .map((v) => v.url);

  console.log(`[Stream ${channel.id}] Starting with ${videoUrls.length} video(s)`);

  try {
    // Create initial state with streaming config
    const state: StreamState = {
      process: null,
      channelId: channel.id,
      videoUrls,
      currentVideoIndex: 0,
      segmentCounter: 0,
      shouldRestart: true,
      lastError: null,
      config: channel.streamingConfig,
    };

    activeStreams.set(channel.id, state);
    
    // Start playing the first video
    await playNextVideo(state);
    
    // Wait for the playlist file to be created with content
    const playlistPath = path.join(channelDir, "playlist.m3u8");
    let attempts = 0;
    const maxAttempts = 40; // 20 seconds max wait
    
    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      // Check if stream is still active
      const currentState = activeStreams.get(channel.id);
      if (!currentState || !currentState.shouldRestart) {
        console.error(`[Stream ${channel.id}] Stream stopped during startup`);
        return false;
      }
      
      // Check for errors
      if (currentState.lastError && currentState.lastError.includes("No such file")) {
        console.error(`[Stream ${channel.id}] Video URL error: ${currentState.lastError}`);
        await stopStream(channel.id);
        return false;
      }
      
      // Check if playlist file exists with actual segments
      if (fs.existsSync(playlistPath)) {
        const content = fs.readFileSync(playlistPath, "utf-8");
        if (content.includes("#EXTINF") && content.includes(".ts")) {
          console.log(`[Stream ${channel.id}] Stream is ready`);
          return true;
        }
      }
      
      attempts++;
    }
    
    console.error(`[Stream ${channel.id}] Timeout waiting for stream to be ready`);
    await stopStream(channel.id);
    return false;
    
  } catch (error) {
    console.error(`[Stream ${channel.id}] Error starting stream:`, error);
    await stopStream(channel.id);
    return false;
  }
}

export async function stopStream(channelId: string): Promise<void> {
  const state = activeStreams.get(channelId);
  if (state) {
    // Prevent restart
    state.shouldRestart = false;
    
    // Kill the process
    if (state.process) {
      state.process.kill("SIGKILL");
    }
    
    activeStreams.delete(channelId);
    
    // Wait for process to terminate
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    // Clean up stream files
    cleanupStream(channelId);
    
    console.log(`[Stream ${channelId}] Stopped`);
  }
}

export function isStreamActive(channelId: string): boolean {
  const state = activeStreams.get(channelId);
  return state !== undefined && state.shouldRestart;
}

export function getStreamStatus(channelId: string): { active: boolean; error: string | null } {
  const state = activeStreams.get(channelId);
  if (!state) {
    return { active: false, error: null };
  }
  return { active: state.shouldRestart, error: state.lastError };
}

export function getStreamPath(channelId: string): string {
  return path.join(STREAMS_DIR, channelId);
}

// Clean up all streams on shutdown
const cleanup = async () => {
  console.log("Cleaning up streams...");
  for (const [channelId] of activeStreams) {
    await stopStream(channelId);
  }
  process.exit(0);
};

process.on("SIGTERM", cleanup);
process.on("SIGINT", cleanup);
