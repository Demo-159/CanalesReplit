#!/bin/sh
set -e

echo "=== Starting Application ==="
echo "Checking environment..."

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL environment variable is not set!"
  echo "Please set DATABASE_URL in your docker-compose.yml or docker run command"
  exit 1
fi

echo "DATABASE_URL is configured"

# Extract connection details from DATABASE_URL
# Format: postgresql://user:pass@host:port/db
DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|.*@([^:]+):.*|\1|')
DB_PORT=$(echo "$DATABASE_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')

echo "Waiting for database at $DB_HOST:$DB_PORT..."

# Simple wait loop using netcat
MAX_RETRIES=30
RETRY_COUNT=0

while ! nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "ERROR: Could not connect to database after $MAX_RETRIES attempts"
    exit 1
  fi
  echo "Attempt $RETRY_COUNT/$MAX_RETRIES - Database not ready, waiting..."
  sleep 2
done

echo "Database connection established!"
sleep 3

echo "Running database migrations..."

# Create tables directly using psql
psql "$DATABASE_URL" <<EOF
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
  echo "ERROR: Migrations failed!"
  exit 1
fi

echo "Starting application..."
exec "$@"
