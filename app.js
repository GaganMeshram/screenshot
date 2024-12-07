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
  return data.map((row) => ({
    enUrl: row.EN_URL, // Assumes the column name is 'EN_URL'
    esUrl: row.ES_URL, // Assumes the column name is 'ES_URL'
  }));
};

// Function to wait for the page to fully load and close cookie dialogs
const ensurePageLoaded = async (page) => {
  await page.waitForSelector("body", { timeout: 60000 });
  await new Promise((resolve) => setTimeout(resolve, 3000)); // Stabilization delay

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
    const specificDiv3 = document.querySelector(".cope-core-isi-header-bar cope-core-isi-header-bar-Rybelsus-Consumer-ISI--Spanish");


    if (specificDiv) {
      specificDiv.remove(); // Remove the specific div
    }
    if (specificDiv2) {
      specificDiv2.remove(); // Remove the specific div
    }
    if (specificDiv3) {
        specificDiv3.remove(); // Remove the specific div
      }
    
  });
};



// Function to take screenshots
const takeScreenshot = async (url, viewPort, filePath) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.setViewport(viewPort);

  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    await ensurePageLoaded(page);
    await page.screenshot({ path: filePath, fullPage: true });
  } catch (error) {
    console.error(`Failed to capture screenshot for ${url}:`, error);
  } finally {
    await browser.close();
  }
};

// Function to handle screenshots for all URLs
const captureScreenshots = async (urlPairs) => {
  console.time("Total Process Time"); // Start timer
  const desktopViewPort = { width: 1440, height: 900 };
  const mobileViewPort = { width: 425, height: 546 };
  const tabletViewPort = { width: 768, height: 546 };

  // Get current date and time for folder name
  const now = new Date();
  const folderName = now.toISOString().replace(/:/g, "-");

  const baseDir = path.join(__dirname, "screenshots", folderName);
  const enDir = path.join(baseDir, "EN");
  const esDir = path.join(baseDir, "ES");

  // Create separate folders for EN and ES
  if (!fs.existsSync(enDir)) {
    fs.mkdirSync(enDir, { recursive: true });
  }
  if (!fs.existsSync(esDir)) {
    fs.mkdirSync(esDir, { recursive: true });
  }

  // Process each URL pair
  for (const { enUrl, esUrl } of urlPairs) {
    // Process EN URL
    if (enUrl) {
      const enFileName = enUrl.replace(/^https?:\/\//, "").replace(/\//g, "_") + ".png";
      const enDesktopPath = path.join(enDir, "desktop", enFileName);
      const enMobilePath = path.join(enDir, "mobile", enFileName);
      const enTabletPath = path.join(enDir, "tablet", enFileName);

      if (!fs.existsSync(path.join(enDir, "desktop"))) fs.mkdirSync(path.join(enDir, "desktop"));
      if (!fs.existsSync(path.join(enDir, "mobile"))) fs.mkdirSync(path.join(enDir, "mobile"));
      if (!fs.existsSync(path.join(enDir, "tablet"))) fs.mkdirSync(path.join(enDir, "tablet"));

      console.log(`Taking screenshot for EN desktop view: ${enUrl}`);
      await takeScreenshot(enUrl, desktopViewPort, enDesktopPath);

      console.log(`Taking screenshot for EN mobile view: ${enUrl}`);
      await takeScreenshot(enUrl, mobileViewPort, enMobilePath);

      console.log(`Taking screenshot for EN tablet view: ${enUrl}`);
      await takeScreenshot(enUrl, tabletViewPort, enTabletPath);
    }

    // Process ES URL
    if (esUrl) {
      const esFileName = esUrl.replace(/^https?:\/\//, "").replace(/\//g, "_") + ".png";
      const esDesktopPath = path.join(esDir, "desktop", esFileName);
      const esMobilePath = path.join(esDir, "mobile", esFileName);
      const esTabletPath = path.join(esDir, "tablet", esFileName);

      if (!fs.existsSync(path.join(esDir, "desktop"))) fs.mkdirSync(path.join(esDir, "desktop"));
      if (!fs.existsSync(path.join(esDir, "mobile"))) fs.mkdirSync(path.join(esDir, "mobile"));
      if (!fs.existsSync(path.join(esDir, "tablet"))) fs.mkdirSync(path.join(esDir, "tablet"));

      console.log(`Taking screenshot for ES desktop view: ${esUrl}`);
      await takeScreenshot(esUrl, desktopViewPort, esDesktopPath);

      console.log(`Taking screenshot for ES mobile view: ${esUrl}`);
      await takeScreenshot(esUrl, mobileViewPort, esMobilePath);

      console.log(`Taking screenshot for ES tablet view: ${esUrl}`);
      await takeScreenshot(esUrl, tabletViewPort, esTabletPath);
    }
  }

  console.timeEnd("Total Process Time"); // End timer
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
