import { z } from "zod";
import { pgTable, text, integer, timestamp, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";

// Database Tables - javascript_database integration
export const channels = pgTable("channels", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 50 }).notNull(),
  description: text("description").default(""),
  status: varchar("status", { length: 10 }).notNull().default("idle"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const videos = pgTable("videos", {
  id: varchar("id", { length: 36 }).primaryKey(),
  channelId: varchar("channel_id", { length: 36 }).notNull().references(() => channels.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  duration: integer("duration").default(0).notNull(),
  order: integer("order").default(0).notNull(),
});

export const channelsRelations = relations(channels, ({ many }) => ({
  videos: many(videos),
}));

export const videosRelations = relations(videos, ({ one }) => ({
  channel: one(channels, {
    fields: [videos.channelId],
    references: [channels.id],
  }),
}));

// Types
export type DbChannel = typeof channels.$inferSelect;
export type DbVideo = typeof videos.$inferSelect;

// Video interface for API responses
export interface Video {
  id: string;
  url: string;
  title: string;
  duration: number;
  order: number;
}

export const insertVideoSchema = z.object({
  url: z.string().url("URL inválida"),
  title: z.string().min(1, "El título es requerido"),
  duration: z.number().optional().default(0),
});

export type InsertVideo = z.infer<typeof insertVideoSchema>;

// Channel interface for API responses
export interface Channel {
  id: string;
  name: string;
  description: string;
  status: "idle" | "live" | "error";
  videos: Video[];
  createdAt: string;
}

export const insertChannelSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(50, "Máximo 50 caracteres"),
  description: z.string().max(200, "Máximo 200 caracteres").optional().default(""),
});

export type InsertChannel = z.infer<typeof insertChannelSchema>;

// Stats
export interface ChannelStats {
  totalChannels: number;
  activeStreams: number;
  totalVideos: number;
}
