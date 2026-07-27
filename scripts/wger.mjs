// Manage the local wger stack (self-hosted exercise database).
// Usage: npm run wger:up | wger:down | wger:logs | wger:status
// Clones the official wger docker repo into infra/wger on first use, then
// runs it with our overrides from infra/wger.override.yml layered on top.
import { execSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const wgerDir = join(root, 'infra', 'wger');
const composeArgs = [
  'compose',
  '--project-name',
  'wger',
  '-f',
  join(wgerDir, 'docker-compose.yml'),
  '-f',
  join(root, 'infra', 'wger.override.yml'),
];

if (!existsSync(join(wgerDir, 'docker-compose.yml'))) {
  console.log('First run: cloning the official wger docker stack into infra/wger …');
  execSync(`git clone --depth 1 https://github.com/wger-project/docker.git "${wgerDir}"`, {
    stdio: 'inherit',
  });
}

const command = process.argv[2] ?? 'up';
const extra = {
  up: ['up', '-d'],
  down: ['down'],
  logs: ['logs', '-f', 'web'],
  status: ['ps'],
}[command];

if (!extra) {
  console.error(`Unknown command "${command}". Use: up | down | logs | status`);
  process.exit(1);
}

const result = spawnSync('docker', [...composeArgs, ...extra], { stdio: 'inherit' });
if (command === 'up' && result.status === 0) {
  console.log('\nwger is starting. First boot runs migrations + exercise sync (several minutes).');
  console.log('  UI:  http://localhost:8001  (admin / adminadmin)');
  console.log('  API: http://localhost:8001/api/v2/exerciseinfo/?format=json&limit=1');
  console.log('  Watch progress: npm run wger:logs');
}
process.exit(result.status ?? 0);
