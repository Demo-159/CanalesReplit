import type { Channel, Video, InsertChannel, InsertVideo, ChannelStats } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Channels
  getChannels(): Promise<Channel[]>;
  getChannel(id: string): Promise<Channel | undefined>;
  createChannel(data: InsertChannel): Promise<Channel>;
  updateChannel(id: string, data: InsertChannel): Promise<Channel | undefined>;
  deleteChannel(id: string): Promise<boolean>;
  updateChannelStatus(id: string, status: Channel["status"]): Promise<void>;
  
  // Videos
  addVideo(channelId: string, data: InsertVideo): Promise<Video | undefined>;
  deleteVideo(channelId: string, videoId: string): Promise<boolean>;
  reorderVideos(channelId: string, videoIds: string[]): Promise<void>;
  
  // Stats
  getStats(): Promise<ChannelStats>;
}

export class MemStorage implements IStorage {
  private channels: Map<string, Channel>;

  constructor() {
    this.channels = new Map();
  }

  async getChannels(): Promise<Channel[]> {
    return Array.from(this.channels.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getChannel(id: string): Promise<Channel | undefined> {
    return this.channels.get(id);
  }

  async createChannel(data: InsertChannel): Promise<Channel> {
    const id = randomUUID();
    const channel: Channel = {
      id,
      name: data.name,
      description: data.description || "",
      status: "idle",
      videos: [],
      createdAt: new Date().toISOString(),
    };
    this.channels.set(id, channel);
    return channel;
  }

  async updateChannel(id: string, data: InsertChannel): Promise<Channel | undefined> {
    const channel = this.channels.get(id);
    if (!channel) return undefined;
    
    const updated: Channel = {
      ...channel,
      name: data.name,
      description: data.description || "",
    };
    this.channels.set(id, updated);
    return updated;
  }

  async deleteChannel(id: string): Promise<boolean> {
    return this.channels.delete(id);
  }

  async updateChannelStatus(id: string, status: Channel["status"]): Promise<void> {
    const channel = this.channels.get(id);
    if (channel) {
      channel.status = status;
      this.channels.set(id, channel);
    }
  }

  async addVideo(channelId: string, data: InsertVideo): Promise<Video | undefined> {
    const channel = this.channels.get(channelId);
    if (!channel) return undefined;

    const video: Video = {
      id: randomUUID(),
      url: data.url,
      title: data.title,
      duration: data.duration || 0,
      order: channel.videos.length,
    };
    
    channel.videos.push(video);
    this.channels.set(channelId, channel);
    return video;
  }

  async deleteVideo(channelId: string, videoId: string): Promise<boolean> {
    const channel = this.channels.get(channelId);
    if (!channel) return false;

    const index = channel.videos.findIndex((v) => v.id === videoId);
    if (index === -1) return false;

    channel.videos.splice(index, 1);
    // Reorder remaining videos
    channel.videos.forEach((v, i) => {
      v.order = i;
    });
    this.channels.set(channelId, channel);
    return true;
  }

  async reorderVideos(channelId: string, videoIds: string[]): Promise<void> {
    const channel = this.channels.get(channelId);
    if (!channel) return;

    const videoMap = new Map(channel.videos.map((v) => [v.id, v]));
    channel.videos = videoIds
      .map((id, index) => {
        const video = videoMap.get(id);
        if (video) {
          video.order = index;
          return video;
        }
        return null;
      })
      .filter((v): v is Video => v !== null);
    
    this.channels.set(channelId, channel);
  }

  async getStats(): Promise<ChannelStats> {
    const channels = Array.from(this.channels.values());
    return {
      totalChannels: channels.length,
      activeStreams: channels.filter((c) => c.status === "live").length,
      totalVideos: channels.reduce((acc, c) => acc + c.videos.length, 0),
    };
  }
}

export const storage = new MemStorage();
