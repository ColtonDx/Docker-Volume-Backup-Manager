const express = require('express');
const bodyParser = require('body-parser');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, '../data/jobs.json');
const BACKUP_SCRIPT = path.join(__dirname, './backup.sh');
const BACKUP_DIR = '/backups';
const RCLONE_CONFIG = '/rclone/rclone.conf';

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Ensure data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize jobs file if it doesn't exist
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
}

// Store active cron jobs
let activeJobs = {};
let globalSettings = {};

// Load global settings from localStorage equivalent (we'll use a settings.json file)
const SETTINGS_FILE = path.join(__dirname, '../data/settings.json');

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      return JSON.parse(data);
    }
    return {};
  } catch (err) {
    console.error('Error reading settings file:', err);
    return {};
  }
}

// Load jobs on startup
function loadJobs() {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading jobs file:', err);
    return [];
  }
}

// Save jobs to file
function saveJobs(jobs) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(jobs, null, 2));
  } catch (err) {
    console.error('Error saving jobs file:', err);
  }
}

// Initialize cron job
function initCronJob(job) {
  if (activeJobs[job.id]) {
    activeJobs[job.id].stop();
  }

  if (!job.enabled) return;

  const task = cron.schedule(job.schedule, () => {
    console.log(`[${new Date().toISOString()}] Starting backup: ${job.backupLabel}`);
    
    // Get current settings for ignore pattern
    globalSettings = loadSettings();
    const ignorePattern = globalSettings.ignorePattern || '.';
    
    // Execute the backup script
    const args = [
      job.backupLabel,  // Label (used as docker label)
      BACKUP_DIR,
      RCLONE_CONFIG,
      job.useRclone ? 'true' : 'false',
      job.remote || '',
      ignorePattern
    ];

    const proc = spawn('bash', [BACKUP_SCRIPT, ...args]);
    
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log(`[${job.backupLabel}] ${data.toString().trim()}`);
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error(`[${job.backupLabel}] Error: ${data.toString().trim()}`);
    });

    proc.on('close', (code) => {
      console.log(`Backup "${job.backupLabel}" completed with exit code ${code}`);
      if (code !== 0) {
        console.error(`Backup failed for ${job.backupLabel}`);
      }
    });
  });

  activeJobs[job.id] = task;
  console.log(`Scheduled backup: ${job.backupLabel} (${job.schedule})`);
}

// GET all jobs
app.get('/api/jobs', (req, res) => {
  const jobs = loadJobs();
  res.json(jobs);
});

