#!/bin/bash

# Docker Volume Restore Script
# Usage: ./restore.sh <label> <backup_file> <backup_dir>

set -e

LABEL="$1"
BACKUP_FILE="$2"
BACKUP_DIR="$3"

# Setup logging
LOG_FILE="/app/data/backups.log"
mkdir -p /app/data
{

echo ""
echo "=========================================="
echo "Starting restore for label: $LABEL"
echo "Backup file: $BACKUP_FILE"
echo "=========================================="

# Validate inputs
if [[ -z "$LABEL" || -z "$BACKUP_FILE" ]]; then
    echo "Error: Missing required arguments"
    echo "Usage: $0 <label> <backup_file> <backup_dir>"
    exit 1
fi

# Check if backup file exists
if [[ ! -f "$BACKUP_FILE" ]]; then
    echo "Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Find all containers with the given label
CONTAINERS=$(docker ps -a --filter "label=$LABEL" --format "{{.ID}}")

if [[ -z "$CONTAINERS" ]]; then
    echo "Error: No containers found with label: $LABEL"
    exit 1
fi

echo "Found containers: $CONTAINERS"

# Store container IDs that are running (to restart later)
RUNNING_CONTAINERS=()
for container_id in $CONTAINERS; do
    status=$(docker inspect --format='{{.State.Status}}' "$container_id")
    if [[ "$status" == "running" ]]; then
        RUNNING_CONTAINERS+=("$container_id")
    fi
done

# Stop all containers with the label
echo "Stopping containers..."
for container_id in $CONTAINERS; do
    docker stop "$container_id" || true
done

# Extract backup to temporary directory
TEMP_RESTORE_DIR="/tmp/restore_$$"
mkdir -p "$TEMP_RESTORE_DIR"
echo "Extracting backup to temporary directory..."
tar -xzf "$BACKUP_FILE" -C "$TEMP_RESTORE_DIR"

# Find the extracted backup folder (it should be the only directory)
EXTRACTED_DIR=$(find "$TEMP_RESTORE_DIR" -maxdepth 1 -type d -not -name "restore_*" | head -1)

if [[ -z "$EXTRACTED_DIR" ]]; then
    echo "Error: Could not find extracted backup directory"
    rm -rf "$TEMP_RESTORE_DIR"
    exit 1
fi

echo "Extracted backup found at: $EXTRACTED_DIR"

# Get volumes for the containers
echo "Restoring volumes..."
for container_id in $CONTAINERS; do
    # Get mounts for this container
    docker inspect "$container_id" | jq -r '.[0].Mounts[] | select(.Type=="volume") | "\(.Name)|\(.Destination)"' | while read -r mount_info; do
        IFS='|' read -r volume_name dest_path <<< "$mount_info"
        
        echo "Restoring volume: $volume_name"
        
        # Find the volume's data directory
        VOLUME_DATA_PATH="/var/lib/docker/volumes/${volume_name}/_data"
        
        if [[ ! -d "$VOLUME_DATA_PATH" ]]; then
            echo "  Creating volume data directory..."
            mkdir -p "$VOLUME_DATA_PATH"
        fi
        
        # Clear existing volume contents
        echo "  Clearing existing volume contents..."
        rm -rf "$VOLUME_DATA_PATH"/*
        
        # Copy backup contents to volume
        BACKUP_VOLUME_DIR="$EXTRACTED_DIR/$volume_name"
        if [[ -d "$BACKUP_VOLUME_DIR" ]]; then
            echo "  Restoring contents from backup..."
            cp -r "$BACKUP_VOLUME_DIR"/* "$VOLUME_DATA_PATH/" 2>/dev/null || echo "  Note: Some files may not have been copied (might be expected)"
            echo "  Volume restored successfully"
        else
            echo "  Warning: No backup found for volume $volume_name at $BACKUP_VOLUME_DIR"
        fi
    done
done

# Cleanup temporary directory
echo "Cleaning up temporary files..."
rm -rf "$TEMP_RESTORE_DIR"

# Restart containers that were running before
echo "Restarting containers..."
for container_id in "${RUNNING_CONTAINERS[@]}"; do
    docker start "$container_id" || true
done

echo "=========================================="
echo "Restore completed for label: $LABEL"
echo "=========================================="

} >> "$LOG_FILE" 2>&1
