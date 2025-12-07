import { spawn, ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";
import type { Channel, StreamingConfig } from "@shared/schema";

const STREAMS_DIR = process.env.NODE_ENV === "production" 
  ? "/app/streams" 
  : path.join(process.cwd(), "streams");

try {
  if (!fs.existsSync(STREAMS_DIR)) {
    fs.mkdirSync(STREAMS_DIR, { recursive: true, mode: 0o755 });
    console.log(`Created streams directory: ${STREAMS_DIR}`);
  }
} catch (err) {
  console.error(`Error creating streams directory: ${err}`);
}

interface StreamState {
  process: ChildProcess | null;
  channelId: string;
  videoUrls: string[];
  lastError: string | null;
  config: StreamingConfig;
  isActive: boolean;
}

const activeStreams: Map<string, StreamState> = new Map();

function ensureStreamsDir(channelId: string): string {
  const channelDir = path.join(STREAMS_DIR, channelId);
  if (!fs.existsSync(channelDir)) {
    fs.mkdirSync(channelDir, { recursive: true });
  }
  return channelDir;
}

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

function countSegmentsInPlaylist(playlistPath: string): number {
  try {
    if (!fs.existsSync(playlistPath)) return 0;
    const content = fs.readFileSync(playlistPath, "utf-8");
    const matches = content.match(/#EXTINF:/g);
    return matches ? matches.length : 0;
  } catch {
    return 0;
  }
}

function startInfiniteLoopFFmpeg(
  channelId: string,
  videoUrl: string,
  channelDir: string,
  config: StreamingConfig
): ChildProcess {
  const playlistPath = path.join(channelDir, "playlist.m3u8");
  
  const gopSize = config.segmentDuration * 30;
  const playlistSize = Math.max(config.playlistSize, 60);
  const deleteThreshold = Math.max(playlistSize + 30, 90);
  const bufferSize = config.videoBitrate * 8;
  
  const ffmpegArgs = [
    "-hide_banner",
    "-loglevel", "warning",
    
    // Input options - NO -re flag so segments are generated faster than realtime
    "-fflags", "+genpts+igndts+discardcorrupt",
    "-stream_loop", "-1",
    "-reconnect", "1",
    "-reconnect_streamed", "1",
    "-reconnect_delay_max", "5",
    "-i", videoUrl,
    
    // Fix timestamp issues
    "-avoid_negative_ts", "make_zero",
    "-copyts",
    "-vsync", "cfr",
    "-async", "1",
    
    "-threads", config.threads.toString(),
    
    // Video encoding
    "-c:v", "libx264",
    "-preset", config.preset,
    "-profile:v", "main",
    "-level", "4.0",
    "-pix_fmt", "yuv420p",
    "-g", gopSize.toString(),
    "-keyint_min", gopSize.toString(),
    "-force_key_frames", `expr:gte(t,n_forced*${config.segmentDuration})`,
    "-sc_threshold", "0",
    "-b:v", `${config.videoBitrate}k`,
    "-maxrate", `${Math.round(config.videoBitrate * 1.5)}k`,
    "-bufsize", `${bufferSize}k`,
    "-bf", "0",
    "-refs", "1",
    
    // Audio encoding
    "-c:a", "aac",
    "-ar", "44100",
    "-b:a", `${config.audioBitrate}k`,
    "-ac", "2",
    
    // HLS output - generate segments as fast as possible with large buffer
    "-f", "hls",
    "-hls_time", config.segmentDuration.toString(),
    "-hls_list_size", playlistSize.toString(),
    "-hls_delete_threshold", deleteThreshold.toString(),
    "-hls_flags", "delete_segments+omit_endlist+independent_segments+split_by_time",
    "-hls_segment_type", "mpegts",
    "-hls_segment_filename", path.join(channelDir, "segment_%d.ts"),
    playlistPath,
  ];

  console.log(`[Stream ${channelId}] INFINITE LOOP: playlist=${playlistSize}, deleteThreshold=${deleteThreshold}, buffer=${bufferSize}k, preset=${config.preset}`);

  return spawn("ffmpeg", ffmpegArgs, {
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export async function startStream(channel: Channel): Promise<boolean> {
  if (channel.videos.length === 0) {
    console.log(`[Stream ${channel.id}] Cannot start: no videos`);
    return false;
  }

  await stopStream(channel.id);

  const channelDir = ensureStreamsDir(channel.id);
  cleanupStream(channel.id);
  ensureStreamsDir(channel.id);
  
  const videoUrls = channel.videos
    .sort((a, b) => a.order - b.order)
    .map((v) => v.url);
  
  const primaryVideoUrl = videoUrls[0];

  console.log(`[Stream ${channel.id}] Starting INFINITE LOOP with video: ${primaryVideoUrl}`);

  try {
    const ffmpeg = startInfiniteLoopFFmpeg(channel.id, primaryVideoUrl, channelDir, channel.streamingConfig);
    
    const state: StreamState = {
      process: ffmpeg,
      channelId: channel.id,
      videoUrls,
      lastError: null,
      config: channel.streamingConfig,
      isActive: true,
    };

    activeStreams.set(channel.id, state);
    
    ffmpeg.stderr?.on("data", (data) => {
      const message = data.toString().trim();
      if (message && !message.includes("deprecated") && !message.includes("Discarded")) {
        console.error(`[Stream ${channel.id}] FFmpeg: ${message}`);
        state.lastError = message;
      }
    });

    ffmpeg.on("error", (err) => {
      console.error(`[Stream ${channel.id}] FFmpeg spawn error: ${err.message}`);
      state.lastError = `FFmpeg error: ${err.message}`;
      state.isActive = false;
    });

    ffmpeg.on("close", (code) => {
      console.log(`[Stream ${channel.id}] FFmpeg closed with code ${code}`);
      state.isActive = false;
      
      if (state.isActive && activeStreams.has(channel.id)) {
        console.log(`[Stream ${channel.id}] Unexpected close, restarting...`);
        setTimeout(() => {
          if (activeStreams.has(channel.id)) {
            startStream(channel);
          }
        }, 2000);
      }
    });
    
    const playlistPath = path.join(channelDir, "playlist.m3u8");
    const minSegments = 20; // More segments for better buffer
    let attempts = 0;
    const maxAttempts = 120; // More time to build buffer
    
    console.log(`[Stream ${channel.id}] Waiting for ${minSegments} segments (~${minSegments * channel.streamingConfig.segmentDuration}s buffer) before ready...`);
    
    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      const currentState = activeStreams.get(channel.id);
      if (!currentState || !currentState.isActive) {
        console.error(`[Stream ${channel.id}] Stream stopped during startup`);
        return false;
      }
      
      if (currentState.lastError && 
          (currentState.lastError.includes("No such file") || 
           currentState.lastError.includes("does not exist"))) {
        console.error(`[Stream ${channel.id}] Video URL error: ${currentState.lastError}`);
        await stopStream(channel.id);
        return false;
      }
      
      const segmentCount = countSegmentsInPlaylist(playlistPath);
      if (segmentCount >= minSegments) {
        console.log(`[Stream ${channel.id}] READY with ${segmentCount} segments (${segmentCount * channel.streamingConfig.segmentDuration}s buffer)`);
        return true;
      }
      
      if (attempts % 10 === 0 && segmentCount > 0) {
        console.log(`[Stream ${channel.id}] Building buffer: ${segmentCount}/${minSegments} segments...`);
      }
      
      attempts++;
    }
    
    const finalCount = countSegmentsInPlaylist(playlistPath);
    if (finalCount > 0) {
      console.log(`[Stream ${channel.id}] Timeout but has ${finalCount} segments, continuing...`);
      return true;
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
    state.isActive = false;
    
    if (state.process) {
      state.process.kill("SIGKILL");
    }
    
    activeStreams.delete(channelId);
    
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    cleanupStream(channelId);
    
    console.log(`[Stream ${channelId}] Stopped`);
  }
}

export function isStreamActive(channelId: string): boolean {
  const state = activeStreams.get(channelId);
  return state !== undefined && state.isActive;
}

export function getStreamStatus(channelId: string): { active: boolean; error: string | null } {
  const state = activeStreams.get(channelId);
  if (!state) {
    return { active: false, error: null };
  }
  return { active: state.isActive, error: state.lastError };
}

export function getStreamPath(channelId: string): string {
  return path.join(STREAMS_DIR, channelId);
}

const cleanup = async () => {
  console.log("Cleaning up streams...");
  for (const [channelId] of activeStreams) {
    await stopStream(channelId);
  }
  process.exit(0);
};

process.on("SIGTERM", cleanup);
process.on("SIGINT", cleanup);
