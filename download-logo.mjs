import https from 'https';
import fs from 'fs';
import path from 'path';

const url = 'https://upload.wikimedia.org/wikipedia/commons/e/ec/Freeport_Area_of_Bataan_logo.png';

fs.mkdirSync('./public', { recursive: true });
const file = fs.createWriteStream('./public/fab-logo.png');

https.get(url, (response) => {
  response.pipe(file);
  file.on('finish', () => {
    file.close();
    console.log('Download completed.');
  });
}).on('error', (err) => {
  fs.unlink('./public/fab-logo.png', () => {});
  console.error('Error downloading:', err.message);
});
