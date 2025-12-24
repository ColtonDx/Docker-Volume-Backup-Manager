// API endpoints
const API_URL = '/api/jobs';

// DOM elements
const jobForm = document.getElementById('jobForm');
const backupLabel = document.getElementById('backupLabel');
const frequency = document.getElementById('frequency');
const customCronInput = document.getElementById('customCron');
const customCronGroup = document.getElementById('customCronGroup');
const enabledCheckbox = document.getElementById('enabled');
const jobsList = document.getElementById('jobsList');

const editModal = document.getElementById('editModal');
const editForm = document.getElementById('editForm');
const editJobId = document.getElementById('editJobId');
const editBackupLabel = document.getElementById('editBackupLabel');
const editFrequency = document.getElementById('editFrequency');
const editCustomCronInput = document.getElementById('editCustomCron');
const editCustomCronGroup = document.getElementById('editCustomCronGroup');
const editEnabled = document.getElementById('editEnabled');
const closeModalBtn = document.querySelector('.close');
const cancelEditBtn = document.getElementById('cancelEditBtn');

// Frequency to cron mapping
const frequencyMap = {
    'hourly': '0 * * * *',
    'daily': '0 0 * * *',
    'weekly': '0 0 * * 0',
    'monthly': '0 0 1 * *'
};

// Event listeners
jobForm.addEventListener('submit', handleCreateBackup);
frequency.addEventListener('change', handleFrequencyChange);
editFrequency.addEventListener('change', handleEditFrequencyChange);
editForm.addEventListener('submit', handleEditBackup);
closeModalBtn.addEventListener('click', closeModal);
cancelEditBtn.addEventListener('click', closeModal);

// Initialize
loadAndDisplayJobs();

// Handle frequency change to show/hide custom cron input
function handleFrequencyChange() {
    if (frequency.value === 'custom') {
        customCronGroup.classList.remove('hidden');
        customCronInput.required = true;
    } else {
        customCronGroup.classList.add('hidden');
        customCronInput.required = false;
    }
}

// Handle edit frequency change
function handleEditFrequencyChange() {
    if (editFrequency.value === 'custom') {
        editCustomCronGroup.classList.remove('hidden');
        editCustomCronInput.required = true;
    } else {
        editCustomCronGroup.classList.add('hidden');
        editCustomCronInput.required = false;
    }
}

// Convert frequency to cron expression
function getScheduleFromFrequency(freq, customCron) {
    if (freq === 'custom') {
        return customCron;
    }
    return frequencyMap[freq] || frequencyMap['daily'];
}

// Load and display all jobs
async function loadAndDisplayJobs() {
    try {
        const response = await fetch(API_URL);
        const jobs = await response.json();
        displayJobs(jobs);
    } catch (error) {
        console.error('Error loading jobs:', error);
    }
}

// Display jobs
function displayJobs(jobs) {
    if (jobs.length === 0) {
        jobsList.innerHTML = '<div class="empty-state"><p>No backups scheduled yet. Create one above!</p></div>';
        return;
    }

    jobsList.innerHTML = jobs.map(job => `
        <div class="job-card ${job.enabled ? '' : 'disabled'}">
            <div class="job-header">
                <h3 class="job-name">${escapeHtml(job.backupLabel)}</h3>
                <span class="job-status ${job.enabled ? 'enabled' : 'disabled'}">
                    ${job.enabled ? '✓ Enabled' : '✗ Disabled'}
                </span>
            </div>
            <div class="job-schedule">
                <strong>Schedule:</strong> ${escapeHtml(job.schedule)}
            </div>
            <div class="job-schedule">
                <strong>Frequency:</strong> ${escapeHtml(job.frequency)}
            </div>
            <div class="job-actions">
                <button class="btn-edit" onclick="openEditModal('${job.id}')">Edit</button>
                <button class="btn-toggle ${job.enabled ? 'disable' : ''}" onclick="toggleJob('${job.id}')">
                    ${job.enabled ? 'Disable' : 'Enable'}
                </button>
                <button class="btn-delete" onclick="deleteJob('${job.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

// Handle create backup
async function handleCreateBackup(e) {
    e.preventDefault();

    const freq = frequency.value;
    const schedule = getScheduleFromFrequency(freq, customCronInput.value);

    const jobData = {
        backupLabel: backupLabel.value,
        frequency: freq,
        schedule: schedule,
        enabled: enabledCheckbox.checked
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(jobData)
        });

        if (!response.ok) throw new Error('Failed to create backup');

        // Reset form
        jobForm.reset();
        customCronGroup.classList.add('hidden');
        enabledCheckbox.checked = true;

        // Reload jobs
        loadAndDisplayJobs();
    } catch (error) {
        console.error('Error creating backup:', error);
        alert('Failed to create backup: ' + error.message);
    }
}

// Open edit modal
async function openEditModal(jobId) {
    try {
        const response = await fetch(`${API_URL}/${jobId}`);
        if (!response.ok) throw new Error('Job not found');
        const job = await response.json();

        editJobId.value = job.id;
        editBackupLabel.value = job.backupLabel;
        editFrequency.value = job.frequency;
        editEnabled.checked = job.enabled;

        if (job.frequency === 'custom') {
            editCustomCronInput.value = job.schedule;
            editCustomCronGroup.classList.remove('hidden');
        } else {
            editCustomCronGroup.classList.add('hidden');
        }

        editModal.classList.remove('hidden');
        editModal.classList.add('visible');
    } catch (error) {
        console.error('Error opening edit modal:', error);
        alert('Failed to load backup details');
    }
}

// Handle edit backup
async function handleEditBackup(e) {
    e.preventDefault();

    const freq = editFrequency.value;
    const schedule = getScheduleFromFrequency(freq, editCustomCronInput.value);

    const jobData = {
        backupLabel: editBackupLabel.value,
        frequency: freq,
        schedule: schedule,
        enabled: editEnabled.checked
    };

    try {
        const response = await fetch(`${API_URL}/${editJobId.value}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(jobData)
        });

        if (!response.ok) throw new Error('Failed to update backup');

        closeModal();
        loadAndDisplayJobs();
    } catch (error) {
        console.error('Error updating backup:', error);
        alert('Failed to update backup: ' + error.message);
    }
}

// Close modal
function closeModal() {
    editModal.classList.remove('visible');
    editModal.classList.add('hidden');
    editForm.reset();
}

// Toggle job enabled/disabled
async function toggleJob(jobId) {
    try {
        const response = await fetch(`${API_URL}/${jobId}`);
        if (!response.ok) throw new Error('Job not found');
        const job = await response.json();

        const updatedJob = { ...job, enabled: !job.enabled };

        const updateResponse = await fetch(`${API_URL}/${jobId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedJob)
        });

        if (!updateResponse.ok) throw new Error('Failed to update job');

        loadAndDisplayJobs();
    } catch (error) {
        console.error('Error toggling job:', error);
        alert('Failed to toggle job');
    }
}

// Delete job
async function deleteJob(jobId) {
    if (!confirm('Are you sure you want to delete this backup schedule?')) return;

    try {
        const response = await fetch(`${API_URL}/${jobId}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to delete job');

        loadAndDisplayJobs();
    } catch (error) {
        console.error('Error deleting job:', error);
        alert('Failed to delete job: ' + error.message);
    }
}

// Utility: Escape HTML to prevent XSS
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Auto-reload jobs every 10 seconds
setInterval(loadAndDisplayJobs, 10000);
