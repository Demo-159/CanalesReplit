import type { Channel, Video, InsertChannel, InsertVideo, ChannelStats, StreamingConfig, InsertStreamingConfig, PreparedAsset, InsertPreparedAsset, SystemMetrics, MaintenanceInfo, OrphanedResource, CleanupResult } from "@shared/schema";
import { channels, videos, preparedAssets } from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, count, sql, sum, isNull, notInArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import * as os from "os";
import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as path from "path";
import { execSync } from "child_process";

const PREPARED_ASSETS_DIR = process.env.NODE_ENV === "production"
  ? "/app/prepared_assets"
  : path.join(process.cwd(), "prepared_assets");

const STREAMS_DIR = path.join(process.cwd(), "streams");

export interface IStorage {
  // Channels
  getChannels(): Promise<Channel[]>;
  getChannel(id: string): Promise<Channel | undefined>;
  createChannel(data: InsertChannel): Promise<Channel>;
  updateChannel(id: string, data: InsertChannel): Promise<Channel | undefined>;
  deleteChannel(id: string): Promise<boolean>;
  updateChannelStatus(id: string, status: Channel["status"]): Promise<void>;
  updateStreamingConfig(id: string, config: InsertStreamingConfig): Promise<Channel | undefined>;
  
  // Videos
  addVideo(channelId: string, data: InsertVideo): Promise<Video | undefined>;
  addVideoFromAsset(channelId: string, assetId: string): Promise<Video | undefined>;
  deleteVideo(channelId: string, videoId: string): Promise<boolean>;
  reorderVideos(channelId: string, videoIds: string[]): Promise<void>;
  
  // Prepared Assets
  getPreparedAssets(): Promise<PreparedAsset[]>;
  getPreparedAsset(id: string): Promise<PreparedAsset | undefined>;
  createPreparedAsset(data: InsertPreparedAsset): Promise<PreparedAsset>;
  updatePreparedAssetStatus(id: string, status: PreparedAsset["status"], extra?: Partial<PreparedAsset>): Promise<void>;
  deletePreparedAsset(id: string): Promise<boolean>;
  
  // Stats & Metrics
  getStats(): Promise<ChannelStats>;
  getSystemMetrics(): Promise<SystemMetrics>;
  
  // Maintenance
  getMaintenanceInfo(): Promise<MaintenanceInfo>;
  cleanupOrphanedDiskAssets(): Promise<CleanupResult>;
  cleanupOrphanedDbAssets(): Promise<CleanupResult>;
  cleanupStaleStreams(): Promise<CleanupResult>;
  cleanupErrorAssets(): Promise<CleanupResult>;
  cleanupAll(): Promise<CleanupResult>;
  forceGarbageCollection(): Promise<{ success: boolean; memoryBefore: number; memoryAfter: number }>;
}

// Default streaming config - HYPER OPTIMIZED for zero stuttering, low CPU
const defaultStreamingConfig: StreamingConfig = {
  videoBitrate: 1200,
  audioBitrate: 96,
  preset: "ultrafast",
  segmentDuration: 6,
  playlistSize: 60,
  transitionDelay: 100,
  threads: 2,
};

// Helper to extract streaming config from db row
function extractStreamingConfig(ch: any): StreamingConfig {
  return {
    videoBitrate: ch.videoBitrate ?? defaultStreamingConfig.videoBitrate,
    audioBitrate: ch.audioBitrate ?? defaultStreamingConfig.audioBitrate,
    preset: ch.preset ?? defaultStreamingConfig.preset,
    segmentDuration: ch.segmentDuration ?? defaultStreamingConfig.segmentDuration,
    playlistSize: ch.playlistSize ?? defaultStreamingConfig.playlistSize,
    transitionDelay: ch.transitionDelay ?? defaultStreamingConfig.transitionDelay,
    threads: ch.threads ?? defaultStreamingConfig.threads,
  };
}

