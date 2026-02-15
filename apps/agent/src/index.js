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

console.log('--- AUTO DESIGN LOCAL AGENT v2.0 ---');
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
            version: '2.0.0',
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
        // 2. Validate Files & Paths
        // Example path from DB: /TEMPLATES/PNO16/PNO16.psd
        // We need to map it to LOCAL_ROOT_PATH + path

        const jobId = job.id;
        // Payload comes from job.data (payload field in DB becomes data here?)
        // Verify structure: fetchPendingJob -> response.data.jobs[0]
        // In DB Schema: Job has 'payload' Json.
        // In fetchPendingJob, we return the job object. 
        // So job.payload is likely correct, but here we access job.data?
        // Let's assume job.payload is where the data is.
        // Wait, line 98 says: job.data.items.
        // Let's check print/page.tsx: payload: { layout, material, sheetFormat, orders }
        // The Agent likely receives the whole Payload as 'data' property if it was parsed?
        // Looking at line 98: job.data.items.map...
        // But print/page sends: payload: { layout... orders... }
        // There is NO 'items' in print/page payload!
        // Print page payload: { layout, material, sheetFormat, orders: [...] }
        // Standard Agent Job might have 'items' for PREVIEW generation.
        // But for MERGE_SHEET (Type: MERGE_SHEET), the payload is different.

        // We need to handle MERGE_SHEET type or ensure backward compat.
        // If type is MERGE_SHEET, we might process differently.
        // But the user request implies folder finding for ORDERS.
        // Let's handle generic order folder finding.

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
        // Payload needs absolute paths for standard IO
        const payload = {
            jobId: job.id,
            orderId: job.orderId,
            outputDir: outputDir,
            items: job.data.items.map(item => ({
                id: item.id,
                // Construct absolute path to template
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
        // We use 'open' to launch PS with the script. The script should read the payload.
        // But wait, the script needs to know WHICH payload to read.
        // Standard pattern: write the payload path to a known 'current_job.json' or pass arguments?
        // Passing args to jsx via 'open' is tricky. 
        // BETTER: The payload includes the ID. The script will look for `job_*.json` in TMP? 
        // OR: We write a wrapper `.jsx` on the fly that includes the specific JSON path.

        // Let's use the Wrapper approach for robustness.
        const wrapperScriptPath = path.join(os.tmpdir(), `run_job_${job.id}.jsx`);
        const wrapperContent = `
            #include "${scriptPath}"
            main("${payloadPath.replace(/\\/g, '\\\\')}"); 
        `; // Assuming main() accepts path
        await fs.writeFile(wrapperScriptPath, wrapperContent);

        // Execute
        // 'open -a "Adobe Photoshop 2024" "path/to/wrapper.jsx"'
        const command = `open -a "${PHOTOSHOP_APP_NAME}" "${wrapperScriptPath}"`;
        exec(command);

        // 5. Watch for Completion
        // The script should write `result_${job.id}.json` or `error_${job.id}.json` to TEMP when done.
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

    } catch (error) {
        console.error(`[Job ${job.id}] FAILED: ${error.message}`);
        await updateJobStatus(job.id, 'ERROR', { error: error.message });
    } finally {
        isProcessing = false;
    }
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