// GET single job
app.get('/api/jobs/:id', (req, res) => {
  const jobs = loadJobs();
  const job = jobs.find(j => j.id === req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

// CREATE new job
app.post('/api/jobs', (req, res) => {
  const jobs = loadJobs();
  const newJob = {
    id: Date.now().toString(),
    backupLabel: req.body.backupLabel,
    frequency: req.body.frequency,
    schedule: req.body.schedule,
    enabled: req.body.enabled !== false,
    useRclone: req.body.useRclone || false,
    remote: req.body.remote || '',
    createdAt: new Date().toISOString()
  };

  jobs.push(newJob);
  saveJobs(jobs);
  initCronJob(newJob);

  res.status(201).json(newJob);
});

// UPDATE job
app.put('/api/jobs/:id', (req, res) => {
  const jobs = loadJobs();
  const jobIndex = jobs.findIndex(j => j.id === req.params.id);
  if (jobIndex === -1) return res.status(404).json({ error: 'Job not found' });

  const updatedJob = {
    ...jobs[jobIndex],
    backupLabel: req.body.backupLabel,
    frequency: req.body.frequency,
    schedule: req.body.schedule,
    enabled: req.body.enabled !== false,
    useRclone: req.body.useRclone || false,
    remote: req.body.remote || ''
  };

  jobs[jobIndex] = updatedJob;
  saveJobs(jobs);
  initCronJob(updatedJob);

  res.json(updatedJob);
});

// DELETE job
app.delete('/api/jobs/:id', (req, res) => {
  const jobs = loadJobs();
  const jobIndex = jobs.findIndex(j => j.id === req.params.id);
  if (jobIndex === -1) return res.status(404).json({ error: 'Job not found' });

  const deletedJob = jobs[jobIndex];
  jobs.splice(jobIndex, 1);
  saveJobs(jobs);

  if (activeJobs[req.params.id]) {
    activeJobs[req.params.id].stop();
    delete activeJobs[req.params.id];
  }

  res.json({ message: 'Job deleted', job: deletedJob });
});

// Manual run backup job
app.post('/api/jobs/:id/run', (req, res) => {
  const jobs = loadJobs();
  const job = jobs.find(j => j.id === req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  // Run the backup script immediately
  globalSettings = loadSettings();
  const ignorePattern = globalSettings.ignorePattern || '.';
  
  const args = [
    job.backupLabel,
    BACKUP_DIR,
    RCLONE_CONFIG,
    job.useRclone ? 'true' : 'false',
    job.remote || '',
    ignorePattern
  ];

  console.log(`[Manual Run] Starting backup for: ${job.backupLabel}`);
  
  const proc = spawn('bash', [BACKUP_SCRIPT, ...args]);
  
  let stdout = '';
  let stderr = '';

  proc.stdout.on('data', (data) => {
    stdout += data.toString();
    console.log(`[${job.backupLabel}] ${data.toString().trim()}`);
  });

  proc.stderr.on('data', (data) => {
    stderr += data.toString();
    console.error(`[${job.backupLabel}] Error: ${data.toString().trim()}`);
  });

  proc.on('close', (code) => {
    console.log(`Manual backup "${job.backupLabel}" completed with exit code ${code}`);
    if (code !== 0) {
      console.error(`Manual backup failed for ${job.backupLabel}`);
    }
  });

  res.json({ 
    message: 'Backup started', 
    label: job.backupLabel,
    status: 'running'
  });
});

// GET settings
app.get('/api/settings', (req, res) => {
  const settings = loadSettings();
  res.json(settings);
});

// SAVE settings
app.post('/api/settings', (req, res) => {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(req.body, null, 2));
    globalSettings = req.body;
    res.json({ message: 'Settings saved', settings: req.body });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save settings', details: err.message });
  }
});

// GET backup labels
app.get('/api/backups/labels', (req, res) => {
  try {
    const jobs = loadJobs();
    // Return unique labels with their rclone settings
    const labels = jobs.map(job => ({
      label: job.backupLabel,
      useRclone: job.useRclone || false,
      remote: job.remote || ''
    }));
    res.json(labels);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load labels', details: err.message });
  }
});

// GET list of backups for a label (from filesystem)
app.get('/api/backups/local/:label', (req, res) => {
  try {
    const label = req.params.label;
    const files = fs.readdirSync(BACKUP_DIR).filter(file => {
      return file.startsWith(label + '-') && file.endsWith('.tar.gz');
    });
    res.json(files.sort().reverse()); // Most recent first
  } catch (err) {
    res.status(500).json({ error: 'Failed to list backups', details: err.message });
  }
});

// GET list of backups for a label from rclone remote
app.get('/api/backups/remote/:label/:remote', (req, res) => {
  try {
    const label = req.params.label;
    const remote = req.params.remote;

    const proc = spawn('rclone', [
      'ls',
      '--config=' + RCLONE_CONFIG,
      remote + ':/',
      '-R'
    ]);

    let output = '';
    let errorOutput = '';

    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        return res.status(500).json({ error: 'Failed to list remote backups', details: errorOutput });
      }

      // Parse rclone output and filter by label
      const files = output
        .split('\n')
        .filter(line => line.trim())
        .map(line => line.trim().split(/\s+/).pop()) // Get filename
        .filter(file => file && file.startsWith(label + '-') && file.endsWith('.tar.gz'))
        .sort()
        .reverse(); // Most recent first

      res.json(files);
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list remote backups', details: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Cron Job Scheduler running on http://localhost:${PORT}`);
  
  // Load global settings
  globalSettings = loadSettings();
  
  // Load and schedule all enabled jobs
  const jobs = loadJobs();
  jobs.forEach(job => {
    if (job.enabled) {
      initCronJob(job);
    }
  });
});
