import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(__dirname, "..", "docs", "assets", "screenshots");
const htmlDir = path.join(__dirname, "screenshot-pages");

fs.mkdirSync(outputDir, { recursive: true });

const PAGES = [
  { name: "01-dashboard", file: "dashboard.html", width: 1280, height: 900 },
  { name: "02-plans", file: "plans.html", width: 1280, height: 820 },
  { name: "03-channel-contribution", file: "results-contribution.html", width: 1280, height: 960 },
  { name: "04-channel-detail", file: "results-detail.html", width: 1280, height: 880 },
  { name: "05-budget-optimization", file: "results-budget.html", width: 1280, height: 860 },
  { name: "06-data-setup", file: "data-setup.html", width: 1280, height: 860 },
];

async function capture() {
  const browser = await puppeteer.launch({ headless: true });

  for (const page of PAGES) {
    const htmlPath = path.join(htmlDir, page.file);
    if (!fs.existsSync(htmlPath)) {
      console.log(`SKIP: ${page.file} not found`);
      continue;
    }

    const p = await browser.newPage();
    await p.setViewport({ width: page.width, height: page.height, deviceScaleFactor: 2 });
    await p.goto(`file:///${htmlPath.replace(/\\/g, "/")}`, { waitUntil: "networkidle0" });
    await new Promise(r => setTimeout(r, 500));

    const outputPath = path.join(outputDir, `${page.name}.png`);
    await p.screenshot({ path: outputPath, fullPage: false });
    console.log(`Captured: ${outputPath}`);
    await p.close();
  }

  await browser.close();
  console.log("\nAll screenshots captured!");
}

capture().catch(console.error);
