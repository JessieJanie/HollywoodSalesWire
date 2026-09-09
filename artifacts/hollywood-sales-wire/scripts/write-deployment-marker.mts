import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const marker = randomUUID();

await writeFile(new URL('../dist/public/__deployment-marker.txt', import.meta.url), `${marker}\n`);
console.log(`Wrote deployment marker ${marker}`);