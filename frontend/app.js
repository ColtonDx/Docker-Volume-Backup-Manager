// API endpoints
const API_URL = '/api/jobs';

// DOM elements
const jobForm = document.getElementById('jobForm');
const jobNameInput = document.getElementById('jobName');
const scheduleInput = document.getElementById('schedule');
const scriptInput = document.getElementById('script');
const labelsContainer = document.getElementById('labelsContainer');
const addLabelBtn = document.getElementById('addLabelBtn');
const enabledCheckbox = document.getElementById('enabled');
const jobsList = document.getElementById('jobsList');

const editModal = document.getElementById('editModal');
const editForm = document.getElementById('editForm');
const editJobId = document.getElementById('editJobId');
const editJobName = document.getElementById('editJobName');
const editSchedule = document.getElementById('editSchedule');
const editScript = document.getElementById('editScript');
const editLabelsContainer = document.getElementById('editLabelsContainer');
const editAddLabelBtn = document.getElementById('editAddLabelBtn');
const editEnabled = document.getElementById('editEnabled');
const closeModalBtn = document.querySelector('.close');
const cancelEditBtn = document.getElementById('cancelEditBtn');

// Event listeners
jobForm.addEventListener('submit', handleCreateJob);
addLabelBtn.addEventListener('click', addLabelInput);
editForm.addEventListener('submit', handleEditJob);
editAddLabelBtn.addEventListener('click', () => addEditLabelInput());
closeModalBtn.addEventListener('click', closeModal);
cancelEditBtn.addEventListener('click', closeModal);

// Initialize
loadAndDisplayJobs();

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
        jobsList.innerHTML = '<div class="empty-state"><p>No jobs scheduled yet. Create one above!</p></div>';
        return;
    }

    jobsList.innerHTML = jobs.map(job => `
        <div class="job-card ${job.enabled ? '' : 'disabled'}">
            <div class="job-header">
                <h3 class="job-name">${escapeHtml(job.name)}</h3>
                <span class="job-status ${job.enabled ? 'enabled' : 'disabled'}">
                    ${job.enabled ? '✓ Enabled' : '✗ Disabled'}
                </span>
            </div>
            <div class="job-schedule">
                <strong>Schedule:</strong> ${escapeHtml(job.schedule)}
            </div>
            <div class="job-script">
                <strong>Script:</strong><br>
                ${escapeHtml(job.script)}
            </div>
            ${job.labels && Object.keys(job.labels).length > 0 ? `
                <div class="job-labels">
                    <h4>Environment Labels:</h4>
                    ${Object.entries(job.labels).map(([key, value]) => 
                        `<span class="label-badge">${escapeHtml(key)}=${escapeHtml(value)}</span>`
                    ).join('')}
                </div>
            ` : ''}
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

// Handle create job
async function handleCreateJob(e) {
    e.preventDefault();

    const labels = {};
    document.querySelectorAll('#labelsContainer .label-input-group').forEach(group => {
        const key = group.querySelector('.label-key').value.trim();
        const value = group.querySelector('.label-value').value.trim();
        if (key) labels[key] = value;
    });

    const jobData = {
        name: jobNameInput.value,
        schedule: scheduleInput.value,
        script: scriptInput.value,
        labels: labels,
        enabled: enabledCheckbox.checked
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(jobData)
        });

        if (!response.ok) throw new Error('Failed to create job');

        // Reset form
        jobForm.reset();
        labelsContainer.innerHTML = '';
        enabledCheckbox.checked = true;

        // Reload jobs
        loadAndDisplayJobs();
    } catch (error) {
        console.error('Error creating job:', error);
        alert('Failed to create job: ' + error.message);
    }
}

// Add label input
function addLabelInput() {
    const group = document.createElement('div');
    group.className = 'label-input-group';
    group.innerHTML = `
        <input type="text" class="label-key" placeholder="Label name (e.g., BACKUP_DIR)">
        <input type="text" class="label-value" placeholder="Value (e.g., /data/backup)">
        <button type="button" class="btn-remove" onclick="this.parentElement.remove()">Remove</button>
    `;
    labelsContainer.appendChild(group);
}

// Add edit label input
function addEditLabelInput() {
    const group = document.createElement('div');
    group.className = 'label-input-group';
    group.innerHTML = `
        <input type="text" class="label-key" placeholder="Label name (e.g., BACKUP_DIR)">
        <input type="text" class="label-value" placeholder="Value (e.g., /data/backup)">
        <button type="button" class="btn-remove" onclick="this.parentElement.remove()">Remove</button>
    `;
    editLabelsContainer.appendChild(group);
}

// Open edit modal
async function openEditModal(jobId) {
    try {
        const response = await fetch(`${API_URL}/${jobId}`);
        if (!response.ok) throw new Error('Job not found');
        const job = await response.json();

        editJobId.value = job.id;
        editJobName.value = job.name;
        editSchedule.value = job.schedule;
        editScript.value = job.script;
        editEnabled.checked = job.enabled;

        // Clear and populate labels
        editLabelsContainer.innerHTML = '';
        if (job.labels) {
            Object.entries(job.labels).forEach(([key, value]) => {
                const group = document.createElement('div');
                group.className = 'label-input-group';
                group.innerHTML = `
                    <input type="text" class="label-key" value="${escapeHtml(key)}" placeholder="Label name">
                    <input type="text" class="label-value" value="${escapeHtml(value)}" placeholder="Value">
                    <button type="button" class="btn-remove" onclick="this.parentElement.remove()">Remove</button>
                `;
                editLabelsContainer.appendChild(group);
            });
        }

        editModal.classList.remove('hidden');
        editModal.classList.add('visible');
    } catch (error) {
        console.error('Error opening edit modal:', error);
        alert('Failed to load job details');
    }
}

// Handle edit job
async function handleEditJob(e) {
    e.preventDefault();

    const labels = {};
    document.querySelectorAll('#editLabelsContainer .label-input-group').forEach(group => {
        const key = group.querySelector('.label-key').value.trim();
        const value = group.querySelector('.label-value').value.trim();
        if (key) labels[key] = value;
    });

    const jobData = {
        name: editJobName.value,
        schedule: editSchedule.value,
        script: editScript.value,
        labels: labels,
        enabled: editEnabled.checked
    };

    try {
        const response = await fetch(`${API_URL}/${editJobId.value}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(jobData)
        });

        if (!response.ok) throw new Error('Failed to update job');

        closeModal();
        loadAndDisplayJobs();
    } catch (error) {
        console.error('Error updating job:', error);
        alert('Failed to update job: ' + error.message);
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
    if (!confirm('Are you sure you want to delete this job?')) return;

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
