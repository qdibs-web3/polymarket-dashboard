#!/bin/bash

# Polymarket Trading Bot Startup Script
# This script starts both the dashboard and the bot service

set -e

echo "==================================="
echo "Polymarket Trading Bot Dashboard"
echo "==================================="
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Error: .env file not found!"
    echo "Please copy .env.example to .env and configure your settings"
    exit 1
fi

# Check for required environment variables
if [ -z "$POLYMARKET_PRIVATE_KEY" ] || [ -z "$POLYMARKET_FUNDER_ADDRESS" ]; then
    echo "Warning: Polymarket API credentials not set"
    echo "Please set POLYMARKET_PRIVATE_KEY and POLYMARKET_FUNDER_ADDRESS in your .env file"
    echo ""
fi

# Check if database is configured
if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL not set!"
    echo "Please configure your database connection in .env"
    exit 1
fi

echo "Starting Polymarket Bot Dashboard..."
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    pnpm install
    echo ""
fi

# Push database schema
echo "Updating database schema..."
pnpm db:push
echo ""

# Start the development server
echo "Starting dashboard server..."
echo "Dashboard will be available at: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop"
echo ""

pnpm dev
