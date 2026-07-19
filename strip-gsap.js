const fs = require('fs');
const path = require('path');

function findFiles(dir, ext) {
  const results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results.push(...findFiles(file, ext));
    } else if (file.endsWith(ext)) {
      results.push(file);
    }
  });
  return results;
}

const files = findFiles('c:/xampp/firstapp/src', '.jsx');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('useGSAP')) {
    content = content.replace(/import gsap from 'gsap';\r?\n?/g, '');
    content = content.replace(/import \{ useGSAP \} from '@gsap\/react';\r?\n?/g, '');
    // Replace the useGSAP block
    content = content.replace(/[ \t]*useGSAP\(\(\) => \{[\s\S]*?\}, \{ scope: container \}\);\r?\n?/g, '');
    fs.writeFileSync(file, content);
    console.log('Stripped GSAP from ' + file);
  }
});
