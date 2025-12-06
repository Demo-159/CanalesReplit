# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies needed for native modules
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install ffmpeg and other runtime dependencies
RUN apk add --no-cache ffmpeg

# Copy package files
COPY package*.json ./

# Install all dependencies (including drizzle-kit for migrations)
RUN npm ci && npm cache clean --force

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Copy schema and drizzle config for migrations
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/drizzle.config.ts ./

# Copy startup script
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Create streams directory for HLS segments
RUN mkdir -p /app/streams && chmod 755 /app/streams

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8000

# Expose the port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8000/api/health || exit 1

# Start the application with entrypoint
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "dist/index.cjs"]
