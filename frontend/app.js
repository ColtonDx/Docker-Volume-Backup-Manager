// API endpoints
const API_URL = '/api/jobs';

// Settings storage key
const SETTINGS_KEY = 'dockerBackupSettings';

// DOM elements - Form
const addJobBtn = document.getElementById('addJobBtn');
const jobForm = document.getElementById('jobForm');
const formSection = document.getElementById('formSection');
const cancelFormBtn = document.getElementById('cancelFormBtn');
const backupLabel = document.getElementById('backupLabel');
const useRclone = document.getElementById('useRclone');
const remote = document.getElementById('remote');
const remoteGroup = document.getElementById('remoteGroup');
const frequency = document.getElementById('frequency');
const customCronInput = document.getElementById('customCron');
const customCronGroup = document.getElementById('customCronGroup');
const enabledCheckbox = document.getElementById('enabled');
const jobsList = document.getElementById('jobsList');

// DOM elements - Settings
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const settingsForm = document.getElementById('settingsForm');
const settingsClose = document.getElementById('settingsClose');
const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
const backupNameSchema = document.getElementById('backupNameSchema');
const backgroundGradientStart = document.getElementById('backgroundGradientStart');
const backgroundGradientEnd = document.getElementById('backgroundGradientEnd');
const ignorePatternsList = document.getElementById('ignorePatternsList');
const addPatternBtn = document.getElementById('addPatternBtn');
const rcloneConfig = document.getElementById('rcloneConfig');
const schemaPreview = document.getElementById('schemaPreview');

// DOM elements - Restore Modal
const restoreBtn = document.getElementById('restoreBtn');
const restoreModal = document.getElementById('restoreModal');
const restoreClose = document.getElementById('restoreClose');
const restoreCloseBtn = document.getElementById('restoreCloseBtn');
const restoreLabelSelect = document.getElementById('restoreLabelSelect');
const restoreBackupSelect = document.getElementById('restoreBackupSelect');
const restoreLabelNextBtn = document.getElementById('restoreLabelNextBtn');
const restoreBackupBtn = document.getElementById('restoreBackupBtn');
const restoreBackBtn = document.getElementById('restoreBackBtn');
const restoreStep1 = document.getElementById('restoreStep1');
const restoreStep2 = document.getElementById('restoreStep2');

// DOM elements - Edit Modal
const editModal = document.getElementById('editModal');
const editForm = document.getElementById('editForm');
const editJobId = document.getElementById('editJobId');
const editBackupLabel = document.getElementById('editBackupLabel');
const editFrequency = document.getElementById('editFrequency');
const editCustomCronInput = document.getElementById('editCustomCron');
const editCustomCronGroup = document.getElementById('editCustomCronGroup');
const editUseRclone = document.getElementById('editUseRclone');
const editRemote = document.getElementById('editRemote');
const editRemoteGroup = document.getElementById('editRemoteGroup');
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
addJobBtn.addEventListener('click', showFormSection);
cancelFormBtn.addEventListener('click', hideFormSection);
jobForm.addEventListener('submit', handleCreateBackup);
frequency.addEventListener('change', handleFrequencyChange);

// Settings menu dropdown
const settingsMenu = document.getElementById('settingsMenu');
const settingsLink = document.getElementById('settingsLink');
settingsBtn.addEventListener('click', toggleSettingsMenu);
settingsLink.addEventListener('click', openSettingsModal);
settingsClose.addEventListener('click', closeSettingsModal);
cancelSettingsBtn.addEventListener('click', closeSettingsModal);
addPatternBtn.addEventListener('click', addIgnorePattern);

// Restore button and modal
restoreBtn.addEventListener('click', openRestoreModal);
restoreClose.addEventListener('click', closeRestoreModal);
restoreCloseBtn.addEventListener('click', closeRestoreModal);
restoreLabelNextBtn.addEventListener('click', handleRestoreLabelSelect);
restoreBackupBtn.addEventListener('click', handleRestoreBackup);
restoreBackBtn.addEventListener('click', handleRestoreBack);

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.menu-container')) {
        settingsMenu.classList.add('hidden');
    }
});

// Form input handlers
useRclone.addEventListener('change', handleRcloneToggle);
editUseRclone.addEventListener('change', handleEditRcloneToggle);

// Other event listeners
settingsForm.addEventListener('submit', handleSaveSettings);
backupNameSchema.addEventListener('input', updateSchemaPreview);

