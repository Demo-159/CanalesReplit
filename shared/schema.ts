import { z } from "zod";
import { pgTable, text, integer, timestamp, varchar, bigint } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";

// Database Tables - javascript_database integration
export const channels = pgTable("channels", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 50 }).notNull(),
  description: text("description").default(""),
  status: varchar("status", { length: 10 }).notNull().default("idle"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  videoBitrate: integer("video_bitrate").default(1000),
  audioBitrate: integer("audio_bitrate").default(128),
  preset: varchar("preset", { length: 20 }).default("veryfast"),
  segmentDuration: integer("segment_duration").default(4),
  playlistSize: integer("playlist_size").default(6),
  transitionDelay: integer("transition_delay").default(500),
  threads: integer("threads").default(2),
});

export const videos = pgTable("videos", {
  id: varchar("id", { length: 36 }).primaryKey(),
  channelId: varchar("channel_id", { length: 36 }).notNull().references(() => channels.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  duration: integer("duration").default(0).notNull(),
  order: integer("order").default(0).notNull(),
  preparedAssetId: varchar("prepared_asset_id", { length: 36 }).references(() => preparedAssets.id),
});

// Pre-segmented video assets
export const preparedAssets = pgTable("prepared_assets", {
  id: varchar("id", { length: 36 }).primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  sourceUrl: text("source_url").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, processing, ready, error
  duration: integer("duration").default(0).notNull(),
  segmentCount: integer("segment_count").default(0).notNull(),
  segmentDuration: integer("segment_duration").default(4).notNull(),
  totalSize: bigint("total_size", { mode: "number" }).default(0).notNull(), // bytes
  createdAt: timestamp("created_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
  errorMessage: text("error_message"),
});

export const channelsRelations = relations(channels, ({ many }) => ({
  videos: many(videos),
}));

export const videosRelations = relations(videos, ({ one }) => ({
  channel: one(channels, {
    fields: [videos.channelId],
    references: [channels.id],
  }),
  preparedAsset: one(preparedAssets, {
    fields: [videos.preparedAssetId],
    references: [preparedAssets.id],
  }),
}));

export const preparedAssetsRelations = relations(preparedAssets, ({ many }) => ({
  videos: many(videos),
}));

// Types
export type DbChannel = typeof channels.$inferSelect;
export type DbVideo = typeof videos.$inferSelect;
export type DbPreparedAsset = typeof preparedAssets.$inferSelect;

// Video interface for API responses
export interface Video {
  id: string;
  url: string;
  title: string;
  duration: number;
  order: number;
  preparedAssetId?: string | null;
}

// Prepared Asset interface for API responses
export interface PreparedAsset {
  id: string;
  title: string;
  sourceUrl: string;
  status: "pending" | "processing" | "ready" | "error";
  duration: number;
  segmentCount: number;
  segmentDuration: number;
  totalSize: number;
  createdAt: string;
  processedAt: string | null;
  errorMessage: string | null;
}

export const insertVideoSchema = z.object({
  url: z.string().url("URL inválida"),
  title: z.string().min(1, "El título es requerido"),
  duration: z.number().optional().default(0),
});

export type InsertVideo = z.infer<typeof insertVideoSchema>;

// Streaming configuration interface
export interface StreamingConfig {
  videoBitrate: number;
  audioBitrate: number;
  preset: string;
  segmentDuration: number;
  playlistSize: number;
  transitionDelay: number;
  threads: number;
}

// Channel interface for API responses
export interface Channel {
  id: string;
  name: string;
  description: string;
  status: "idle" | "live" | "error";
  videos: Video[];
  createdAt: string;
  streamingConfig: StreamingConfig;
}

export const insertChannelSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(50, "Máximo 50 caracteres"),
  description: z.string().max(200, "Máximo 200 caracteres").optional().default(""),
});

export const streamingConfigSchema = z.object({
  videoBitrate: z.number().min(200).max(8000).default(1200),
  audioBitrate: z.number().min(32).max(320).default(96),
  preset: z.enum(["ultrafast", "superfast", "veryfast", "faster", "fast"]).default("ultrafast"),
  segmentDuration: z.number().min(4).max(10).default(6),
  playlistSize: z.number().min(30).max(120).default(60),
  transitionDelay: z.number().min(0).max(5000).default(100),
  threads: z.number().min(1).max(8).default(2),
});

export type InsertStreamingConfig = z.infer<typeof streamingConfigSchema>;

export type InsertChannel = z.infer<typeof insertChannelSchema>;

// Stats
export interface ChannelStats {
  totalChannels: number;
  activeStreams: number;
  totalVideos: number;
  totalPreparedAssets: number;
  totalStorageUsed: number;
}

// System Metrics
export interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  uptime: number;
}

// Insert schema for prepared assets
export const insertPreparedAssetSchema = z.object({
  title: z.string().min(1, "El título es requerido").max(255),
  sourceUrl: z.string().url("URL inválida"),
  segmentDuration: z.number().min(2).max(10).default(4),
});

export type InsertPreparedAsset = z.infer<typeof insertPreparedAssetSchema>;

// Maintenance & Optimization Types
export interface OrphanedResource {
  type: "orphaned_disk_asset" | "orphaned_db_asset" | "stale_stream" | "error_asset";
  id: string;
  path?: string;
  size: number;
  reason: string;
}

export interface MaintenanceInfo {
  orphanedResources: OrphanedResource[];
  totalReclaimableSize: number;
  errorAssetCount: number;
  staleStreamCount: number;
  orphanedDiskAssetCount: number;
  orphanedDbAssetCount: number;
}

export interface CleanupResult {
  success: boolean;
  deletedCount: number;
  reclaimedBytes: number;
  errors: string[];
}