// DatabaseStorage implementation - javascript_database integration
export class DatabaseStorage implements IStorage {
  async getChannels(): Promise<Channel[]> {
    const dbChannels = await db.select().from(channels).orderBy(desc(channels.createdAt));
    
    const result: Channel[] = [];
    for (const ch of dbChannels) {
      const channelVideos = await db.select().from(videos)
        .where(eq(videos.channelId, ch.id))
        .orderBy(asc(videos.order));
      
      result.push({
        id: ch.id,
        name: ch.name,
        description: ch.description || "",
        status: ch.status as "idle" | "live" | "error",
        videos: channelVideos.map(v => ({
          id: v.id,
          url: v.url,
          title: v.title,
          duration: v.duration,
          order: v.order,
        })),
        createdAt: ch.createdAt.toISOString(),
        streamingConfig: extractStreamingConfig(ch),
      });
    }
    
    return result;
  }

  async getChannel(id: string): Promise<Channel | undefined> {
    const [ch] = await db.select().from(channels).where(eq(channels.id, id));
    if (!ch) return undefined;

    const channelVideos = await db.select().from(videos)
      .where(eq(videos.channelId, id))
      .orderBy(asc(videos.order));

    return {
      id: ch.id,
      name: ch.name,
      description: ch.description || "",
      status: ch.status as "idle" | "live" | "error",
      videos: channelVideos.map(v => ({
        id: v.id,
        url: v.url,
        title: v.title,
        duration: v.duration,
        order: v.order,
      })),
      createdAt: ch.createdAt.toISOString(),
      streamingConfig: extractStreamingConfig(ch),
    };
  }

  async createChannel(data: InsertChannel): Promise<Channel> {
    const id = randomUUID();
    const [created] = await db.insert(channels).values({
      id,
      name: data.name,
      description: data.description || "",
      status: "idle",
    }).returning();

    return {
      id: created.id,
      name: created.name,
      description: created.description || "",
      status: created.status as "idle" | "live" | "error",
      videos: [],
      createdAt: created.createdAt.toISOString(),
      streamingConfig: extractStreamingConfig(created),
    };
  }

  async updateChannel(id: string, data: InsertChannel): Promise<Channel | undefined> {
    const [updated] = await db.update(channels)
      .set({
        name: data.name,
        description: data.description || "",
      })
      .where(eq(channels.id, id))
      .returning();

    if (!updated) return undefined;

    const channelVideos = await db.select().from(videos)
      .where(eq(videos.channelId, id))
      .orderBy(asc(videos.order));

    return {
      id: updated.id,
      name: updated.name,
      description: updated.description || "",
      status: updated.status as "idle" | "live" | "error",
      videos: channelVideos.map(v => ({
        id: v.id,
        url: v.url,
        title: v.title,
        duration: v.duration,
        order: v.order,
      })),
      createdAt: updated.createdAt.toISOString(),
      streamingConfig: extractStreamingConfig(updated),
    };
  }

  async updateStreamingConfig(id: string, config: InsertStreamingConfig): Promise<Channel | undefined> {
    const [updated] = await db.update(channels)
      .set({
        videoBitrate: config.videoBitrate,
        audioBitrate: config.audioBitrate,
        preset: config.preset,
        segmentDuration: config.segmentDuration,
        playlistSize: config.playlistSize,
        transitionDelay: config.transitionDelay,
        threads: config.threads,
      })
      .where(eq(channels.id, id))
      .returning();

    if (!updated) return undefined;

    const channelVideos = await db.select().from(videos)
      .where(eq(videos.channelId, id))
      .orderBy(asc(videos.order));

    return {
      id: updated.id,
      name: updated.name,
      description: updated.description || "",
      status: updated.status as "idle" | "live" | "error",
      videos: channelVideos.map(v => ({
        id: v.id,
        url: v.url,
        title: v.title,
        duration: v.duration,
        order: v.order,
      })),
      createdAt: updated.createdAt.toISOString(),
      streamingConfig: extractStreamingConfig(updated),
    };
  }

  async deleteChannel(id: string): Promise<boolean> {
    const result = await db.delete(channels).where(eq(channels.id, id)).returning();
    return result.length > 0;
  }

  async updateChannelStatus(id: string, status: Channel["status"]): Promise<void> {
    await db.update(channels).set({ status }).where(eq(channels.id, id));
  }

