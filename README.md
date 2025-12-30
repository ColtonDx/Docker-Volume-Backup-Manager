# Docker Volume Backup Manager

A web-based application for scheduling and managing Docker volume backups with support for local storage and remote cloud backup via [rclone](https://rclone.org/).

## Overview

Docker Volume Backups provides an interface to:
- **Schedule automated backups** of Docker volumes at regular intervals
- **Manage backup jobs** with granular control over frequency and retention
- **Restore volumes** from previously created backups
- **Sync backups to cloud storage** via rclone (AWS S3, Google Cloud Storage, Azure, Dropbox, etc.)
- **Configure backup naming and filtering** to match your workflow

## How It Works

### Backup Flow

1. You create a backup job specifying:
   - Volume label (containers with this label are backed up)
   - Backup frequency (hourly, daily, weekly, monthly, or custom cron)
   - Storage options (local only or local + rclone remote)
   - Retention policy (for local backups)

2. The backend uses `node-cron` to schedule jobs based on your chosen frequency
3. When a backup runs:
   - The `backup.sh` script stops containers with the specified label
   - Copies volume contents to `/backups/{label}/{timestamp}/`
   - Restarts the containers
   - If rclone is enabled, syncs the backup to your remote storage
   - If retention is set, removes oldest local backups beyond the count

4. You can manually trigger backups anytime via the **Run** button

### Restore Flow

1. Click **Restore** to open the restore modal
2. Select a backup label (step 1)
3. Select which backup to restore from (step 2)
4. Confirm the restore operation
5. The `restore.sh` script:
   - Stops containers with the specified label
   - Clears existing volume contents
   - Restores data from the selected backup
   - Restarts the containers

## Features & Options

### Backup Jobs

#### Backup Label
The Docker label used to identify containers whose volumes should be backed up. All running containers with this label will have their volumes backed up together.

**Example**: If you set the label to `myapp`, the backup will include volumes from all containers labeled `myapp`.

#### Backup Frequency

Choose how often backups should run:

- **Hourly**: Runs at the start of every hour (00:00 minutes)
- **Daily**: Run at a specific time each day (configure with time picker)
- **Weekly**: Run on a specific day of the week at a specific time (configure with day + time pickers)
- **Monthly**: Run on a specific day of the month at a specific time (configure with day + time pickers)
- **Custom**: Use a custom [cron expression](https://crontab.guru/) for fine-grained control

#### Schedule
The cron expression that defines when the backup runs. This is automatically generated from your frequency selection, or you can input a custom cron expression directly.

**Cron Format**: `minute hour day-of-month month day-of-week`

Example: `0 2 * * *` means "run at 2:00 AM every day"

#### Enable/Disable
Toggle whether a backup job is active. Disabled jobs will not run on schedule, but can still be manually triggered.

#### Rclone Remote
If enabled, backups are synced to a remote storage location configured in rclone.

**What is rclone?**  
[rclone](https://rclone.org/) is a command-line tool that syncs files to/from cloud storage services. It supports 70+ cloud providers including:
- AWS S3
- Google Cloud Storage
- Azure Blob Storage
- Dropbox
- OneDrive
- SFTP servers
- and many more

**Using Rclone**:
1. [Install rclone](https://rclone.org/install/)
2. [Configure a remote](https://rclone.org/commands/rclone_config/) (e.g., `rclone config`)
3. Enter the remote name in the "Rclone Remote" field (e.g., `my-s3-bucket`)
4. When a backup runs, it automatically syncs to your remote

**Rclone Documentation**: https://rclone.org/docs/

**Common Remote Types**:
- [AWS S3](https://rclone.org/s3/)
- [Google Cloud Storage](https://rclone.org/googlecloud/)
- [Azure Blob Storage](https://rclone.org/azureblob/)
- [Dropbox](https://rclone.org/dropbox/)
- [SFTP](https://rclone.org/sftp/)

#### Retention Count (Local Backups Only)
The number of local backups to keep. Older backups are automatically deleted when this limit is reached.

**Example**: If set to `5`, the application keeps the 5 most recent local backups and removes older ones.

**Note**: Retention only applies to local backups. When rclone is enabled, retention is disabled (all backups are kept in cloud storage).

### Settings

Access settings via the **⚙️ Settings** button in the header.

#### Backup Naming Schema
Controls how backup directories are named. Available variables:
- `{label}` - The backup label
- `{date}` - Date in YYYYMMDD format (e.g., 20251225)
- `{time}` - Time in HHMM format (e.g., 1430)
- `{timestamp}` - Combined date and time in YYYYMMDD_HHMM format (e.g., 20251225_1430)

**Example**: `backup_{label}_{date}` creates directories like `backup_myapp_20251225`

#### Ignore Patterns (Regex)
Regular expressions to exclude files/directories from backups. These patterns are passed to the backup script to skip matching paths.

**Example patterns**:
- `.*\.log$` - Exclude .log files
- `node_modules` - Exclude node_modules directories
- `\.git` - Exclude .git directories

#### Background Gradient
Customize the app's background with a gradient. Select start and end colors to create a personalized look.

#### Rclone Configuration
Paste your rclone configuration here (from `~/.config/rclone/rclone.conf`). This allows the app to access configured remotes.

## Installation & Setup

### Docker Setup

```bash
# Clone the repository
git clone https://github.com/ColtonDx/DockerVolumeBackups.git
cd DockerVolumeBackups

# Build and run
docker-compose up --build
```

The app will be available at `http://localhost:3000`

## Troubleshooting

### Backups aren't running
1. Ensure the job is **Enabled**
2. Check that the **Frequency** and **Schedule** are correct
3. Review backend logs: `docker logs <container_id>` or check console output if running locally

### Restore fails
1. Verify the backup label and backup file exist
2. Ensure containers with the label are running
3. Check that sufficient disk space is available
4. Review backend logs for detailed error messages

### Rclone sync issues
1. Verify rclone is installed and accessible
2. Test your remote: `rclone ls <remote>:`
3. Ensure the rclone configuration is correctly entered in Settings
4. Check that the remote has appropriate permissions and credentials

## Security Notes

- The web UI is intended for internal/trusted networks. Do not expose it to the public internet without authentication.
- Rclone configurations contain sensitive credentials. Keep them secure and never commit to version control.
- Backup files may contain sensitive data. Restrict access and encryption accordingly.

## Support & Documentation

- [rclone Documentation](https://rclone.org/docs/)
- [Docker Documentation](https://docs.docker.com/)
- [cron Expression Guide](https://crontab.guru/)
