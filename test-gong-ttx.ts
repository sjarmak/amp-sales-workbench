import { ingestFromGong } from './src/phases/ingest/gong.js';
import path from 'path';

const accountDir = path.join(process.cwd(), 'data/accounts/ttx');
console.log('Testing Gong fetch for TTX...');
try {
  await ingestFromGong({ name: 'TTX', domain: 'ttx.com' }, accountDir, { mode: 'full' });
  console.log('✓ Gong fetch completed successfully');
} catch (err: any) {
  console.error('✗ Gong fetch failed:', err.message);
  console.error(err);
}
