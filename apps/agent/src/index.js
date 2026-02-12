require('dotenv').config();
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
const AGENT_TOKEN = process.env.AGENT_ACCESS_TOKEN || 'default-token';
const POLL_INTERVAL = 5000;

console.log('Starting Local Agent...');
console.log(`Connecting to: ${API_URL}`);

async function pollForJobs() {
    try {
        // In a real scenario, this would poll the server for jobs
        // For now, we just log that we are alive
        console.log(`[${new Date().toISOString()}] Polling for jobs...`);

        // Example:
        // const response = await axios.get(`${API_URL}/agent/jobs`, {
        //   headers: { 'Authorization': `Bearer ${AGENT_TOKEN}` }
        // });
        // if (response.data.jobs.length > 0) { processJobs(response.data.jobs); }

    } catch (error) {
        console.error('Error polling for jobs:', error.message);
    }
}

// Start polling
setInterval(pollForJobs, POLL_INTERVAL);
console.log('Agent is ready and polling.');
