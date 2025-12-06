import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertChannelSchema, insertVideoSchema } from "@shared/schema";
import { startStream, stopStream, getStreamPath } from "./streaming";
import express from "express";
import * as path from "path";
import * as fs from "fs";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Get stats
  app.get("/api/stats", async (_req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error) {
      console.error("Error getting stats:", error);
      res.status(500).json({ error: "Failed to get stats" });
    }
  });

  // Get all channels
  app.get("/api/channels", async (_req, res) => {
    try {
      const channels = await storage.getChannels();
      res.json(channels);
    } catch (error) {
      console.error("Error getting channels:", error);
      res.status(500).json({ error: "Failed to get channels" });
    }
  });

  // Get single channel
  app.get("/api/channels/:id", async (req, res) => {
    try {
      const channel = await storage.getChannel(req.params.id);
      if (!channel) {
        return res.status(404).json({ error: "Channel not found" });
      }
      res.json(channel);
    } catch (error) {
      console.error("Error getting channel:", error);
      res.status(500).json({ error: "Failed to get channel" });
    }
  });

  // Create channel
  app.post("/api/channels", async (req, res) => {
    try {
      const parsed = insertChannelSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      
      const channel = await storage.createChannel(parsed.data);
      res.status(201).json(channel);
    } catch (error) {
      console.error("Error creating channel:", error);
      res.status(500).json({ error: "Failed to create channel" });
    }
  });

  // Update channel
  app.patch("/api/channels/:id", async (req, res) => {
    try {
      const parsed = insertChannelSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      
      const channel = await storage.updateChannel(req.params.id, parsed.data);
      if (!channel) {
        return res.status(404).json({ error: "Channel not found" });
      }
      res.json(channel);
    } catch (error) {
      console.error("Error updating channel:", error);
      res.status(500).json({ error: "Failed to update channel" });
    }
  });

  // Delete channel
  app.delete("/api/channels/:id", async (req, res) => {
    try {
      // Stop stream if running
      await stopStream(req.params.id);
      
      const deleted = await storage.deleteChannel(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Channel not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting channel:", error);
      res.status(500).json({ error: "Failed to delete channel" });
    }
  });

  // Start streaming
  app.post("/api/channels/:id/start", async (req, res) => {
    try {
      const channel = await storage.getChannel(req.params.id);
      if (!channel) {
        return res.status(404).json({ error: "Channel not found" });
      }
      
      if (channel.videos.length === 0) {
        return res.status(400).json({ error: "Channel has no videos" });
      }
      
      const started = await startStream(channel);
      if (!started) {
        await storage.updateChannelStatus(req.params.id, "error");
        return res.status(500).json({ error: "Failed to start stream" });
      }
      
      await storage.updateChannelStatus(req.params.id, "live");
      const updatedChannel = await storage.getChannel(req.params.id);
      res.json(updatedChannel);
    } catch (error) {
      console.error("Error starting stream:", error);
      await storage.updateChannelStatus(req.params.id, "error");
      res.status(500).json({ error: "Failed to start stream" });
    }
  });

  // Get stream status
  app.get("/api/channels/:id/status", async (req, res) => {
    try {
      const channel = await storage.getChannel(req.params.id);
      if (!channel) {
        return res.status(404).json({ error: "Channel not found" });
      }
      
      const { isStreamActive, getStreamStatus } = await import("./streaming");
      const status = getStreamStatus(req.params.id);
      
      res.json({
        channelId: channel.id,
        status: channel.status,
        streaming: status.active,
        error: status.error,
      });
    } catch (error) {
      console.error("Error getting stream status:", error);
      res.status(500).json({ error: "Failed to get stream status" });
    }
  });

  // Stop streaming
  app.post("/api/channels/:id/stop", async (req, res) => {
    try {
      const channel = await storage.getChannel(req.params.id);
      if (!channel) {
        return res.status(404).json({ error: "Channel not found" });
      }
      
      await stopStream(req.params.id);
      await storage.updateChannelStatus(req.params.id, "idle");
      
      const updatedChannel = await storage.getChannel(req.params.id);
      res.json(updatedChannel);
    } catch (error) {
      console.error("Error stopping stream:", error);
      res.status(500).json({ error: "Failed to stop stream" });
    }
  });

  // Add video to playlist
  app.post("/api/channels/:id/videos", async (req, res) => {
    try {
      const parsed = insertVideoSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      
      const video = await storage.addVideo(req.params.id, parsed.data);
      if (!video) {
        return res.status(404).json({ error: "Channel not found" });
      }
      res.status(201).json(video);
    } catch (error) {
      console.error("Error adding video:", error);
      res.status(500).json({ error: "Failed to add video" });
    }
  });

  // Delete video from playlist
  app.delete("/api/channels/:id/videos/:videoId", async (req, res) => {
    try {
      const deleted = await storage.deleteVideo(req.params.id, req.params.videoId);
      if (!deleted) {
        return res.status(404).json({ error: "Video not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting video:", error);
      res.status(500).json({ error: "Failed to delete video" });
    }
  });

  // Reorder videos
  app.patch("/api/channels/:id/videos/reorder", async (req, res) => {
    try {
      const { videoIds } = req.body;
      if (!Array.isArray(videoIds)) {
        return res.status(400).json({ error: "videoIds must be an array" });
      }
      
      await storage.reorderVideos(req.params.id, videoIds);
      const channel = await storage.getChannel(req.params.id);
      res.json(channel);
    } catch (error) {
      console.error("Error reordering videos:", error);
      res.status(500).json({ error: "Failed to reorder videos" });
    }
  });

  // Serve HLS streams
  app.use("/streams", (req, res, next) => {
    // Set proper CORS and content type headers for HLS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    
    if (req.path.endsWith(".m3u8")) {
      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    } else if (req.path.endsWith(".ts")) {
      res.setHeader("Content-Type", "video/MP2T");
    }
    
    next();
  }, express.static(path.join(process.cwd(), "streams"), {
    maxAge: 0,
    etag: false,
  }));

  return httpServer;
}
