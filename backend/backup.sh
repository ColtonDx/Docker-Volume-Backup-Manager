#!/bin/bash

# Docker Volume Backup Script
# Usage: ./backup.sh <label> <backup_dir> <rclone_config> <use_rclone> <remote> <ignore_pattern>

set -e

LABEL="$1"
BACKUP_DIR="$2"
RCLONE_CONFIG="$3"
USE_RCLONE="$4"
REMOTE="$5"
IGNORE_PATTERN="${6:-.}"  # Default to empty pattern (match nothing)

# Setup logging
LOG_FILE="/app/data/backups.log"
mkdir -p /app/data
{

# Validate inputs
if [[ -z "$LABEL" || -z "$BACKUP_DIR" ]]; then
    echo "Error: Missing required arguments"
    echo "Usage: $0 <label> <backup_dir> <rclone_config> <use_rclone> <remote> <ignore_pattern>"
    exit 1
fi

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "Starting backup for label: $LABEL"
echo "Backup directory: $BACKUP_DIR"
echo "Use rclone: $USE_RCLONE"
if [[ "$USE_RCLONE" == "true" ]]; then
    echo "Remote: $REMOTE"
fi
echo "Ignore pattern: $IGNORE_PATTERN"

# Find all containers with the given label
CONTAINERS=$(docker ps -a --filter "label=$LABEL" --format "{{.ID}}")

if [[ -z "$CONTAINERS" ]]; then
    echo "No containers found with label: $LABEL"
    exit 0
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

# Create a timestamped backup directory
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_SUBDIR="$BACKUP_DIR/${LABEL}_${TIMESTAMP}"
mkdir -p "$BACKUP_SUBDIR"

# Function to check if path should be ignored
should_ignore() {
    local path="$1"
    if [[ "$IGNORE_PATTERN" != "." && "$path" =~ $IGNORE_PATTERN ]]; then
        return 0  # Should ignore
    fi
    return 1  # Don't ignore
}

# Get unique volumes from all containers with the label
declare -A VOLUMES_TO_BACKUP

for container_id in $CONTAINERS; do
    # Get mounts for this container
    docker inspect "$container_id" | jq -r '.Mounts[] | select(.Type=="volume") | .Name' | while read -r volume_name; do
        if ! should_ignore "$volume_name"; then
            VOLUMES_TO_BACKUP["$volume_name"]=1
        fi
    done
done

# Backup each volume
echo "Backing up volumes..."
volume_count=0
for container_id in $CONTAINERS; do
    # Get mounts for this container
    docker inspect "$container_id" | jq -r '.Mounts[] | select(.Type=="volume") | "\(.Name)|\(.Destination)"' | while read -r mount_info; do
        IFS='|' read -r volume_name dest_path <<< "$mount_info"
        
        # Skip if pattern matches ignore list
        if should_ignore "$volume_name"; then
            echo "Ignoring volume: $volume_name"
            continue
        fi
        
        echo "Backing up volume: $volume_name"
        
        # Find the volume's data directory
        VOLUME_DATA_PATH="/var/lib/docker/volumes/${volume_name}/_data"
        
        if [[ -d "$VOLUME_DATA_PATH" ]]; then
            # Copy volume data to backup subdirectory
            mkdir -p "$BACKUP_SUBDIR/$volume_name"
            cp -r "$VOLUME_DATA_PATH"/* "$BACKUP_SUBDIR/$volume_name/" 2>/dev/null || echo "  Warning: Some files could not be copied"
            volume_count=$((volume_count + 1))
            echo "  Volume backed up successfully"
        else
            echo "Warning: Volume data path not found for $volume_name at $VOLUME_DATA_PATH"
        fi
    done
done

echo "Backed up $volume_count volumes"

# Create final tar archive with new naming convention
BACKUP_FILE="$BACKUP_DIR/${LABEL}-$(date +%Y%m%d_%H%M%S).tar.gz"
echo "Creating archive: $BACKUP_FILE"
if [[ -d "$BACKUP_SUBDIR" && $(find "$BACKUP_SUBDIR" -type f | wc -l) -gt 0 ]]; then
    tar -czf "$BACKUP_FILE" -C "$BACKUP_DIR" "${LABEL}_${TIMESTAMP}"
    echo "Archive created successfully with size: $(du -h "$BACKUP_FILE" | cut -f1)"
else
    echo "Warning: No files found to archive"
fi

# Remove the temporary directory
rm -rf "$BACKUP_SUBDIR"

# If rclone is enabled, move the backup to remote
if [[ "$USE_RCLONE" == "true" && ! -z "$REMOTE" ]]; then
    echo "Moving backup to rclone remote: $REMOTE"
    
    if [[ ! -f "$RCLONE_CONFIG" ]]; then
        echo "Warning: rclone config file not found at $RCLONE_CONFIG"
    else
        export RCLONE_CONFIG_FILE="$RCLONE_CONFIG"
        
        # Use rclone move to upload and delete local copy
        rclone move --config="$RCLONE_CONFIG" "$BACKUP_FILE" "$REMOTE:/" || {
            echo "Warning: rclone move failed, backup remains at $BACKUP_FILE"
        }
    fi
fi

# Restart containers that were running before
echo "Restarting containers..."
for container_id in "${RUNNING_CONTAINERS[@]}"; do
    docker start "$container_id" || true
done

echo "Backup completed for label: $LABEL"
} >> "$LOG_FILE" 2>&1