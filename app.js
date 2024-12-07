const puppeteer = require('puppeteer');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

// Read URLs from Excel file
const readExcelFile = (filePath) => {
  const workbook = xlsx.readFile(filePath);
  const sheet_name_list = workbook.SheetNames;
  const sheet = workbook.Sheets[sheet_name_list[0]];
  const data = xlsx.utils.sheet_to_json(sheet);
  return data.map((row) => row.URL); // Assumes the URL is under a column named 'URL'
};

// Function to take screenshots
const takeScreenshot = async (url, viewPort, filePath) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Set viewport size
  await page.setViewport(viewPort);

  // Navigate to the URL
  await page.goto(url, { waitUntil: 'networkidle0' });

  // Take screenshot
  await page.screenshot({ path: filePath });

  // Close browser
  await browser.close();
};

// Function to handle screenshots for all URLs
const captureScreenshots = async (urls) => {
  const desktopViewPort = { width: 1280, height: 800 };
  const mobileViewPort = { width: 375, height: 667 };

  // Loop through each URL
  for (const url of urls) {
    const fileName = url.replace(/^https?:\/\//, '').replace(/\//g, '_') + '.png';
    const desktopFilePath = path.join(__dirname, 'screenshots', 'desktop', fileName);
    const mobileFilePath = path.join(__dirname, 'screenshots', 'mobile', fileName);

    // Ensure screenshots folder exists
    if (!fs.existsSync(path.join(__dirname, 'screenshots'))) {
      fs.mkdirSync(path.join(__dirname, 'screenshots'));
    }
    if (!fs.existsSync(path.join(__dirname, 'screenshots', 'desktop'))) {
      fs.mkdirSync(path.join(__dirname, 'screenshots', 'desktop'));
    }
    if (!fs.existsSync(path.join(__dirname, 'screenshots', 'mobile'))) {
      fs.mkdirSync(path.join(__dirname, 'screenshots', 'mobile'));
    }

    console.log(`Taking screenshot for desktop view of: ${url}`);
    await takeScreenshot(url, desktopViewPort, desktopFilePath);
    
    console.log(`Taking screenshot for mobile view of: ${url}`);
    await takeScreenshot(url, mobileViewPort, mobileFilePath);
  }
};

// Main execution
const filePath = './urls.xlsx'; // Path to your Excel file
const urls = readExcelFile(filePath);

captureScreenshots(urls)
  .then(() => {
    console.log('Screenshots captured successfully!');
  })
  .catch((error) => {
    console.error('Error capturing screenshots:', error);
  });
