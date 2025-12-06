#!/bin/sh
set -e

echo "Waiting for database to be ready..."
sleep 5

echo "Running database migrations..."
npx drizzle-kit push --force

echo "Starting application..."
exec "$@"