  async addVideo(channelId: string, data: InsertVideo): Promise<Video | undefined> {
    const [ch] = await db.select().from(channels).where(eq(channels.id, channelId));
    if (!ch) return undefined;

    const existingVideos = await db.select().from(videos).where(eq(videos.channelId, channelId));
    const nextOrder = existingVideos.length;

    const id = randomUUID();
    const [created] = await db.insert(videos).values({
      id,
      channelId,
      url: data.url,
      title: data.title,
      duration: data.duration || 0,
      order: nextOrder,
    }).returning();

    return {
      id: created.id,
      url: created.url,
      title: created.title,
      duration: created.duration,
      order: created.order,
    };
  }

  async deleteVideo(channelId: string, videoId: string): Promise<boolean> {
    const result = await db.delete(videos)
      .where(eq(videos.id, videoId))
      .returning();
    
    if (result.length === 0) return false;

    // Reorder remaining videos
    const remainingVideos = await db.select().from(videos)
      .where(eq(videos.channelId, channelId))
      .orderBy(asc(videos.order));

    for (let i = 0; i < remainingVideos.length; i++) {
      await db.update(videos)
        .set({ order: i })
        .where(eq(videos.id, remainingVideos[i].id));
    }

    return true;
  }

  async reorderVideos(channelId: string, videoIds: string[]): Promise<void> {
    for (let i = 0; i < videoIds.length; i++) {
      await db.update(videos)
        .set({ order: i })
        .where(eq(videos.id, videoIds[i]));
    }
  }

  async getStats(): Promise<ChannelStats> {
    const [channelCount] = await db.select({ count: count() }).from(channels);
    const [liveCount] = await db.select({ count: count() }).from(channels).where(eq(channels.status, "live"));
    const [videoCount] = await db.select({ count: count() }).from(videos);
    const [assetCount] = await db.select({ count: count() }).from(preparedAssets);
    const [storageSum] = await db.select({ total: sql<number>`COALESCE(SUM(${preparedAssets.totalSize}), 0)` }).from(preparedAssets);

    return {
      totalChannels: channelCount?.count || 0,
      activeStreams: liveCount?.count || 0,
      totalVideos: videoCount?.count || 0,
      totalPreparedAssets: assetCount?.count || 0,
      totalStorageUsed: Number(storageSum?.total) || 0,
    };
  }

  async addVideoFromAsset(channelId: string, assetId: string): Promise<Video | undefined> {
    const [ch] = await db.select().from(channels).where(eq(channels.id, channelId));
    if (!ch) return undefined;

    const [asset] = await db.select().from(preparedAssets).where(eq(preparedAssets.id, assetId));
    if (!asset || asset.status !== "ready") return undefined;

    const existingVideos = await db.select().from(videos).where(eq(videos.channelId, channelId));
    const nextOrder = existingVideos.length;

    const id = randomUUID();
    const [created] = await db.insert(videos).values({
      id,
      channelId,
      url: asset.sourceUrl,
      title: asset.title,
      duration: asset.duration,
      order: nextOrder,
      preparedAssetId: assetId,
    }).returning();

    return {
      id: created.id,
      url: created.url,
      title: created.title,
      duration: created.duration,
      order: created.order,
      preparedAssetId: created.preparedAssetId,
    };
  }

  async getPreparedAssets(): Promise<PreparedAsset[]> {
    const assets = await db.select().from(preparedAssets).orderBy(desc(preparedAssets.createdAt));
    return assets.map(a => ({
      id: a.id,
      title: a.title,
      sourceUrl: a.sourceUrl,
      status: a.status as PreparedAsset["status"],
      duration: a.duration,
      segmentCount: a.segmentCount,
      segmentDuration: a.segmentDuration,
      totalSize: Number(a.totalSize),
      createdAt: a.createdAt.toISOString(),
      processedAt: a.processedAt?.toISOString() || null,
      errorMessage: a.errorMessage,
    }));
  }

