import { ingestFromGong } from './src/phases/ingest/gong.js';
import path from 'path';

const accountDir = path.join(process.cwd(), 'data/accounts/canva');

console.log('Testing Gong fetch for Canva with new list+filter approach...');
console.log('This will search 6 months of call history for "Canva" in titles\n');

try {
  const result = await ingestFromGong(
    { name: 'Canva', domain: 'canva.com' }, 
    accountDir,
    { useCache: false } // Use direct API to test filtering
  );
  
  console.log('\n✓ Gong fetch completed successfully');
  console.log(`\nFound ${result.calls?.length || 0} calls`);
  
  if (result.calls && result.calls.length > 0) {
    console.log('\nCalls found:');
    result.calls.forEach((call: any) => {
      console.log(`  - ${call.title}`);
      console.log(`    ID: ${call.id}, Date: ${call.startTime}`);
    });
  }
  
  console.log(`\nTranscripts fetched: ${Object.keys(result.transcripts || {}).length}`);
} catch (err: any) {
  console.error('✗ Gong fetch failed:', err.message);
  console.error(err);
}
