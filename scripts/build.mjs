import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);

if (!['build', 'zip'].includes(args[0])) {
  throw new Error('Expected build or zip.');
}

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
