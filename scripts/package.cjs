const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = process.cwd();
const version = JSON.parse(fs.readFileSync('manifest.json', 'utf8')).version;
const runtime = ['manifest.json', 'background.js', 'content.js', 'popup.html', 'popup.css', 'popup.js', 'qr-core.js', 'qr-scan.js', 'LICENSE', 'PRIVACY.md', 'THIRD_PARTY_NOTICES.md'];
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = `${directory}/${entry.name}`; return entry.isDirectory() ? walk(file) : [file];
  });
}
runtime.push(...walk('icons'), ...walk('libs'));
const images = walk('store-assets').filter(file => !file.includes('-source.'));
const optionalDocs = ['PUBLISHING.md', 'VALIDATION.md'].filter(file => fs.existsSync(file));
const source = [...new Set([...runtime, ...images, ...walk('scripts'), ...walk('tests'), ...walk('assets'), 'package.json', 'package-lock.json', '.gitignore', 'README.md', ...optionalDocs])];
fs.mkdirSync('release', { recursive: true });
function archive(name, files) {
  for (const file of files) {
    const absolute = path.resolve(file);
    if (!absolute.startsWith(root + path.sep) || !fs.statSync(absolute).isFile()) throw new Error(`Invalid release input: ${file}`);
  }
  const destination = `release/${name}.zip`;
  const script = 'import sys,json,zipfile\np=json.load(sys.stdin)\nwith zipfile.ZipFile(p["destination"],"w",zipfile.ZIP_DEFLATED,compresslevel=9) as z:\n for file in p["files"]: z.write(file,file)\n';
  const result = spawnSync('python', ['-c', script], { input: JSON.stringify({ destination, files }), encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(result.stderr || 'ZIP creation failed.');
  const data = fs.readFileSync(destination); console.log(`${destination}: ${data.length} bytes, ${files.length} files`);
  return { file: destination, bytes: data.length, sha256: crypto.createHash('sha256').update(data).digest('hex'), files };
}
const archives = [archive(`QR-Code-Creator-${version}`, runtime), archive('QR-Code-Creator-store-assets', images), archive(`QR-Code-Creator-${version}-source`, source)];
fs.writeFileSync('release/checksums.json', JSON.stringify(archives, null, 2) + '\n');
