#!/bin/sh
set -e

echo "=== Starting Application ==="
echo "Checking environment..."

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL environment variable is not set!"
  echo "Please set DATABASE_URL in your hosting platform's environment variables"
  exit 1
fi

echo "DATABASE_URL is configured"

# For cloud databases like Neon, we can't use netcat to check connection
# Just wait a bit and try the migration directly
echo "Waiting for database to be ready..."
sleep 5

echo "Running database migrations..."

# Create tables directly using psql with SSL support
psql "$DATABASE_URL" <<'EOF'
-- Create channels table if not exists
CREATE TABLE IF NOT EXISTS channels (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  description TEXT DEFAULT '',
  status VARCHAR(10) NOT NULL DEFAULT 'idle',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  video_bitrate INTEGER DEFAULT 1000,
  audio_bitrate INTEGER DEFAULT 128,
  preset VARCHAR(20) DEFAULT 'veryfast',
  segment_duration INTEGER DEFAULT 4,
  playlist_size INTEGER DEFAULT 6,
  transition_delay INTEGER DEFAULT 500,
  threads INTEGER DEFAULT 2
);

-- Create videos table if not exists
CREATE TABLE IF NOT EXISTS videos (
  id VARCHAR(36) PRIMARY KEY,
  channel_id VARCHAR(36) NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title VARCHAR(255) NOT NULL,
  duration INTEGER DEFAULT 0 NOT NULL,
  "order" INTEGER DEFAULT 0 NOT NULL
);

-- Create index on channel_id for better performance
CREATE INDEX IF NOT EXISTS idx_videos_channel_id ON videos(channel_id);
EOF

if [ $? -eq 0 ]; then
  echo "Migrations completed successfully!"
else
  echo "WARNING: Migrations may have failed, but continuing anyway..."
fi

echo "Starting application..."
exec "$@"