  async getPreparedAsset(id: string): Promise<PreparedAsset | undefined> {
    const [a] = await db.select().from(preparedAssets).where(eq(preparedAssets.id, id));
    if (!a) return undefined;

    return {
      id: a.id,
      title: a.title,
      sourceUrl: a.sourceUrl,
      status: a.status as PreparedAsset["status"],
      duration: a.duration,
      segmentCount: a.segmentCount,
      segmentDuration: a.segmentDuration,
      totalSize: Number(a.totalSize),
      createdAt: a.createdAt.toISOString(),
      processedAt: a.processedAt?.toISOString() || null,
      errorMessage: a.errorMessage,
    };
  }

  async createPreparedAsset(data: InsertPreparedAsset): Promise<PreparedAsset> {
    const id = randomUUID();
    const [created] = await db.insert(preparedAssets).values({
      id,
      title: data.title,
      sourceUrl: data.sourceUrl,
      segmentDuration: data.segmentDuration || 4,
      status: "pending",
    }).returning();

    return {
      id: created.id,
      title: created.title,
      sourceUrl: created.sourceUrl,
      status: created.status as PreparedAsset["status"],
      duration: created.duration,
      segmentCount: created.segmentCount,
      segmentDuration: created.segmentDuration,
      totalSize: Number(created.totalSize),
      createdAt: created.createdAt.toISOString(),
      processedAt: created.processedAt?.toISOString() || null,
      errorMessage: created.errorMessage,
    };
  }

  async updatePreparedAssetStatus(id: string, status: PreparedAsset["status"], extra?: Partial<PreparedAsset>): Promise<void> {
    const updateData: any = { status };
    if (extra?.duration !== undefined) updateData.duration = extra.duration;
    if (extra?.segmentCount !== undefined) updateData.segmentCount = extra.segmentCount;
    if (extra?.totalSize !== undefined) updateData.totalSize = extra.totalSize;
    if (extra?.errorMessage !== undefined) updateData.errorMessage = extra.errorMessage;
    if (status === "ready" || status === "error") updateData.processedAt = new Date();

    await db.update(preparedAssets).set(updateData).where(eq(preparedAssets.id, id));
  }

  async deletePreparedAsset(id: string): Promise<boolean> {
    const result = await db.delete(preparedAssets).where(eq(preparedAssets.id, id)).returning();
    return result.length > 0;
  }

  async getSystemMetrics(): Promise<SystemMetrics> {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    let cpuUsage = 0;
    for (const cpu of cpus) {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      const idle = cpu.times.idle;
      cpuUsage += ((total - idle) / total) * 100;
    }
    cpuUsage = cpuUsage / cpus.length;

    let diskTotal = 0;
    let diskUsed = 0;
    let diskFree = 0;
    try {
      const dfOutput = execSync("df -B1 / | tail -1").toString().trim();
      const parts = dfOutput.split(/\s+/);
      if (parts.length >= 4) {
        diskTotal = parseInt(parts[1]) || 0;
        diskUsed = parseInt(parts[2]) || 0;
        diskFree = parseInt(parts[3]) || 0;
      }
    } catch (e) {
      // Fallback if df command fails
    }

    return {
      cpu: {
        usage: Math.round(cpuUsage * 100) / 100,
        cores: cpus.length,
      },
      memory: {
        total: totalMemory,
        used: usedMemory,
        free: freeMemory,
        usagePercent: Math.round((usedMemory / totalMemory) * 10000) / 100,
      },
      disk: {
        total: diskTotal,
        used: diskUsed,
        free: diskFree,
        usagePercent: diskTotal > 0 ? Math.round((diskUsed / diskTotal) * 10000) / 100 : 0,
      },
      uptime: os.uptime(),
    };
  }

