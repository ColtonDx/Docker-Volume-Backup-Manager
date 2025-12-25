const express = require('express');
const bodyParser = require('body-parser');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, '../data/jobs.json');

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
    
    // Execute the Docker volume backup script
    // This is a placeholder - replace with your actual backup script
    const backupScript = `
      echo "Executing backup for: ${job.backupLabel}"
      # Add your Docker volume backup commands here
      # Example: docker run --rm -v volume_name:/data -v backup_location:/backup alpine tar -czf /backup/backup_$(date +%Y%m%d_%H%M%S).tar.gz /data
    `;

    const proc = spawn('bash', ['-c', backupScript]);
    
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
    enabled: req.body.enabled !== false
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

// Start server
app.listen(PORT, () => {
  console.log(`Cron Job Scheduler running on http://localhost:${PORT}`);
  
  // Load and schedule all enabled jobs
  const jobs = loadJobs();
  jobs.forEach(job => {
    if (job.enabled) {
      initCronJob(job);
    }
  });
});
