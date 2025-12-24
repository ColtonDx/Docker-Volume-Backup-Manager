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
    console.log(`[${new Date().toISOString()}] Executing job: ${job.name}`);
    
    // Prepare environment variables from labels
    const env = { ...process.env };
    if (job.labels) {
      Object.assign(env, job.labels);
    }

    // Execute the script
    const proc = spawn('bash', ['-c', job.script], { env });
    
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      console.log(`Job "${job.name}" completed with exit code ${code}`);
      if (stderr) console.error(`STDERR: ${stderr}`);
    });
  });

  activeJobs[job.id] = task;
  console.log(`Scheduled job: ${job.name} (${job.schedule})`);
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
    name: req.body.name,
    schedule: req.body.schedule,
    script: req.body.script,
    labels: req.body.labels || {},
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
    name: req.body.name,
    schedule: req.body.schedule,
    script: req.body.script,
    labels: req.body.labels || {},
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
