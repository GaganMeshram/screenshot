const puppeteer = require("puppeteer");
const xlsx = require("xlsx");
const fs = require("fs");
const path = require("path");

// Read URLs from Excel file
const readExcelFile = (filePath) => {
  const workbook = xlsx.readFile(filePath);
  const sheet_name_list = workbook.SheetNames;
  const sheet = workbook.Sheets[sheet_name_list[0]];
  const data = xlsx.utils.sheet_to_json(sheet);
  return data.map((row) => row.URL); // Assumes the URL is under a column named 'URL'
};

// Function to wait for the page to fully load and close cookie dialogs
const ensurePageLoaded = async (page) => {
  // Wait for the body to load
  await page.waitForSelector("body", { timeout: 60000 });

  // Wait for any network activity to finish
  await new Promise((resolve) => setTimeout(resolve, 3000)); // Give the page some extra time to stabilize

  // Try to close cookie consent dialogs and remove specific elements
  await page.evaluate(() => {
    const cookieSelectors = [
      'div[role="alertdialog"]', // Generic dialog
      "div#onetrust-banner-sdk", // ID for cookie consent
      "div.otFloatingFlat.ot-bottom-left.ot-wo-title", // Class for cookie banner
      '[aria-label="Cookie banner"]', // Aria label
    ];

    // Remove generic cookie banners
    cookieSelectors.forEach((selector) => {
      const element = document.querySelector(selector);
      if (element) {
        element.style.display = "none"; // Hide the element
      }
    });

    // Remove the specific div by class name
    const specificDiv = document.querySelector(".ot-sdk-container");
    const specificDiv2 = document.querySelector(
      ".isi-experiencefragment.experiencefragment.aem-GridColumn.aem-GridColumn--default--12"
    );

    if (specificDiv) {
      specificDiv.remove(); // Remove the specific div
    }
    if (specificDiv2) {
      specificDiv2.remove(); // Remove the specific div
    }
  });
};

// Function to take screenshots
const takeScreenshot = async (url, viewPort, filePath) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Set viewport size
  await page.setViewport(viewPort);

  try {
    // Navigate to the URL
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    // Ensure the page is loaded and handle cookies
    await ensurePageLoaded(page);

    // Take full-page screenshot
    await page.screenshot({ path: filePath, fullPage: true });
  } catch (error) {
    console.error(`Failed to capture screenshot for ${url}:`, error);
  } finally {
    // Close browser
    await browser.close();
  }
};

// Function to handle screenshots for all URLs
const captureScreenshots = async (urls) => {
  console.time("Total Process Time"); // Start timer
  const desktopViewPort = { width: 1440, height: 900 };
  const mobileViewPort = { width: 425, height: 546 };
  const tabletViewPort = { width: 768, height: 546 };

  // Get current date and time for folder name
  const now = new Date();
  const folderName = now.toISOString().replace(/:/g, "-"); // Replace ':' with '-' for valid folder name

  // Create folder by date and time
  const baseDir = path.join(__dirname, "screenshots", folderName);
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  // Loop through each URL
  for (const url of urls) {
    const fileName =
      url.replace(/^https?:\/\//, "").replace(/\//g, "_") + ".png";

    const desktopFilePath = path.join(baseDir, "desktop", fileName);
    const mobileFilePath = path.join(baseDir, "mobile", fileName);
    const tabletFilePath = path.join(baseDir, "tablet", fileName);

    // Ensure folders for each device type exist
    if (!fs.existsSync(path.join(baseDir, "desktop"))) {
      fs.mkdirSync(path.join(baseDir, "desktop"));
    }
    if (!fs.existsSync(path.join(baseDir, "mobile"))) {
      fs.mkdirSync(path.join(baseDir, "mobile"));
    }
    if (!fs.existsSync(path.join(baseDir, "tablet"))) {
      fs.mkdirSync(path.join(baseDir, "tablet"));
    }

    console.log(`Taking screenshot for desktop view of: ${url}`);
    await takeScreenshot(url, desktopViewPort, desktopFilePath);

    console.log(`Taking screenshot for mobile view of: ${url}`);
    await takeScreenshot(url, mobileViewPort, mobileFilePath);

    console.log(`Taking screenshot for tablet view of: ${url}`);
    await takeScreenshot(url, tabletViewPort, tabletFilePath);
  }

  console.timeEnd("Total Process Time"); // End timer and log elapsed time
};

// Main execution
const filePath = "./urls.xlsx"; // Path to your Excel file
const urls = readExcelFile(filePath);

captureScreenshots(urls)
  .then(() => {
    console.log("Screenshots captured successfully!");
  })
  .catch((error) => {
    console.error("Error capturing screenshots:", error);
  });
