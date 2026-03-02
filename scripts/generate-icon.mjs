import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(__dirname, "..", "docs", "assets");

// SVG app icon (scalable)
const svgIcon = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0D7C3E;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#108043;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="barGrad" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" style="stop-color:#FFFFFF;stop-opacity:0.85" />
      <stop offset="100%" style="stop-color:#FFFFFF;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Background rounded rectangle -->
  <rect width="512" height="512" rx="96" ry="96" fill="url(#bg)" />

  <!-- Chart bars -->
  <rect x="88" y="300" width="52" height="108" rx="8" fill="url(#barGrad)" opacity="0.7" />
  <rect x="164" y="240" width="52" height="168" rx="8" fill="url(#barGrad)" opacity="0.8" />
  <rect x="240" y="180" width="52" height="228" rx="8" fill="url(#barGrad)" opacity="0.9" />
  <rect x="316" y="140" width="52" height="268" rx="8" fill="url(#barGrad)" opacity="0.95" />
  <rect x="392" y="100" width="52" height="308" rx="8" fill="url(#barGrad)" />

  <!-- Trend line -->
  <polyline
    points="114,280 190,225 266,165 342,120 418,82"
    fill="none"
    stroke="#FFD700"
    stroke-width="6"
    stroke-linecap="round"
    stroke-linejoin="round"
  />

  <!-- Trend line dots -->
  <circle cx="114" cy="280" r="8" fill="#FFD700" />
  <circle cx="190" cy="225" r="8" fill="#FFD700" />
  <circle cx="266" cy="165" r="8" fill="#FFD700" />
  <circle cx="342" cy="120" r="8" fill="#FFD700" />
  <circle cx="418" cy="82" r="8" fill="#FFD700" />

  <!-- "MMM" text -->
  <text x="256" y="460" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="48" fill="white" opacity="0.95" letter-spacing="6">MMM</text>
</svg>
`;

async function generate() {
  // Ensure output directory exists
  const fs = await import("fs");
  fs.mkdirSync(outputDir, { recursive: true });

  // Generate 512x512 for App Store listing
  const outputPath512 = path.join(outputDir, "app-icon-512.png");
  await sharp(Buffer.from(svgIcon))
    .resize(512, 512)
    .png()
    .toFile(outputPath512);
  console.log(`Icon generated: ${outputPath512}`);

  // Generate 1200x1200 for Dev Dashboard (admin icon)
  const outputPath1200 = path.join(outputDir, "app-icon-1200.png");
  await sharp(Buffer.from(svgIcon))
    .resize(1200, 1200)
    .png()
    .toFile(outputPath1200);
  console.log(`Icon generated: ${outputPath1200}`);
}

generate().catch(console.error);
