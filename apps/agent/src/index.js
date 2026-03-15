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
const ILLUSTRATOR_APP_NAME = process.env.ILLUSTRATOR_APP_NAME || 'Adobe Illustrator 2024';

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
            params: { status: 'PENDING', type: 'STATUS_PRINT_READY' },
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
        } else if (job.type === 'SYSTEM_SCAN') {
            const { processSystemScan } = require('./lib/system-scan');
            await processSystemScan(job);
        } else if (job.type === 'MERGE_SHEET') {
            await processMergeSheet(job);
        } else {
            // Default to Photoshop for RENDER_PSD, etc.
            await processPhotoshopJob(job);
        }
    } catch (error) {
        console.error(`[Job ${job.id}] FAILED: ${error.message}`);
        await updateJobStatus(job.id, 'ERROR', { error: error.message });
    } finally {
        isProcessing = false;
    }
}


// --- LAYER SCAN (Node.js native for PSD, App-based for AI) ---
async function processLayerScan(job) {
    const filePath = job.payload.path;
    const isAi = filePath.toLowerCase().endsWith('.ai');

    if (isAi) {
        return processIllustratorLayerScan(job);
    }

    // Default PSD logic
    const { readPsd } = require('ag-psd');
    try {
        console.log(`[Job ${job.id}] Scanning PSD layers (ag-psd) for: ${filePath}`);
        const dbx = await getDropboxClient();
        const response = await dbx.filesDownload({ path: filePath });
        const fileBuffer = response.result.fileBinary || response.result.fileBlob;

        if (!fileBuffer) {
            throw new Error("Failed to download file content from Dropbox (No binary data)");
        }

        const psd = readPsd(fileBuffer, { skipLayerImageData: true, skipThumbnail: true });
        const layers = [];
        const traverse = (node) => {
            if (node.children) node.children.forEach(traverse);
            if (node.name) layers.push({ name: node.name, type: node.type === 'TEXT' ? 'TEXT' : 'OTHER' });
        };

        if (psd.children) psd.children.forEach(traverse);

        await updateJobStatus(job.id, 'DONE', {
            layers: layers,
            width: psd.width,
            height: psd.height
        });

    } catch (error) {
        console.error(`[ScanLayer PSD] Error:`, error);
        throw error;
    }
}

