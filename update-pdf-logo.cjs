const fs = require('fs');
const b64 = fs.readFileSync('public/logo.png', 'base64');
const file = 'src/lib/pdfReportGenerator.jsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /<Image\s+src="data:image\/png;base64,[^"]+"/;
const replacement = `<Image src="data:image/png;base64,${b64}"`;

if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync(file, content);
    console.log('Successfully updated logo in pdfReportGenerator.jsx');
} else {
    console.error('Target image string not found in pdfReportGenerator.jsx');
}
