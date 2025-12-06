import type { Channel, Video, InsertChannel, InsertVideo, ChannelStats, StreamingConfig, InsertStreamingConfig } from "@shared/schema";
import { channels, videos } from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, count, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

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
  deleteVideo(channelId: string, videoId: string): Promise<boolean>;
  reorderVideos(channelId: string, videoIds: string[]): Promise<void>;
  
  // Stats
  getStats(): Promise<ChannelStats>;
}

// Default streaming config
const defaultStreamingConfig: StreamingConfig = {
  videoBitrate: 1000,
  audioBitrate: 128,
  preset: "veryfast",
  segmentDuration: 4,
  playlistSize: 6,
  transitionDelay: 500,
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

    return {
      totalChannels: channelCount?.count || 0,
      activeStreams: liveCount?.count || 0,
      totalVideos: videoCount?.count || 0,
    };
  }
}

export const storage = new DatabaseStorage();
