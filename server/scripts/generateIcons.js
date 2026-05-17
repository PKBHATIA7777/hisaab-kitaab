/* server/scripts/generateIcons.js */
/**
 * Generates all required icon sizes from a single source SVG.
 * Run once: node server/scripts/generateIcons.js
 * Requires: npm install sharp --save-dev (in server/)
 */
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const SIZES = [72, 96, 128, 144, 152, 180, 192, 384, 512];
const SOURCE_SVG = path.join(__dirname, "../../icon-source.svg");
const OUTPUT_DIR = path.join(__dirname, "../../client/icons");

async function generate() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const size of SIZES) {
    await sharp(SOURCE_SVG)
      .resize(size, size)
      .png()
      .toFile(path.join(OUTPUT_DIR, `icon-${size}x${size}.png`));
    console.log(`✅ Generated ${size}x${size}`);
  }

  // Maskable versions (extra padding = safe zone)
  for (const size of [192, 512]) {
    const paddedSize = Math.round(size * 0.8);
    const padding = Math.round((size - paddedSize) / 2);
    await sharp({
      create: {
        width: size, height: size,
        channels: 4,
        background: { r: 208, g: 0, b: 255, alpha: 1 }, // Brand purple
      }
    })
    .composite([{
      input: await sharp(SOURCE_SVG).resize(paddedSize, paddedSize).png().toBuffer(),
      top: padding, left: padding
    }])
    .png()
    .toFile(path.join(OUTPUT_DIR, `icon-${size}x${size}-maskable.png`));
    console.log(`✅ Generated maskable ${size}x${size}`);
  }
}

generate().catch(console.error);