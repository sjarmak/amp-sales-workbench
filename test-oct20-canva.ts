import { callGongTool } from './src/mcp-client.js';

async function testOct20Canva() {
  console.log('Testing Gong list_calls for October 20, 2025...\n');
  
  const fromDateTime = '2025-10-20T00:00:00.000Z';
  const toDateTime = '2025-10-20T23:59:59.999Z';
  
  console.log('Date range:', fromDateTime, 'to', toDateTime);
  
  let allCalls: any[] = [];
  let cursor: string | undefined;
  let pageCount = 0;
  
  do {
    pageCount++;
    console.log(`\nFetching page ${pageCount}...`);
    
    const params: any = { fromDateTime, toDateTime };
    if (cursor) params.cursor = cursor;
    
    const resultContent = await callGongTool('list_calls', params);
    const listResult = JSON.parse(resultContent[0].text);
    
    console.log(`  Total records: ${listResult.records?.totalRecords || 0}`);
    console.log(`  Page size: ${listResult.records?.currentPageSize || 0}`);
    console.log(`  Calls in response: ${listResult.calls?.length || 0}`);
    
    if (listResult.calls) {
      allCalls.push(...listResult.calls);
    }
    
    cursor = listResult.records?.cursor;
    
    if (pageCount >= 20) {
      console.log('\nReached page limit');
      break;
    }
  } while (cursor);
  
  console.log(`\n=== RESULTS ===`);
  console.log(`Total calls retrieved: ${allCalls.length}`);
  
  // Filter for Canva
  const canvaCalls = allCalls.filter(call => {
    const title = call.title?.toLowerCase() || '';
    const parties = call.parties?.map((p: any) => p.name?.toLowerCase() || '').join(' ') || '';
    return title.includes('canva') || parties.includes('canva');
  });
  
  console.log(`Canva calls found: ${canvaCalls.length}\n`);
  
  if (canvaCalls.length > 0) {
    canvaCalls.forEach(call => {
      console.log('---');
      console.log('Title:', call.title);
      console.log('Started:', call.started);
      console.log('ID:', call.id);
      console.log('Parties:', call.parties?.map((p: any) => p.name).join(', '));
    });
  }
}

testOct20Canva().catch(console.error);
