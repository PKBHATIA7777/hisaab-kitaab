const fs = require('fs');
const path = require('path');

const clientDir = path.join(__dirname, '../client');

const splashTags = `
  <!-- PWA Apple Icons & Splash Screens -->
  <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-180x180.png">
  <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152x152.png">
  <link rel="apple-touch-startup-image" media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)" href="/icons/splash/iPhone_15_Pro_Max__iPhone_15_Plus__iPhone_14_Pro_Max_portrait.png">
  <link rel="apple-touch-startup-image" media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)" href="/icons/splash/iPhone_15_Pro__iPhone_15__iPhone_14_Pro_portrait.png">
  <link rel="apple-touch-startup-image" media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)" href="/icons/splash/iPhone_14_Plus__iPhone_13_Pro_Max__iPhone_12_Pro_Max_portrait.png">
  <link rel="apple-touch-startup-image" media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)" href="/icons/splash/iPhone_14__iPhone_13_Pro__iPhone_13__iPhone_12_Pro__iPhone_12_portrait.png">
  <link rel="apple-touch-startup-image" media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)" href="/icons/splash/iPhone_13_mini__iPhone_12_mini__iPhone_11_Pro__iPhone_XS__iPhone_X_portrait.png">
  <link rel="apple-touch-startup-image" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)" href="/icons/splash/iPhone_11_Pro_Max__iPhone_XS_Max_portrait.png">
  <link rel="apple-touch-startup-image" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)" href="/icons/splash/iPhone_11__iPhone_XR_portrait.png">
  <link rel="apple-touch-startup-image" media="(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)" href="/icons/splash/iPhone_8_Plus__iPhone_7_Plus__iPhone_6s_Plus__iPhone_6_Plus_portrait.png">
  <link rel="apple-touch-startup-image" media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)" href="/icons/splash/iPhone_8__iPhone_7__iPhone_6s__iPhone_6__4.7__iPhone_SE_portrait.png">
`;

function processHtmlFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Remove existing apple-touch-icon tags
  content = content.replace(/<link[^>]*rel="apple-touch-icon"[^>]*>\s*/gi, '');
  // Remove existing apple-touch-startup-image tags if any
  content = content.replace(/<link[^>]*rel="apple-touch-startup-image"[^>]*>\s*/gi, '');
  
  // Insert new tags right before <meta name="apple-mobile-web-app-capable"
  content = content.replace(/(<meta name="apple-mobile-web-app-capable")/, splashTags.trim() + '\n  $1');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Updated ' + path.basename(filePath));
}

const files = fs.readdirSync(clientDir).filter(f => f.endsWith('.html'));
for (const file of files) {
  processHtmlFile(path.join(clientDir, file));
}
