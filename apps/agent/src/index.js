require('dotenv').config();
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

// Configuration
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
const AGENT_TOKEN = process.env.AGENT_ACCESS_TOKEN;
const LOCAL_ROOT_PATH = process.env.LOCAL_ROOT_PATH;
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '10000', 10);
const PHOTOSHOP_APP_NAME = process.env.PHOTOSHOP_APP_NAME || 'Adobe Photoshop 2024';

console.log('--- AUTO DESIGN LOCAL AGENT v2.1 (Layer Scan Enabled) ---');
console.log(`API URL: ${API_URL}`);
console.log(`Root Path: ${LOCAL_ROOT_PATH}`);
console.log(`Poll Interval: ${POLL_INTERVAL}ms`);

if (!AGENT_TOKEN || !LOCAL_ROOT_PATH) {
    console.error('CRITICAL ERROR: Missing AGENT_ACCESS_TOKEN or LOCAL_ROOT_PATH in .env');
    process.exit(1);
}

const { getDropboxClient } = require('./lib/dropbox');

// State
let isProcessing = false;

// --- API FUNCTIONS ---

async function sendHeartbeat() {
    try {
        await axios.post(`${API_URL}/agent/heartbeat`, {
            version: '2.1.0',
            os: os.platform(), // 'darwin' for macOS
            status: isProcessing ? 'BUSY' : 'IDLE',
            hostname: os.hostname()
        }, {
            headers: { 'Authorization': `Bearer ${AGENT_TOKEN}` }
        });
        // Heartbeat successful, silent success
    } catch (error) {
        console.error(`Heartbeat Error: ${error.message}`);
    }
}

async function fetchPendingJob() {
    try {
        const response = await axios.get(`${API_URL}/agent/jobs`, {
            params: { status: 'PENDING' },
            headers: { 'Authorization': `Bearer ${AGENT_TOKEN}` }
        });

        if (response.data.success && response.data.jobs && response.data.jobs.length > 0) {
            return response.data.jobs[0]; // Process one at a time
        }
    } catch (error) {
        if (error.response && error.response.status !== 404) {
            console.error(`Fetch Job Error: ${error.message}`);
        }
    }
    return null;
}

// --- JOB PROCESSING ---

async function processJob(job) {
    isProcessing = true;
    console.log(`\n[Job ${job.id}] Starting processing... Type: ${job.type}`);

    // 1. Mark as PROCESSING
    await updateJobStatus(job.id, 'PROCESSING', { message: 'Agent started processing' });

    try {
        if (job.type === 'SCAN_LAYERS') {
            await processLayerScan(job);
        } else {
            // Default to Photoshop for RENDER_PSD, MERGE_SHEET, etc.
            await processPhotoshopJob(job);
        }
    } catch (error) {
        console.error(`[Job ${job.id}] FAILED: ${error.message}`);
        await updateJobStatus(job.id, 'ERROR', { error: error.message });
    } finally {
        isProcessing = false;
    }
}

// --- LAYER SCAN (Node.js native) ---
async function processLayerScan(job) {
    const { readPsd } = require('ag-psd');
    // require('ag-psd/initialize-canvas')(require('canvas')); // Not needed for metadata scan

    try {
        // job.payload.path should be the relative path from Dropbox root? or Database Key?
        // Usually Inbox items have 'path' field which is Dropbox path display.
        // E.g. /TEMPLATES/8.ai

        console.log(`[Job ${job.id}] Scanning layers for: ${job.payload.path}`);

        // 1. Download file from Dropbox
        const dbx = await getDropboxClient();

        const response = await dbx.filesDownload({ path: job.payload.path });

        // binary data is in response.result.fileBinary if using certain SDK versions/environments.
        // In Node with 'dropbox' standard lib, it might be in 'fileBinary' or just returned buffer?
        // Checking sdk docs or usage: usually result.fileBinary in Node.

        const fileBuffer = response.result.fileBinary || response.result.fileBlob;

        if (!fileBuffer) {
            // Fallback for some SDK versions where it returns buffer directly or differently
            // Actually, newer dropbox sdk in node returns valid response with fileBinary
            throw new Error("Failed to download file content from Dropbox (No binary data)");
        }

        // 2. Parse PSD/AI
        const psd = readPsd(fileBuffer, { skipLayerImageData: true, skipThumbnail: true });

        // 3. Extract Layers
        const layers = [];
        const traverse = (node) => {
            if (node.children) {
                node.children.forEach(traverse);
            }
            if (node.name) {
                layers.push(node.name);
            }
        };

        if (psd.children) {
            psd.children.forEach(traverse);
        }

        console.log(`[Job ${job.id}] Layers found: ${layers.length} layers.`);

        // 4. Success
        await updateJobStatus(job.id, 'DONE', {
            layers: layers,
            width: psd.width,
            height: psd.height
        });

    } catch (error) {
        console.error(`[ScanLayer] Error:`, error);
        throw error;
    }
}

