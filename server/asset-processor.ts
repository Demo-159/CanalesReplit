import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import type { PreparedAsset } from "@shared/schema";
import { storage } from "./storage";

const ASSETS_DIR = process.env.NODE_ENV === "production" 
  ? "/app/prepared_assets" 
  : path.join(process.cwd(), "prepared_assets");

try {
  if (!fs.existsSync(ASSETS_DIR)) {
    fs.mkdirSync(ASSETS_DIR, { recursive: true, mode: 0o755 });
    console.log(`Created assets directory: ${ASSETS_DIR}`);
  }
} catch (err) {
  console.error(`Error creating assets directory: ${err}`);
}

interface ProcessingJob {
  assetId: string;
  abortController: AbortController;
}

const processingJobs: Map<string, ProcessingJob> = new Map();

export function getAssetDir(assetId: string): string {
  return path.join(ASSETS_DIR, assetId);
}

export function getAssetPlaylistPath(assetId: string): string {
  return path.join(getAssetDir(assetId), "playlist.m3u8");
}

function ensureAssetDir(assetId: string): string {
  const assetDir = getAssetDir(assetId);
  if (!fs.existsSync(assetDir)) {
    fs.mkdirSync(assetDir, { recursive: true });
  }
  return assetDir;
}

function cleanupAssetDir(assetId: string): void {
  const assetDir = getAssetDir(assetId);
  if (fs.existsSync(assetDir)) {
    try {
      fs.rmSync(assetDir, { recursive: true, force: true });
    } catch (e) {
      console.error(`Error cleaning up asset dir ${assetId}:`, e);
    }
  }
}

function calculateDirSize(dirPath: string): number {
  let totalSize = 0;
  try {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
      if (stats.isFile()) {
        totalSize += stats.size;
      }
    }
  } catch (e) {
    // Ignore errors
  }
  return totalSize;
}

function countSegments(assetDir: string): number {
  try {
    const files = fs.readdirSync(assetDir);
    return files.filter(f => f.endsWith(".ts")).length;
  } catch {
    return 0;
  }
}

function getVideoDuration(videoUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const ffprobe = spawn("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      videoUrl,
    ]);

    let output = "";
    ffprobe.stdout.on("data", (data) => {
      output += data.toString();
    });

    ffprobe.on("close", (code) => {
      if (code === 0) {
        const duration = parseFloat(output.trim());
        resolve(isNaN(duration) ? 0 : Math.round(duration));
      } else {
        resolve(0);
      }
    });

    ffprobe.on("error", () => {
      resolve(0);
    });
  });
}

export async function processAsset(assetId: string): Promise<boolean> {
  const asset = await storage.getPreparedAsset(assetId);
  if (!asset) {
    console.error(`[Asset ${assetId}] Not found`);
    return false;
  }

  if (processingJobs.has(assetId)) {
    console.log(`[Asset ${assetId}] Already processing`);
    return false;
  }

  console.log(`[Asset ${assetId}] Starting processing: ${asset.sourceUrl}`);
  
  await storage.updatePreparedAssetStatus(assetId, "processing");
  
  const assetDir = ensureAssetDir(assetId);
  const playlistPath = path.join(assetDir, "playlist.m3u8");
  
  const abortController = new AbortController();
  processingJobs.set(assetId, { assetId, abortController });

  try {
    const duration = await getVideoDuration(asset.sourceUrl);
    console.log(`[Asset ${assetId}] Video duration: ${duration}s`);

    const gopSize = asset.segmentDuration * 30;
    
    const ffmpegArgs = [
      "-hide_banner",
      "-loglevel", "warning",
      "-y",
      
      "-i", asset.sourceUrl,
      
      "-c:v", "libx264",
      "-preset", "fast",
      "-profile:v", "main",
      "-level", "4.0",
      "-pix_fmt", "yuv420p",
      "-g", gopSize.toString(),
      "-keyint_min", gopSize.toString(),
      "-force_key_frames", `expr:gte(t,n_forced*${asset.segmentDuration})`,
      "-sc_threshold", "0",
      "-b:v", "1500k",
      "-maxrate", "2000k",
      "-bufsize", "4000k",
      
      "-c:a", "aac",
      "-ar", "44100",
      "-b:a", "128k",
      "-ac", "2",
      
      "-f", "hls",
      "-hls_time", asset.segmentDuration.toString(),
      "-hls_list_size", "0",
      "-hls_playlist_type", "vod",
      "-hls_segment_type", "mpegts",
      "-hls_segment_filename", path.join(assetDir, "segment_%04d.ts"),
      playlistPath,
    ];

    console.log(`[Asset ${assetId}] Running FFmpeg...`);

    const ffmpeg = spawn("ffmpeg", ffmpegArgs);
    
    let lastError = "";
    
    ffmpeg.stderr?.on("data", (data) => {
      const message = data.toString().trim();
      if (message && !message.includes("deprecated")) {
        lastError = message;
      }
    });

    const success = await new Promise<boolean>((resolve) => {
      ffmpeg.on("close", (code) => {
        if (code === 0) {
          resolve(true);
        } else {
          console.error(`[Asset ${assetId}] FFmpeg exited with code ${code}: ${lastError}`);
          resolve(false);
        }
      });

      ffmpeg.on("error", (err) => {
        console.error(`[Asset ${assetId}] FFmpeg error: ${err.message}`);
        resolve(false);
      });
      
      abortController.signal.addEventListener("abort", () => {
        ffmpeg.kill("SIGKILL");
        resolve(false);
      });
    });

    processingJobs.delete(assetId);

    if (success && fs.existsSync(playlistPath)) {
      const segmentCount = countSegments(assetDir);
      const totalSize = calculateDirSize(assetDir);
      
      await storage.updatePreparedAssetStatus(assetId, "ready", {
        duration,
        segmentCount,
        totalSize,
      });
      
      console.log(`[Asset ${assetId}] Processing complete: ${segmentCount} segments, ${Math.round(totalSize / 1024 / 1024)}MB`);
      return true;
    } else {
      await storage.updatePreparedAssetStatus(assetId, "error", {
        errorMessage: lastError || "FFmpeg processing failed",
      });
      cleanupAssetDir(assetId);
      return false;
    }
  } catch (error: any) {
    console.error(`[Asset ${assetId}] Error:`, error);
    processingJobs.delete(assetId);
    await storage.updatePreparedAssetStatus(assetId, "error", {
      errorMessage: error.message || "Unknown error",
    });
    cleanupAssetDir(assetId);
    return false;
  }
}

export function cancelProcessing(assetId: string): boolean {
  const job = processingJobs.get(assetId);
  if (job) {
    job.abortController.abort();
    processingJobs.delete(assetId);
    console.log(`[Asset ${assetId}] Processing cancelled`);
    return true;
  }
  return false;
}

export function isProcessing(assetId: string): boolean {
  return processingJobs.has(assetId);
}

export async function deleteAsset(assetId: string): Promise<boolean> {
  cancelProcessing(assetId);
  cleanupAssetDir(assetId);
  return await storage.deletePreparedAsset(assetId);
}

export function getProcessingCount(): number {
  return processingJobs.size;
}
