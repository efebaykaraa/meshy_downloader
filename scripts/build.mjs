import { readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const packagePath = new URL('../package.json', import.meta.url);
const originalPackage = readFileSync(packagePath, 'utf8');
const args = process.argv.slice(2);
let browser = 'chrome';
for (let i = 1; i < args.length; i++) {
  if (args[i] === '-b' || args[i] === '--browser') browser = args[++i];
  else if (args[i].startsWith('--browser=')) browser = args[i].slice('--browser='.length);
}

if (!['build', 'zip'].includes(args[0])) {
  throw new Error('Expected build or zip.');
}

const packageJson = JSON.parse(originalPackage);
packageJson.name = browser === 'chrome' ? '3d-downloader' : 'meshy-downloader';
writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

try {
  console.log(`Building ${browser} with package name: ${packageJson.name}`);
  const child = spawn(process.execPath, [
    fileURLToPath(new URL('../node_modules/wxt/bin/wxt.mjs', import.meta.url)),
    ...args,
  ], { cwd: root, stdio: 'inherit' });
  const forwardInterrupt = () => child.kill('SIGINT');
  const forwardTermination = () => child.kill('SIGTERM');
  process.on('SIGINT', forwardInterrupt);
  process.on('SIGTERM', forwardTermination);
  try {
    process.exitCode = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code, signal) => resolve(code ?? (signal === 'SIGINT' ? 130 : 1)));
    });
  } finally {
    process.off('SIGINT', forwardInterrupt);
    process.off('SIGTERM', forwardTermination);
  }
} finally {
  writeFileSync(packagePath, originalPackage);
}