editFrequency.addEventListener('change', handleEditFrequencyChange);
editForm.addEventListener('submit', handleEditBackup);
closeModalBtn.addEventListener('click', closeEditModal);
cancelEditBtn.addEventListener('click', closeEditModal);

// Initialize
async function initialize() {
    try {
        // Load settings from backend
        const settingsResponse = await fetch('/api/settings');
        if (settingsResponse.ok) {
            const backendSettings = await settingsResponse.json();
            applyThemeSettings(backendSettings);
        }
    } catch (err) {
        console.log('Note: Settings will use defaults. Backend settings not available yet.');
    }
    
    loadAndDisplayJobs();
}

initialize();

// Toggle settings menu dropdown
function toggleSettingsMenu() {
    settingsMenu.classList.toggle('hidden');
}

// Close settings menu
function closeSettingsMenu() {
    settingsMenu.classList.add('hidden');
}

// Show form section
function showFormSection() {
    formSection.classList.remove('hidden');
    formSection.scrollIntoView({ behavior: 'smooth' });
}

// Hide form section
function hideFormSection() {
    formSection.classList.add('hidden');
    jobForm.reset();
    remoteGroup.classList.add('hidden');
    customCronGroup.classList.add('hidden');
}

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

// Handle rclone toggle
function handleRcloneToggle() {
    if (useRclone.checked) {
        remoteGroup.classList.remove('hidden');
        remote.required = true;
    } else {
        remoteGroup.classList.add('hidden');
        remote.required = false;
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

// Handle edit rclone toggle
function handleEditRcloneToggle() {
    if (editUseRclone.checked) {
        editRemoteGroup.classList.remove('hidden');
        editRemote.required = true;
    } else {
        editRemoteGroup.classList.add('hidden');
        editRemote.required = false;
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
        jobsList.innerHTML = `
            <table class="jobs-table">
                <thead>
                    <tr>
                        <th>Backup Label</th>
                        <th>Frequency</th>
                        <th>Schedule</th>
                        <th>Rclone</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td colspan="6" style="text-align: center; padding: 40px; color: #999;">
                            No backup jobs scheduled yet. Click "Add a Backup Job" to create one.
                        </td>
                    </tr>
                </tbody>
            </table>
        `;
        return;
    }

    const tableRows = jobs.map(job => `
        <tr class="${job.enabled ? '' : 'disabled-row'}">
            <td><strong>${escapeHtml(job.backupLabel)}</strong></td>
            <td>${escapeHtml(job.frequency)}</td>
            <td><code>${escapeHtml(job.schedule)}</code></td>
            <td>
                <span class="rclone-badge ${job.useRclone ? 'rclone-yes' : 'rclone-no'}">
                    ${job.useRclone ? '✓ ' + escapeHtml(job.remote) : '✗ None'}
                </span>
            </td>
            <td>
                <span class="status-badge ${job.enabled ? 'status-enabled' : 'status-disabled'}">
                    ${job.enabled ? '✓ Enabled' : '✗ Disabled'}
                </span>
            </td>
            <td class="actions-cell">
                <button class="btn-sm btn-run" onclick="manualRunBackup('${job.id}')">Run</button>
                <button class="btn-sm btn-edit" onclick="openEditModal('${job.id}')">Edit</button>
                <button class="btn-sm btn-toggle" onclick="toggleJob('${job.id}')">
                    ${job.enabled ? 'Disable' : 'Enable'}
                </button>
                <button class="btn-sm btn-delete" onclick="deleteJob('${job.id}')">Delete</button>
            </td>
        </tr>
    `).join('');

    jobsList.innerHTML = `
        <table class="jobs-table">
            <thead>
                <tr>
                    <th>Backup Label</th>
                    <th>Frequency</th>
                    <th>Schedule</th>
                    <th>Rclone</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>
    `;
}

// Handle create backup
async function handleCreateBackup(e) {
    e.preventDefault();

    // Validate remote field if rclone is enabled
    if (useRclone.checked && !remote.value.trim()) {
        alert('Please enter an rclone remote name');
        return;
    }

    const freq = frequency.value;
    const schedule = getScheduleFromFrequency(freq, customCronInput.value);

    const jobData = {
        backupLabel: backupLabel.value,
        frequency: freq,
        schedule: schedule,
        enabled: enabledCheckbox.checked,
        useRclone: useRclone.checked,
        remote: useRclone.checked ? remote.value : ''
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
        remoteGroup.classList.add('hidden');
        customCronGroup.classList.add('hidden');
        enabledCheckbox.checked = true;

        // Reload jobs and hide form
        loadAndDisplayJobs();
        hideFormSection();
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
        editUseRclone.checked = job.useRclone || false;
        editRemote.value = job.remote || '';

        if (job.frequency === 'custom') {
            editCustomCronInput.value = job.schedule;
            editCustomCronGroup.classList.remove('hidden');
        } else {
            editCustomCronGroup.classList.add('hidden');
        }

        if (job.useRclone) {
            editRemoteGroup.classList.remove('hidden');
        } else {
            editRemoteGroup.classList.add('hidden');
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

    // Validate rclone remote if rclone is enabled
    if (editUseRclone.checked && !editRemote.value.trim()) {
        alert('Please enter an rclone remote name');
        return;
    }

    const jobData = {
        backupLabel: editBackupLabel.value,
        frequency: freq,
        schedule: schedule,
        enabled: editEnabled.checked,
        useRclone: editUseRclone.checked,
        remote: editUseRclone.checked ? editRemote.value : ''
    };

    try {
        const response = await fetch(`${API_URL}/${editJobId.value}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(jobData)
        });

        if (!response.ok) throw new Error('Failed to update backup');

        closeEditModal();
        loadAndDisplayJobs();
    } catch (error) {
        console.error('Error updating backup:', error);
        alert('Failed to update backup: ' + error.message);
    }
}

// Close edit modal
function closeEditModal() {
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

// Manual run backup
async function manualRunBackup(jobId) {
    try {
        const response = await fetch(`/api/jobs/${jobId}/run`, {
            method: 'POST'
        });

        if (!response.ok) throw new Error('Failed to start backup');
        
        const result = await response.json();
        alert(`Backup started for job: ${result.label}\nCheck logs for progress.`);
    } catch (error) {
        console.error('Error running backup:', error);
        alert('Failed to start backup: ' + error.message);
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

// Settings functions
function loadSettings() {
    try {
        // Load from backend first
        fetch('/api/settings')
            .then(r => r.json())
            .then(settings => {
                backupNameSchema.value = settings.backupNameSchema || 'backup_{label}_{date}';
                
                // Load theme settings
                backgroundGradientStart.value = settings.backgroundGradientStart || '#1a1a2e';
                backgroundGradientEnd.value = settings.backgroundGradientEnd || '#16213e';
                
                // Load ignore patterns
                const patterns = settings.ignorePatterns || [];
                ignorePatternsList.innerHTML = '';
                patterns.forEach(pattern => {
                    if (pattern.trim()) {
                        renderIgnorePattern(pattern);
                    }
                });
                
                // Load rclone config
                if (settings.rcloneConfig) {
                    rcloneConfig.value = settings.rcloneConfig;
                }
                
                updateSchemaPreview();
            })
            .catch(() => {
                // Fallback to defaults if backend not ready
                backupNameSchema.value = 'backup_{label}_{date}';
                ignorePatternsList.innerHTML = '';
                updateSchemaPreview();
            });
    } catch (err) {
        console.log('Note: Settings will use defaults');
    }
}

function renderIgnorePattern(pattern) {
    const div = document.createElement('div');
    div.className = 'pattern-item';
    div.innerHTML = `
        <input type="text" value="${escapeHtml(pattern)}" class="pattern-input" placeholder="Enter regex pattern">
        <button type="button" class="pattern-delete-btn">Delete</button>
    `;
    
    const deleteBtn = div.querySelector('.pattern-delete-btn');
    deleteBtn.addEventListener('click', (e) => {
        e.preventDefault();
        div.remove();
    });
    
    ignorePatternsList.appendChild(div);
}

function addIgnorePattern(e) {
    if (e) e.preventDefault();
    renderIgnorePattern('');
}

function saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function applyThemeSettings(settings) {
    // Apply background gradient
    const startColor = settings.backgroundGradientStart || '#1a1a2e';
    const endColor = settings.backgroundGradientEnd || '#16213e';
    const backgroundStyle = `linear-gradient(135deg, ${startColor} 0%, ${endColor} 100%)`;
    document.body.style.background = backgroundStyle;
}

function updateSchemaPreview() {
    const schema = backupNameSchema.value;
    const preview = schema
        .replace('{label}', 'myvolume')
        .replace('{date}', '20251224')
        .replace('{time}', '1430')
        .replace('{timestamp}', '20251224_1430');
    schemaPreview.textContent = preview;
}

function openSettingsModal() {
    loadSettings(); // Reload settings when opening
    settingsModal.classList.remove('hidden');
    settingsModal.classList.add('visible');
    closeSettingsMenu(); // Close dropdown when opening modal
}

function closeSettingsModal() {
    settingsModal.classList.remove('visible');
    settingsModal.classList.add('hidden');
}

async function handleSaveSettings(e) {
    e.preventDefault();
    
    // Collect ignore patterns
    const patternInputs = document.querySelectorAll('.pattern-input');
    const ignorePatterns = Array.from(patternInputs)
        .map(input => input.value.trim())
        .filter(pattern => pattern.length > 0);
    
    const settings = {
        backupNameSchema: backupNameSchema.value,
        backgroundGradientStart: backgroundGradientStart.value,
        backgroundGradientEnd: backgroundGradientEnd.value,
        ignorePatterns: ignorePatterns,
        rcloneConfig: rcloneConfig.value
    };
    
    try {
        // Save to backend
        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });

        if (!response.ok) throw new Error('Failed to save settings');

        // Apply theme immediately
        applyThemeSettings(settings);
        
        // Also save to localStorage for UI state
        saveSettings(settings);
        closeSettingsModal();
        alert('Settings saved successfully!');
    } catch (error) {
        console.error('Error saving settings:', error);
        alert('Failed to save settings. Please try again.');
    }
}

// Restore Modal Functions
async function openRestoreModal() {
    try {
        const response = await fetch('/api/backups/labels');
        const labels = await response.json();
        
        // Populate label select
        restoreLabelSelect.innerHTML = '<option value="">-- Select a label --</option>';
        labels.forEach(item => {
            const option = document.createElement('option');
            option.value = JSON.stringify(item);
            option.textContent = item.label;
            restoreLabelSelect.appendChild(option);
        });
        
        // Show step 1
        restoreStep1.classList.remove('hidden');
        restoreStep2.classList.add('hidden');
        restoreModal.classList.remove('hidden');
        restoreModal.classList.add('visible');
    } catch (error) {
        console.error('Error opening restore modal:', error);
        alert('Failed to load backup labels');
    }
}

function closeRestoreModal() {
    restoreModal.classList.remove('visible');
    restoreModal.classList.add('hidden');
}

async function handleRestoreLabelSelect() {
    const selected = restoreLabelSelect.value;
    if (!selected) {
        alert('Please select a label');
        return;
    }
    
    const labelItem = JSON.parse(selected);
    
    try {
        let backups = [];
        
        if (labelItem.useRclone && labelItem.remote) {
            // Get backups from rclone remote
            const response = await fetch(`/api/backups/remote/${labelItem.label}/${labelItem.remote}`);
            backups = await response.json();
        } else {
            // Get backups from local filesystem
            const response = await fetch(`/api/backups/local/${labelItem.label}`);
            backups = await response.json();
        }
        
        // Populate backup select
        restoreBackupSelect.innerHTML = '<option value="">-- Select a backup --</option>';
        backups.forEach(backup => {
            const option = document.createElement('option');
            option.value = backup;
            option.textContent = backup;
            restoreBackupSelect.appendChild(option);
        });
        
        // Show step 2
        restoreStep1.classList.add('hidden');
        restoreStep2.classList.remove('hidden');
    } catch (error) {
        console.error('Error loading backups:', error);
        alert('Failed to load backups');
    }
}

function handleRestoreBack() {
    restoreStep1.classList.remove('hidden');
    restoreStep2.classList.add('hidden');
}

async function handleRestoreBackup() {
    const backupFile = restoreBackupSelect.value;
    if (!backupFile) {
        alert('Please select a backup');
        return;
    }
    
    const labelItem = JSON.parse(restoreLabelSelect.value);
    
    if (!confirm(`Are you sure you want to restore from ${backupFile}?\n\nThis will:\n1. Stop containers with label: ${labelItem.label}\n2. Clear existing volume contents\n3. Restore from backup\n\nProceed?`)) {
        return;
    }
    
    try {
        const response = await fetch('/api/restore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                label: labelItem.label,
                backupFile: backupFile,
                isRemote: labelItem.useRclone || false,
                remote: labelItem.remote || ''
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.details || error.error);
        }
        
        const result = await response.json();
        alert(`Restore completed successfully!\n\nLabel: ${result.label}`);
        closeRestoreModal();
    } catch (error) {
        console.error('Error restoring backup:', error);
        alert('Failed to restore backup: ' + error.message);
    }
}

// Auto-reload jobs every 10 seconds
setInterval(loadAndDisplayJobs, 10000);
