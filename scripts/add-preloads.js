const fs = require('fs');
const path = require('path');

const clientDir = path.join(__dirname, '../client');
const files = fs.readdirSync(clientDir).filter(f => f.endsWith('.html'));

const preloadBlock = `
  <!-- Critical Resource Preloads -->
  <link rel="preload" href="css/tokens.css" as="style">
  <link rel="preload" href="css/reset.css" as="style">
  <link rel="preload" href="css/global.css" as="style">
  <link rel="preload" href="js/main.js" as="script">
  <link rel="preload" href="js/core/session.js" as="script">
`;

files.forEach(file => {
  const filePath = path.join(clientDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (!content.includes('Critical Resource Preloads')) {
    // Inject right after the Font preload block, or just before the <!-- SEO --> block
    content = content.replace(
      '<!-- SEO -->',
      `${preloadBlock.trim()}\n\n  <!-- SEO -->`
    );
    fs.writeFileSync(filePath, content);
  }
});
console.log('Preload hints added to all HTML files.');
