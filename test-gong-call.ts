import { callGongGetCall } from './src/phases/ingest/mcp-wrapper.js';

async function test() {
  const result = await callGongGetCall({ callId: '2359232232053631828' });
  console.log(JSON.stringify({ 
    hasParties: !!result.parties, 
    partiesCount: result.parties?.length,
    parties: result.parties?.slice(0, 2)
  }, null, 2));
}

test();
