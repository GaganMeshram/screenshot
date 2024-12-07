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
const ensurePageLoaded = async (page, url, folderName) => {
  // Wait for the body to load
  await page.waitForSelector("body", { timeout: 60000 });

  // Wait for any network activity to finish
  await new Promise((resolve) => setTimeout(resolve, 2000)); // Give the page some extra time to stabilize

  // Remove cookie consent dialogs and specific elements
  await page.evaluate(() => {
    const cookieSelectors = [
      'div[role="alertdialog"]',
      "div#onetrust-banner-sdk",
      "div.otFloatingFlat.ot-bottom-left.ot-wo-title",
      '[aria-label="Cookie banner"]',
    ];

    cookieSelectors.forEach((selector) => {
      const element = document.querySelector(selector);
      if (element) {
        element.style.display = "none";
      }
    });
  });

  // Capture specificDiv and specificDiv2 if they exist
  const specificDivScreenshot = async (selector, filename) => {
    const element = await page.$(selector); // Get the element
    if (element) {
      const boundingBox = await element.boundingBox(); // Get dimensions
      if (boundingBox) {
        await page.screenshot({
          path: filename,
          clip: boundingBox, // Screenshot only the specific element
        });
        console.log(`Screenshot of ${selector} saved to ${filename}`);
      }
    } else {
      console.log(`Element ${selector} not found on ${url}`);
    }
  };

  // File paths for specificDiv and specificDiv2 screenshots
  const specificDivFilePath = path.join(folderName, "isi1.png");
  const specificDiv2FilePath = path.join(folderName, "isi2.png");

  // Capture screenshots of specificDiv and specificDiv2
  await specificDivScreenshot(".ot-sdk-container", specificDivFilePath);
  await specificDivScreenshot(
    ".isi-experiencefragment.experiencefragment.aem-GridColumn.aem-GridColumn--default--12",
    specificDiv2FilePath
  );
};

// Function to take screenshots
const takeScreenshot = async (url, viewPort, filePath, folderName) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Set viewport size
  await page.setViewport(viewPort);

  try {
    // Navigate to the URL
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    // Ensure the page is loaded and handle cookies
    await ensurePageLoaded(page, url, folderName);

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
  const desktopViewPort = { width: 1280, height: 800 };
  const mobileViewPort = { width: 375, height: 667 };
  const tabletViewPort = { width: 768, height: 1024 };

  // Get current date and time for folder name
  const now = new Date();
  const folderName = path.join(
    __dirname,
    "screenshots",
    now.toISOString().replace(/:/g, "-")
  ); // Replace ':' with '-' for valid folder name

  // Create folder by date and time
  if (!fs.existsSync(folderName)) {
    fs.mkdirSync(folderName, { recursive: true });
  }

  // Loop through each URL
  for (const url of urls) {
    const fileName =
      url.replace(/^https?:\/\//, "").replace(/\//g, "_") + ".png";

    const desktopFilePath = path.join(folderName, "desktop", fileName);
    const mobileFilePath = path.join(folderName, "mobile", fileName);
    const tabletFilePath = path.join(folderName, "tablet", fileName);

    // Ensure folders for each device type exist
    if (!fs.existsSync(path.join(folderName, "desktop"))) {
      fs.mkdirSync(path.join(folderName, "desktop"));
    }
    if (!fs.existsSync(path.join(folderName, "mobile"))) {
      fs.mkdirSync(path.join(folderName, "mobile"));
    }
    if (!fs.existsSync(path.join(folderName, "tablet"))) {
      fs.mkdirSync(path.join(folderName, "tablet"));
    }

    console.log(`Taking screenshot for desktop view of: ${url}`);
    await takeScreenshot(url, desktopViewPort, desktopFilePath, folderName);

    console.log(`Taking screenshot for mobile view of: ${url}`);
    await takeScreenshot(url, mobileViewPort, mobileFilePath, folderName);

    console.log(`Taking screenshot for tablet view of: ${url}`);
    await takeScreenshot(url, tabletViewPort, tabletFilePath, folderName);
  }
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
