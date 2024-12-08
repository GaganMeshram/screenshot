const express = require("express");
const multer = require("multer");
const puppeteer = require("puppeteer");
const xlsx = require("xlsx");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const archiver = require("archiver"); // For zipping folders

// Setup Express and Server
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Configure file upload
const upload = multer({ dest: "uploads/" });

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));

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

// Function to handle Puppeteer screenshot process
const captureScreenshots = async (urlPairs, socket) => {
  const desktopViewPort = { width: 1440, height: 900 };

  // Create directories for saving screenshots
  const now = new Date();
  const folderName = now.toISOString().replace(/:/g, "-");
  const baseDir = path.join(__dirname, "screenshots", folderName);
  const enDir = path.join(baseDir, "EN");
  const esDir = path.join(baseDir, "ES");

  fs.mkdirSync(enDir, { recursive: true });
  fs.mkdirSync(esDir, { recursive: true });

  const startTime = Date.now();

  for (const { enUrl, esUrl } of urlPairs) {
    try {
      if (enUrl) {
        const enFileName = enUrl.replace(/^https?:\/\//, "").replace(/\//g, "_") + ".png";
        const enPath = path.join(enDir, enFileName);

        socket.emit("log", `Capturing EN screenshot: ${enUrl}`);
        await takeScreenshot(enUrl, desktopViewPort, enPath);
      }

      if (esUrl) {
        const esFileName = esUrl.replace(/^https?:\/\//, "").replace(/\//g, "_") + ".png";
        const esPath = path.join(esDir, esFileName);

        socket.emit("log", `Capturing ES screenshot: ${esUrl}`);
        await takeScreenshot(esUrl, desktopViewPort, esPath);
      }
    } catch (error) {
      console.error(`Error capturing screenshot: ${error.message}`);
      socket.emit("log", `Error capturing screenshot: ${error.message}`);
    }
  }

  const endTime = Date.now();
  const timeTaken = ((endTime - startTime) / 60000).toFixed(2); // Time in seconds
  socket.emit("log", `Screenshot process completed in ${timeTaken} minutes.`);

  // Send zip file path to frontend for download
  const zipPath = await zipFolder(baseDir);
  socket.emit("zipReady", zipPath);
};

// Function to take a screenshot with Puppeteer
const takeScreenshot = async (url, viewPort, filePath) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.setViewport(viewPort);
  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    await page.screenshot({ path: filePath, fullPage: true });
  } finally {
    await browser.close();
  }
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

  io.once("connection", (socket) => {
    console.log("Client connected.");
    socket.emit("log", "Starting screenshot process...");
    captureScreenshots(urls, socket).catch((err) => {
      console.error(`Process error: ${err.message}`);
      socket.emit("log", `Process error: ${err.message}`);
    });
  });

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

// Start server
server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
