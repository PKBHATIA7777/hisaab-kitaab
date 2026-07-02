const fs = require('fs');
const path = require('path');
const sharp = require('../server/node_modules/sharp');

const SPLASH_DIR = path.join(__dirname, '../client/icons/splash');
if (!fs.existsSync(SPLASH_DIR)) {
  fs.mkdirSync(SPLASH_DIR, { recursive: true });
}

// All major iOS device resolutions
const splashSizes = [
  { w: 1320, h: 2868, name: "iPhone_15_Pro_Max__iPhone_15_Plus__iPhone_14_Pro_Max_landscape.png" },
  { w: 2868, h: 1320, name: "iPhone_15_Pro_Max__iPhone_15_Plus__iPhone_14_Pro_Max_portrait.png" },
  { w: 1179, h: 2556, name: "iPhone_15_Pro__iPhone_15__iPhone_14_Pro_landscape.png" },
  { w: 2556, h: 1179, name: "iPhone_15_Pro__iPhone_15__iPhone_14_Pro_portrait.png" },
  { w: 1284, h: 2778, name: "iPhone_14_Plus__iPhone_13_Pro_Max__iPhone_12_Pro_Max_landscape.png" },
  { w: 2778, h: 1284, name: "iPhone_14_Plus__iPhone_13_Pro_Max__iPhone_12_Pro_Max_portrait.png" },
  { w: 1170, h: 2532, name: "iPhone_14__iPhone_13_Pro__iPhone_13__iPhone_12_Pro__iPhone_12_landscape.png" },
  { w: 2532, h: 1170, name: "iPhone_14__iPhone_13_Pro__iPhone_13__iPhone_12_Pro__iPhone_12_portrait.png" },
  { w: 1125, h: 2436, name: "iPhone_13_mini__iPhone_12_mini__iPhone_11_Pro__iPhone_XS__iPhone_X_landscape.png" },
  { w: 2436, h: 1125, name: "iPhone_13_mini__iPhone_12_mini__iPhone_11_Pro__iPhone_XS__iPhone_X_portrait.png" },
  { w: 1242, h: 2688, name: "iPhone_11_Pro_Max__iPhone_XS_Max_landscape.png" },
  { w: 2688, h: 1242, name: "iPhone_11_Pro_Max__iPhone_XS_Max_portrait.png" },
  { w: 828, h: 1792, name: "iPhone_11__iPhone_XR_landscape.png" },
  { w: 1792, h: 828, name: "iPhone_11__iPhone_XR_portrait.png" },
  { w: 1242, h: 2208, name: "iPhone_8_Plus__iPhone_7_Plus__iPhone_6s_Plus__iPhone_6_Plus_landscape.png" },
  { w: 2208, h: 1242, name: "iPhone_8_Plus__iPhone_7_Plus__iPhone_6s_Plus__iPhone_6_Plus_portrait.png" },
  { w: 750, h: 1334, name: "iPhone_8__iPhone_7__iPhone_6s__iPhone_6__4.7__iPhone_SE_landscape.png" },
  { w: 1334, h: 750, name: "iPhone_8__iPhone_7__iPhone_6s__iPhone_6__4.7__iPhone_SE_portrait.png" },
];

const svgLogo = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#09090B" />
  <text x="50%" y="65%" text-anchor="middle" font-size="80" fill="#7C3AED" font-family="Arial,sans-serif">&#8377;</text>
</svg>
`);

async function generateSplashes() {
  const logo = await sharp(svgLogo).resize(512, 512).toBuffer();
  
  for (const size of splashSizes) {
    const isPortrait = size.name.includes("portrait");
    const width = isPortrait ? size.h : size.w;
    const height = isPortrait ? size.w : size.h;
    
    // In the data format above, some names say 'landscape' but the W/H might be flipped. 
    // Wait, let's just use w and h directly as defined in the object if they are correct.
    // Usually landscape is W > H. Let's make sure:
    // If it says landscape, width should be > height.
    const actualWidth = Math.max(size.w, size.h);
    const actualHeight = Math.min(size.w, size.h);
    
    const finalW = isPortrait ? actualHeight : actualWidth;
    const finalH = isPortrait ? actualWidth : actualHeight;

    await sharp({
      create: {
        width: finalW,
        height: finalH,
        channels: 4,
        background: { r: 9, g: 9, b: 11, alpha: 1 } // #09090B
      }
    })
    .composite([
      { input: logo, gravity: 'center' }
    ])
    .png()
    .toFile(path.join(SPLASH_DIR, size.name));
    
    console.log(`Generated ${size.name}`);
  }
}

generateSplashes().catch(console.error);