async function processIllustratorLayerScan(job) {
    const filePath = job.payload.path;
    const localPath = path.join(LOCAL_ROOT_PATH, filePath);

    console.log(`[Job ${job.id}] Scanning AI layers (Illustrator) for: ${filePath}`);

    // Check if file exists locally (Dropbox sync) or download it
    let finalLocalPath = localPath;
    if (!await fs.exists(localPath)) {
        console.log(`[Job ${job.id}] File not found locally, downloading...`);
        const dbx = await getDropboxClient();
        const response = await dbx.filesDownload({ path: filePath });
        const tempPath = path.join(os.tmpdir(), path.basename(filePath));
        await fs.writeFile(tempPath, response.result.fileBinary);
        finalLocalPath = tempPath;
    }

    const scriptPath = path.join(__dirname, '../scripts/extractLayersIllustrator.jsx');
    const resultFile = path.join(os.tmpdir(), "ai_layers.json");
    if (await fs.exists(resultFile)) await fs.remove(resultFile);

    // AppleScript to open file and run JSX
    const appleScript = `
        tell application "${ILLUSTRATOR_APP_NAME}"
            activate
            open posix file "${finalLocalPath}"
            do javascript file "${scriptPath}"
            close every document saving no
        end tell
    `;

    try {
        await new Promise((resolve, reject) => {
            exec(`osascript -e '${appleScript}'`, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Read Result JSON
        const result = await waitForFile(resultFile, null, 30000);
        if (result.status === 'ERROR') throw new Error("Illustrator script failed");

        // Upload AI preview if it was generated
        let previewPath = null;
        const previewFile = path.join(os.tmpdir(), "ai_preview.jpg");
        if (await fs.exists(previewFile)) {
            console.log(`[Job ${job.id}] Uploading AI preview to Dropbox...`);
            const dbx = await getDropboxClient();
            const dropboxPreviewPath = `/PREVIEWS/${path.basename(filePath, '.ai')}_preview.jpg`;
            await dbx.filesUpload({
                path: dropboxPreviewPath,
                contents: await fs.readFile(previewFile),
                mode: 'overwrite'
            });

            try {
                const linkRes = await dbx.sharingCreateSharedLinkWithSettings({ path: dropboxPreviewPath });
                previewPath = linkRes.result.url.replace('dl=0', 'raw=1');
            } catch (e) {
                if (e.error && e.error.error_summary && e.error.error_summary.includes('shared_link_already_exists')) {
                    const links = await dbx.sharingListSharedLinks({ path: dropboxPreviewPath });
                    if (links.result.links.length > 0) {
                        previewPath = links.result.links[0].url.replace('dl=0', 'raw=1');
                    }
                }
            }
            await fs.remove(previewFile);
        }

        await updateJobStatus(job.id, 'DONE', {
            layers: result, // result is the parsed JSON array
            isAi: true,
            previewUrl: previewPath
        });

        // Cleanup temp if downloaded
        if (finalLocalPath !== localPath) await fs.remove(finalLocalPath);
        await fs.remove(resultFile);

    } catch (error) {
        console.error(`[ScanLayer AI] Error:`, error);
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
        try {
            main("${payloadPath.replace(/\\/g, '\\\\')}"); 
        } catch(e) {
            var f = new File("${payloadPath.replace(/\\/g, '\\\\')}".replace("job_", "error_"));
            f.open("w"); f.write(JSON.stringify({status:"ERROR", message: e.toString()})); f.close();
        }
    `;
    await fs.writeFile(wrapperScriptPath, wrapperContent);

    // AppleScript Protective Cleanup (Closes any open document to prevent conflicts)
    console.log(`[Job ${job.id}] Cleaning up workspace (Closing any open documents)...`);
    const appleScript = `
        try
            tell application "${PHOTOSHOP_APP_NAME}"
                if it is running then
                    close every document saving no
                end if
            end tell
        end try
    `;

    try {
        await new Promise((resolve) => {
            exec(`osascript -e '${appleScript}'`, (err) => {
                // Ignore errors (e.g., if PS is busy or has a modal, it might fail, but we try)
                resolve();
            });
        });
    } catch (e) { }

    // Execute
    console.log(`[Job ${job.id}] Executing task: Spracovávam ${payload.items.length} položiek...`);
    payload.items.forEach((it, idx) => {
        console.log(`  -> Položka ${idx + 1} z ${payload.items.length}: ${it.id}`);
    });

    const command = `open -a "${PHOTOSHOP_APP_NAME}" "${wrapperScriptPath}"`;
    exec(command);

    // 5. Watch for Completion
    const resultFile = path.join(os.tmpdir(), `result_${job.id}.json`);
    const errorFile = path.join(os.tmpdir(), `error_${job.id}.json`);

    console.log(`[Job ${job.id}] Waiting for Photoshop to finish (Timeout: 2 mins)...`);

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

// --- MERGE SHEET JOB ---
async function processMergeSheet(job) {
    const payloadData = job.payload || job.data || {};
    const jobId = job.id;

    console.log(`[Job ${jobId}] Preparing Sheet Imposition...`);

    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dayPath = path.join(LOCAL_ROOT_PATH, 'OUTPUT', `${year}`, `${month}`, `${day}`);

    const outputDir = path.join(dayPath, `Batches`);
    await fs.ensureDir(outputDir);

    const ordersWithPaths = [];
    for (const order of payloadData.orders || []) {
        let orderDir = null;
        try {
            const potentialFolders = await fs.readdir(dayPath);
            const found = potentialFolders.find(f => {
                if (!f.toLowerCase().includes('order') && !f.match(/^\d/)) return false;
                return f.includes(String(order.id)) || (order.crmId && f.includes(String(order.crmId)));
            });
            if (found) orderDir = path.join(dayPath, found);
        } catch (e) { }

        let pdfPath = null;
        if (orderDir) {
            const files = await fs.readdir(orderDir);
            const printFile = files.find(f => f.endsWith('_Print.pdf') || f.endsWith('_CMYK.pdf') || f.endsWith('_METAL.pdf'));
            if (printFile) {
                pdfPath = path.join(orderDir, printFile);
            }
        }

        ordersWithPaths.push({
            ...order,
            pdfPath: pdfPath,
            quantity: 1 // Print Manager duplicates the rects in layout, we just place it once per order object passed or let Photoshop loop over layout boxes. Wait, the layout has multiple boxes.
        });
    }

    const payload = {
        jobId: job.id,
        outputDir: outputDir,
        layout: payloadData.layout,
        sheetFormat: payloadData.sheetFormat,
        orders: ordersWithPaths
    };

    const payloadPath = path.join(os.tmpdir(), `job_${job.id}.json`);
    await fs.writeJson(payloadPath, payload);

    const scriptPath = path.join(__dirname, '../scripts/merge_sheet.jsx');
    const wrapperScriptPath = path.join(os.tmpdir(), `run_job_${job.id}.jsx`);
    const wrapperContent = `
        #include "${scriptPath.replace(/\\/g, '\\\\')}"
        try {
            main("${payloadPath.replace(/\\/g, '\\\\')}"); 
        } catch(e) {
            var f = new File("${payloadPath.replace(/\\/g, '\\\\')}".replace("job_", "error_"));
            f.open("w"); f.write(JSON.stringify({status:"ERROR", message: e.toString()})); f.close();
        }
    `;
    await fs.writeFile(wrapperScriptPath, wrapperContent);

    const appleScript = `
        try
            tell application "${PHOTOSHOP_APP_NAME}"
                if it is running then
                    close every document saving no
                end if
            end tell
        end try
    `;
    try {
        await new Promise((resolve) => {
            exec(`osascript -e '${appleScript}'`, resolve);
        });
    } catch (e) { }

    exec(`open -a "${PHOTOSHOP_APP_NAME}" "${wrapperScriptPath}"`);

    const resultFile = path.join(os.tmpdir(), `result_${job.id}.json`);
    const errorFile = path.join(os.tmpdir(), `error_${job.id}.json`);
    const result = await waitForFile(resultFile, errorFile, 120000);

    if (result.status === 'ERROR') throw new Error(result.message);

    await updateJobStatus(job.id, 'DONE', {
        files: result.files,
        outputDir: outputDir
    });

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