// --- PHOTOSHOP JOBS (Legacy) ---
async function processPhotoshopJob(job) {
    // 2. Validate Files & Paths
    const jobId = job.id;
    const payloadData = job.payload || job.data || {}; // Handle both naming conventions
    const orderId = job.orderId || (payloadData.orders && payloadData.orders[0]?.id);
    const crmId = payloadData.orders && payloadData.orders[0]?.crmId;
    const customerSafe = (payloadData.customerName || 'Customer').replace(/[^a-zA-Z0-9]/g, '');

    // Date Paths
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dayPath = path.join(LOCAL_ROOT_PATH, 'OUTPUT', `${year}`, `${month}`, `${day}`);

    await fs.ensureDir(dayPath);

    // Smart Folder Search
    let jobDirName = `Order_${orderId}_${customerSafe}`;

    try {
        const potentialFolders = await fs.readdir(dayPath);
        const found = potentialFolders.find(f => {
            if (!f.toLowerCase().includes('order') && !f.match(/^\d/)) return false; // meaningful folders
            return f.includes(String(orderId)) || (crmId && f.includes(String(crmId)));
        });

        if (found) {
            console.log(`[Job ${job.id}] Found existing folder: ${found}`);
            jobDirName = found;
        }
    } catch (e) {
        console.warn("Folder search failed, using default name.", e);
    }

    // OUTPUT PATH
    const outputDir = path.join(dayPath, jobDirName);
    await fs.ensureDir(outputDir);
    console.log(`[Job ${job.id}] Output dir: ${outputDir}`);

    // 3. Create Payload for Photoshop
    if (!job.data || !job.data.items) {
        console.warn("[PhotoshopJob] Warning: job.data.items is missing. This might cause script failure.");
    }

    const payload = {
        jobId: job.id,
        orderId: job.orderId,
        outputDir: outputDir,
        items: (job.data.items || []).map(item => ({
            id: item.id,
            templatePath: path.join(LOCAL_ROOT_PATH, item.template_rel_path),
            data: item.data,
            config: item.export_config || {}
        }))
    };

    // Write payload to temp
    const payloadPath = path.join(os.tmpdir(), `job_${job.id}.json`);
    await fs.writeJson(payloadPath, payload);
    console.log(`[Job ${job.id}] Payload written to: ${payloadPath}`);

    // 4. Trigger Photoshop Script
    const scriptPath = path.join(__dirname, '../scripts/generator.jsx');
    if (!await fs.exists(scriptPath)) {
        throw new Error(`Generator script not found at ${scriptPath}`);
    }

    console.log(`[Job ${job.id}] Launching Photoshop...`);

    const wrapperScriptPath = path.join(os.tmpdir(), `run_job_${job.id}.jsx`);
    const wrapperContent = `
        #include "${scriptPath}"
        main("${payloadPath.replace(/\\/g, '\\\\')}"); 
    `;
    await fs.writeFile(wrapperScriptPath, wrapperContent);

    // Execute
    const command = `open -a "${PHOTOSHOP_APP_NAME}" "${wrapperScriptPath}"`;
    exec(command);

    // 5. Watch for Completion
    const resultFile = path.join(os.tmpdir(), `result_${job.id}.json`);
    const errorFile = path.join(os.tmpdir(), `error_${job.id}.json`);

    console.log(`[Job ${job.id}] Waiting for Photoshop to finish...`);

    const result = await waitForFile(resultFile, errorFile, 120000); // 2 min timeout

    if (result.status === 'ERROR') {
        throw new Error(result.message);
    }

    // 6. Success
    console.log(`[Job ${job.id}] Photoshop finished successfully.`);
    await updateJobStatus(job.id, 'DONE', {
        files: result.files,
        outputDir: outputDir
    });

    // Cleanup
    await fs.remove(payloadPath);
    await fs.remove(wrapperScriptPath);
    await fs.remove(resultFile);
}

async function updateJobStatus(id, status, result) {
    try {
        await axios.patch(`${API_URL}/agent/jobs`, { id, status, result }, {
            headers: { 'Authorization': `Bearer ${AGENT_TOKEN}` }
        });
    } catch (error) {
        console.error(`API Update Failed: ${error.message}`);
    }
}

// Helper: Poll for file existence
function waitForFile(successPath, errorPath, timeoutMs) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const interval = setInterval(async () => {
            if (Date.now() - startTime > timeoutMs) {
                clearInterval(interval);
                resolve({ status: 'ERROR', message: 'Timeout waiting for Photoshop' });
            }

            if (await fs.exists(successPath)) {
                clearInterval(interval);
                const data = await fs.readJson(successPath);
                resolve({ status: 'SUCCESS', ...data });
            }

            if (await fs.exists(errorPath)) {
                clearInterval(interval);
                const data = await fs.readJson(errorPath);
                resolve({ status: 'ERROR', message: data.message });
            }
        }, 1000);
    });
}

// --- MAIN LOOP ---

async function main() {
    console.log('Agent Loop Started.');

    // Initial heartbeat
    await sendHeartbeat();

    // Initialize Dropbox (fetch config)
    try {
        await getDropboxClient();
        console.log("✅ Agent initialized (Dropbox Connected)");
    } catch (e) {
        console.warn("⚠️  Dropbox initialization failed (will retry on job):", e.message);
    }

    setInterval(async () => {
        if (isProcessing) return; // Busy

        await sendHeartbeat(); // Keep alive

        const job = await fetchPendingJob();
        if (job) {
            await processJob(job);
        }
    }, POLL_INTERVAL);
}

main();
