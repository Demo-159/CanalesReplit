import { z } from "zod";

// Video in a playlist
export interface Video {
  id: string;
  url: string;
  title: string;
  duration: number; // in seconds
  order: number;
}

export const insertVideoSchema = z.object({
  url: z.string().url("URL inválida"),
  title: z.string().min(1, "El título es requerido"),
  duration: z.number().optional().default(0),
});

export type InsertVideo = z.infer<typeof insertVideoSchema>;

// Channel
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
