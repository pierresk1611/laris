require('dotenv').config();
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

const os = require('os');

const { exec } = require('child_process');

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
const AGENT_TOKEN = process.env.AGENT_ACCESS_TOKEN || 'default-token';
const POLL_INTERVAL = 5000;

console.log('Starting Local Agent...');
console.log(`Connecting to: ${API_URL}`);

async function sendHeartbeat() {
    try {
        await axios.post(`${API_URL}/agent/heartbeat`, {
            version: '1.0.0',
            os: os.platform(),
            status: 'ONLINE'
        }, {
            headers: { 'Authorization': `Bearer ${AGENT_TOKEN}` }
        });
        console.log(`[${new Date().toISOString()}] Heartbeat sent.`);
    } catch (error) {
        console.error('Heartbeat failed:', error.message);
    }
}

async function processJob(job) {
    console.log(`Processing job: ${job.type} (${job.id})`);

    if (job.type === 'LOAD_LAYERS') {
        const scriptPath = path.join(__dirname, '../scripts/extractLayers.jsx');
        const osaCommand = `osascript -e 'tell application "Adobe Photoshop 2024" to do javascript (file "${scriptPath}")'`;

        exec(osaCommand, async (error, stdout, stderr) => {
            if (error) {
                console.error(`PS Error: ${error.message}`);
                return updateJobStatus(job.id, 'ERROR', { error: error.message });
            }

            // Script writes to Folder.temp + "/ps_layers.json"
            const tempFile = path.join(os.tmpdir(), 'ps_layers.json');
            if (await fs.exists(tempFile)) {
                const layers = await fs.readJson(tempFile);
                await updateJobStatus(job.id, 'SUCCESS', { layers });
            } else {
                await updateJobStatus(job.id, 'ERROR', { error: 'Temp file not found' });
            }
        });
    }
}

async function updateJobStatus(id, status, result) {
    try {
        await axios.patch(`${API_URL}/agent/jobs`, { id, status, result }, {
            headers: { 'Authorization': `Bearer ${AGENT_TOKEN}` }
        });
        console.log(`Job ${id} updated to ${status}`);
    } catch (error) {
        console.error(`Failed to update job ${id}:`, error.message);
    }
}

async function pollForJobs() {
    try {
        await sendHeartbeat();
        console.log(`[${new Date().toISOString()}] Polling for jobs...`);

        const response = await axios.get(`${API_URL}/agent/jobs`, {
            headers: { 'Authorization': `Bearer ${AGENT_TOKEN}` }
        });

        if (response.data.success && response.data.jobs.length > 0) {
            for (const job of response.data.jobs) {
                await processJob(job);
            }
        }

    } catch (error) {
        if (error.response && error.response.status === 404) {
            // API not fully ready or route missing
        } else {
            console.error('Error in agent loop:', error.message);
        }
    }
}

// Start polling
setInterval(pollForJobs, POLL_INTERVAL);
console.log('Agent is ready and polling.');