  private async getDirSizeAsync(dirPath: string): Promise<number> {
    try {
      await fs.access(dirPath);
    } catch {
      return 0;
    }
    
    let totalSize = 0;
    try {
      const files = await fs.readdir(dirPath);
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stat = await fs.stat(filePath);
        if (stat.isDirectory()) {
          totalSize += await this.getDirSizeAsync(filePath);
        } else {
          totalSize += stat.size;
        }
      }
    } catch (e) {
      // Ignore errors
    }
    return totalSize;
  }

  private async pathExists(p: string): Promise<boolean> {
    try {
      await fs.access(p);
      return true;
    } catch {
      return false;
    }
  }

  async getMaintenanceInfo(): Promise<MaintenanceInfo> {
    const orphanedResources: OrphanedResource[] = [];
    
    // Get all asset IDs from database
    const dbAssets = await db.select({ id: preparedAssets.id, status: preparedAssets.status }).from(preparedAssets);
    const dbAssetIds = new Set(dbAssets.map(a => a.id));
    
    // Get assets referenced by videos (cannot be deleted)
    const referencedAssets = await db.select({ preparedAssetId: videos.preparedAssetId })
      .from(videos)
      .where(sql`${videos.preparedAssetId} IS NOT NULL`);
    const referencedAssetIds = new Set(referencedAssets.map(v => v.preparedAssetId).filter(Boolean));
    
    // Check for orphaned disk assets (on disk but not in DB)
    if (await this.pathExists(PREPARED_ASSETS_DIR)) {
      const diskDirs = await fs.readdir(PREPARED_ASSETS_DIR);
      for (const dir of diskDirs) {
        if (!dbAssetIds.has(dir)) {
          const dirPath = path.join(PREPARED_ASSETS_DIR, dir);
          const size = await this.getDirSizeAsync(dirPath);
          orphanedResources.push({
            type: "orphaned_disk_asset",
            id: dir,
            path: dirPath,
            size,
            reason: "Asset en disco sin registro en base de datos",
          });
        }
      }
    }
    
    // Check for orphaned DB assets (in DB but no files on disk, and not referenced by videos)
    for (const asset of dbAssets) {
      if (asset.status === "ready" && !referencedAssetIds.has(asset.id)) {
        const assetPath = path.join(PREPARED_ASSETS_DIR, asset.id);
        if (!(await this.pathExists(assetPath))) {
          orphanedResources.push({
            type: "orphaned_db_asset",
            id: asset.id,
            size: 0,
            reason: "Registro en DB pero archivos no existen en disco",
          });
        }
      }
    }
    
    // Check for error assets (only those not referenced by videos)
    const errorAssets = dbAssets.filter(a => a.status === "error" && !referencedAssetIds.has(a.id));
    for (const asset of errorAssets) {
      const assetPath = path.join(PREPARED_ASSETS_DIR, asset.id);
      const exists = await this.pathExists(assetPath);
      const size = exists ? await this.getDirSizeAsync(assetPath) : 0;
      orphanedResources.push({
        type: "error_asset",
        id: asset.id,
        path: assetPath,
        size,
        reason: "Asset con error de procesamiento",
      });
    }
    
    // Check for stale streams (stream dirs for channels not currently live)
    if (await this.pathExists(STREAMS_DIR)) {
      const streamDirs = await fs.readdir(STREAMS_DIR);
      const liveChannels = await db.select({ id: channels.id }).from(channels).where(eq(channels.status, "live"));
      const liveChannelIds = new Set(liveChannels.map(c => c.id));
      
      for (const dir of streamDirs) {
        if (!liveChannelIds.has(dir)) {
          const dirPath = path.join(STREAMS_DIR, dir);
          const size = await this.getDirSizeAsync(dirPath);
          if (size > 0) {
            orphanedResources.push({
              type: "stale_stream",
              id: dir,
              path: dirPath,
              size,
              reason: "Segmentos de stream de canal inactivo",
            });
          }
        }
      }
    }
    
    const totalReclaimableSize = orphanedResources.reduce((sum, r) => sum + r.size, 0);
    
    return {
      orphanedResources,
      totalReclaimableSize,
      errorAssetCount: orphanedResources.filter(r => r.type === "error_asset").length,
      staleStreamCount: orphanedResources.filter(r => r.type === "stale_stream").length,
      orphanedDiskAssetCount: orphanedResources.filter(r => r.type === "orphaned_disk_asset").length,
      orphanedDbAssetCount: orphanedResources.filter(r => r.type === "orphaned_db_asset").length,
    };
  }

  async cleanupOrphanedDiskAssets(): Promise<CleanupResult> {
    const errors: string[] = [];
    let deletedCount = 0;
    let reclaimedBytes = 0;
    
    if (!(await this.pathExists(PREPARED_ASSETS_DIR))) {
      return { success: true, deletedCount: 0, reclaimedBytes: 0, errors: [] };
    }
    
    // Also check if asset is currently being processed
    const { isProcessing: isAssetProcessing } = await import("./asset-processor");
    
    const dbAssets = await db.select({ id: preparedAssets.id }).from(preparedAssets);
    const dbAssetIds = new Set(dbAssets.map(a => a.id));
    
    const diskDirs = await fs.readdir(PREPARED_ASSETS_DIR);
    
    // Process concurrently with Promise.allSettled for better performance
    const cleanupPromises = diskDirs
      .filter(dir => !dbAssetIds.has(dir) && !isAssetProcessing(dir))
      .map(async (dir) => {
        const dirPath = path.join(PREPARED_ASSETS_DIR, dir);
        try {
          const size = await this.getDirSizeAsync(dirPath);
          await fs.rm(dirPath, { recursive: true, force: true });
          return { deleted: true, size, error: null };
        } catch (e: any) {
          return { deleted: false, size: 0, error: `Error eliminando ${dir}: ${e.message}` };
        }
      });
    
    const results = await Promise.allSettled(cleanupPromises);
    
    for (const result of results) {
      if (result.status === "fulfilled") {
        if (result.value.deleted) {
          deletedCount++;
          reclaimedBytes += result.value.size;
        }
        if (result.value.error) {
          errors.push(result.value.error);
        }
      }
    }
    
    return { success: errors.length === 0, deletedCount, reclaimedBytes, errors };
  }

  async cleanupOrphanedDbAssets(): Promise<CleanupResult> {
    const errors: string[] = [];
    let deletedCount = 0;
    
    // Get assets referenced by videos (cannot be deleted)
    const referencedAssets = await db.select({ preparedAssetId: videos.preparedAssetId })
      .from(videos)
      .where(sql`${videos.preparedAssetId} IS NOT NULL`);
    const referencedAssetIds = new Set(referencedAssets.map(v => v.preparedAssetId).filter(Boolean));
    
    const dbAssets = await db.select({ id: preparedAssets.id, status: preparedAssets.status }).from(preparedAssets);
    
    for (const asset of dbAssets) {
      // Only delete if ready, files missing, and not referenced by any video
      if (asset.status === "ready" && !referencedAssetIds.has(asset.id)) {
        const assetPath = path.join(PREPARED_ASSETS_DIR, asset.id);
        if (!(await this.pathExists(assetPath))) {
          try {
            await db.delete(preparedAssets).where(eq(preparedAssets.id, asset.id));
            deletedCount++;
          } catch (e: any) {
            errors.push(`Error eliminando registro ${asset.id}: ${e.message}`);
          }
        }
      }
    }
    
    return { success: errors.length === 0, deletedCount, reclaimedBytes: 0, errors };
  }

  private async getNewestFileTime(dirPath: string): Promise<number> {
    try {
      const files = await fs.readdir(dirPath);
      let newestTime = 0;
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        try {
          const stat = await fs.stat(filePath);
          if (stat.mtimeMs > newestTime) {
            newestTime = stat.mtimeMs;
          }
        } catch {
          // Ignore individual file errors
        }
      }
      
      return newestTime;
    } catch {
      return 0;
    }
  }

  async cleanupStaleStreams(): Promise<CleanupResult> {
    const errors: string[] = [];
    let deletedCount = 0;
    let reclaimedBytes = 0;
    
    if (!(await this.pathExists(STREAMS_DIR))) {
      return { success: true, deletedCount: 0, reclaimedBytes: 0, errors: [] };
    }
    
    // Import isStreamActive to check if FFmpeg is actually running
    const { isStreamActive } = await import("./streaming");
    
    // Only cleanup streams for channels that are NOT live (double-check DB status AND process status)
    const liveChannels = await db.select({ id: channels.id }).from(channels).where(eq(channels.status, "live"));
    const liveChannelIds = new Set(liveChannels.map(c => c.id));
    
    const streamDirs = await fs.readdir(STREAMS_DIR);
    const GRACE_PERIOD_MS = 120000; // 2 minute grace period (increased for safety)
    
    const cleanupPromises = streamDirs.map(async (dir) => {
      // Skip if channel is marked as live in DB
      if (liveChannelIds.has(dir)) {
        return { deleted: false, size: 0, error: null };
      }
      
      // Skip if stream process is actually running (double-check)
      if (isStreamActive(dir)) {
        return { deleted: false, size: 0, error: null };
      }
      
      const dirPath = path.join(STREAMS_DIR, dir);
      
      try {
        // Check the newest segment/playlist file time, not just directory mtime
        const newestFileTime = await this.getNewestFileTime(dirPath);
        const timeSinceNewestFile = Date.now() - newestFileTime;
        
        if (newestFileTime > 0 && timeSinceNewestFile < GRACE_PERIOD_MS) {
          // Files were modified recently, skip to avoid race condition
          return { deleted: false, size: 0, error: null };
        }
        
        const size = await this.getDirSizeAsync(dirPath);
        await fs.rm(dirPath, { recursive: true, force: true });
        return { deleted: true, size, error: null };
      } catch (e: any) {
        return { deleted: false, size: 0, error: `Error eliminando stream ${dir}: ${e.message}` };
      }
    });
    
    const results = await Promise.allSettled(cleanupPromises);
    
    for (const result of results) {
      if (result.status === "fulfilled") {
        if (result.value.deleted) {
          deletedCount++;
          reclaimedBytes += result.value.size;
        }
        if (result.value.error) {
          errors.push(result.value.error);
        }
      }
    }
    
    return { success: errors.length === 0, deletedCount, reclaimedBytes, errors };
  }

  async cleanupErrorAssets(): Promise<CleanupResult> {
    const errors: string[] = [];
    let deletedCount = 0;
    let reclaimedBytes = 0;
    
    // Get assets referenced by videos (cannot be deleted even if error status)
    const referencedAssets = await db.select({ preparedAssetId: videos.preparedAssetId })
      .from(videos)
      .where(sql`${videos.preparedAssetId} IS NOT NULL`);
    const referencedAssetIds = new Set(referencedAssets.map(v => v.preparedAssetId).filter(Boolean));
    
    const errorAssets = await db.select({ id: preparedAssets.id }).from(preparedAssets).where(eq(preparedAssets.status, "error"));
    
    for (const asset of errorAssets) {
      // Skip if referenced by a video
      if (referencedAssetIds.has(asset.id)) {
        continue;
      }
      
      try {
        const assetPath = path.join(PREPARED_ASSETS_DIR, asset.id);
        if (await this.pathExists(assetPath)) {
          const size = await this.getDirSizeAsync(assetPath);
          await fs.rm(assetPath, { recursive: true, force: true });
          reclaimedBytes += size;
        }
        await db.delete(preparedAssets).where(eq(preparedAssets.id, asset.id));
        deletedCount++;
      } catch (e: any) {
        errors.push(`Error eliminando asset con error ${asset.id}: ${e.message}`);
      }
    }
    
    return { success: errors.length === 0, deletedCount, reclaimedBytes, errors };
  }

  async cleanupAll(): Promise<CleanupResult> {
    const results: CleanupResult[] = [];
    
    results.push(await this.cleanupOrphanedDiskAssets());
    results.push(await this.cleanupOrphanedDbAssets());
    results.push(await this.cleanupStaleStreams());
    results.push(await this.cleanupErrorAssets());
    
    return {
      success: results.every(r => r.success),
      deletedCount: results.reduce((sum, r) => sum + r.deletedCount, 0),
      reclaimedBytes: results.reduce((sum, r) => sum + r.reclaimedBytes, 0),
      errors: results.flatMap(r => r.errors),
    };
  }

  async forceGarbageCollection(): Promise<{ success: boolean; memoryBefore: number; memoryAfter: number }> {
    const memoryBefore = process.memoryUsage().heapUsed;
    
    try {
      if (global.gc) {
        global.gc();
      }
    } catch (e) {
      // GC not exposed
    }
    
    const memoryAfter = process.memoryUsage().heapUsed;
    
    return {
      success: true,
      memoryBefore,
      memoryAfter,
    };
  }
}

export const storage = new DatabaseStorage();
