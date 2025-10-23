import { mcp__gong_extended__list_calls } from '@modelcontextprotocol/server-gong-extended';

async function findTTXCalls() {
  console.log('Searching for TTX calls...');
  
  const result = await mcp__gong_extended__list_calls({
    fromDateTime: '2025-10-01T00:00:00Z',
    toDateTime: '2025-10-23T23:59:59Z'
  });
  
  const ttxCalls = result.calls.filter((call: any) => 
    call.title.toLowerCase().includes('ttx')
  );
  
  console.log(`\nFound ${ttxCalls.length} TTX calls:`);
  ttxCalls.forEach((call: any) => {
    console.log(`\n- ${call.title}`);
    console.log(`  ID: ${call.id}`);
    console.log(`  Date: ${call.scheduled}`);
  });
}

findTTXCalls().catch(console.error);
