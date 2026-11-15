import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const targetPath = resolve(__dirname, '../src/environments/environment.ts');

const rawUrl = (process.env.BACKEND_URL || process.env.API_URL || '').trim();
const normalizedUrl = rawUrl.replace(/\/+$/, '');

const content = `export const environment = {
  apiUrl: ${JSON.stringify(normalizedUrl)}
};
`;

writeFileSync(targetPath, content, 'utf8');
console.log(`[set-env] environment.apiUrl = ${JSON.stringify(normalizedUrl)}`);
