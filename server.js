const express = require("express");
const multer = require("multer");
const puppeteer = require("puppeteer");
const xlsx = require("xlsx");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const archiver = require("archiver");
const { stdout, stderr } = require("process");
require('dotenv').config()

// Setup Express and Server
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Configure file upload
const upload = multer({ dest: "uploads/" });

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));

// Track connected clients
let socketConnection = null;

io.on("connection", (socket) => {
  console.log("Client connected.");
  socketConnection = socket; // Save the socket instance for emitting logs
  socket.emit("log", "Connected to server.");
});

// Function to calculate the estimated time
const getEstimatedTime = (urlPairs) => {
  const estimatedTimePerURL = 50; // Assume 5 seconds per URL for all devices (adjust as needed)
  const numUrls = urlPairs.length;
  const numDevices = Object.keys(viewports).length; // 3 devices (desktop, tablet, mobile)
  const estimatedTime = numUrls * numDevices * estimatedTimePerURL; // In seconds
  return estimatedTime;
};

// const exec = require('child_process').exec
// exec('whereis google-chrome-stable', (err, stdout, stderr)=>{
//   if(err){
//     console.error('Error:', err);
//     return
//   }
//   console.log('Google chrome path:', stdout)
// })

// Function to read Excel file
const readExcelFile = (filePath) => {
  const workbook = xlsx.readFile(filePath);
  const sheet_name_list = workbook.SheetNames;
  const sheet = workbook.Sheets[sheet_name_list[0]];
  const data = xlsx.utils.sheet_to_json(sheet);
  return data.map((row) => ({
    enUrl: row.EN_URL,
    esUrl: row.ES_URL,
  }));
};

// Viewport configurations for desktop, mobile, and tablet
const viewports = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 812 },
};

// Function to wait for the page to fully load and close cookie dialogs
const ensurePageLoaded = async (page) => {
  await page.waitForSelector("body", { timeout: 60000 });
  await new Promise((resolve) => setTimeout(resolve, 3000)); // Stabilization delay

  await page.evaluate(() => {
    const unwantedSelectors = [
      ".ot-sdk-container",
      ".isi-experiencefragment.experiencefragment.aem-GridColumn.aem-GridColumn--default--12",
      ".cope-core-isi-header-bar.cope-core-isi-header-bar-Rybelsus-Consumer-ISI--Spanish",
    ];

    unwantedSelectors.forEach((selector) => {
      const element = document.querySelector(selector);
      if (element) element.remove();
    });
  });
};

// Function to take screenshots for desktop, tablet, and mobile views
const captureForAllViewports = async (url, dir, language) => {
  for (const [device, viewport] of Object.entries(viewports)) {
    const deviceDir = path.join(dir, device); // Create a subfolder for each device
    if (!fs.existsSync(deviceDir)) fs.mkdirSync(deviceDir, { recursive: true });

    const fileName = `${url
      .replace(/^https?:\/\//, "")
      .replace(/\//g, "_")}_${device}.png`;
    const filePath = path.join(deviceDir, fileName);

    if (socketConnection)
      socketConnection.emit(
        "log",
        `Capturing ${device} view for ${language}: ${url}`
      );
    await takeScreenshot(url, viewport, filePath);
  }
};

console.log('Env:', process.env.CHROME_EXECUTABLE_PATH)

// Function to take a screenshot with Puppeteer and ensure page loading
const takeScreenshot = async (url, viewport, filePath) => {
  const startTime = Date.now();

  const browser = await puppeteer.launch({
    // executablePath: process.env.CHROME_EXECUTABLE_PATH || '/usr/local/bin/chromium-browser',
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
     // Required for most cloud environments
  });
  const page = await browser.newPage();

  await page.setViewport(viewport);
  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    await ensurePageLoaded(page); // Ensure the page is loaded and unwanted elements are removed

    await page.screenshot({ path: filePath, fullPage: true });
    // Commented out for now, as requested.
    // if (socketConnection) socketConnection.emit("log", `Screenshot captured successfully for: ${url}`);
  } catch (error) {
    if (socketConnection)
      socketConnection.emit(
        "log",
        `Failed to capture screenshot for ${url}: ${error.message}`
      );
    console.error(`Failed to capture screenshot for ${url}:`, error);
  } finally {
    await browser.close();
  }

  const endTime = Date.now();
  return (endTime - startTime) / 1000; // Return the time taken in seconds
};

// Function to zip a folder
const zipFolder = (folderPath) => {
  const zipPath = folderPath + ".zip";
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip");

    output.on("close", () => resolve(zipPath));
    archive.on("error", (err) => reject(err));

    archive.pipe(output);
    archive.directory(folderPath, false);
    archive.finalize();
  });
};

// API endpoint to handle file upload and start process
app.post("/start", upload.single("file"), (req, res) => {
  const filePath = req.file.path;
  const urls = readExcelFile(filePath);

  if (socketConnection)
    socketConnection.emit("log", "Starting screenshot process...");

  (async () => {
    const folderName = `screenshots_${new Date()
      .toISOString()
      .replace(/:/g, "-")}`;
    const screenshotsDir = path.join(__dirname, folderName);
    const enDir = path.join(screenshotsDir, "EN");
    const esDir = path.join(screenshotsDir, "ES");

    // Create directories for EN and ES, as well as subfolders for devices
    fs.mkdirSync(enDir, { recursive: true });
    fs.mkdirSync(esDir, { recursive: true });

    // Get the estimated time
    const estimatedTime = getEstimatedTime(urls);
    if (socketConnection)
      socketConnection.emit(
        "log",
        `Estimated time: ${(estimatedTime * 2) / 60} minutes.`
      );

    const startTime = Date.now();

    // Process URLs for EN and ES
    for (const { enUrl, esUrl } of urls) {
      if (enUrl) await captureForAllViewports(enUrl, enDir, "EN");
      if (esUrl) await captureForAllViewports(esUrl, esDir, "ES");
    }

    const endTime = Date.now();
    const actualTime = ((endTime - startTime) / 60000).toFixed(2); // In seconds
    if (socketConnection)
      socketConnection.emit("log", `Actual time taken: ${actualTime} minutes.`);

    const zipPath = await zipFolder(screenshotsDir);
    if (socketConnection)
      socketConnection.emit(
        "log",
        `Process completed. <a href="/download?path=${zipPath}" target="_blank">Download Screenshots</a>`
      );
  })();

  res.send("Process started. Check the logs below.");
});

// API to serve the zipped screenshots
app.get("/download", (req, res) => {
  const zipPath = req.query.path;
  if (fs.existsSync(zipPath)) {
    res.download(zipPath, "screenshots.zip");
  } else {
    res.status(404).send("File not found.");
  }
});

const port = 3000;
// Start server
server.listen(port, () => {
  console.log(`Server running on ${port}`);
});
