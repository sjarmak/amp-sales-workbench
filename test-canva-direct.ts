import { mcp__gong_extended__list_calls } from '@modelcontextprotocol/server-gong-extended';

async function findCanvaCalls() {
  console.log('Searching for Canva calls in last 6 months...');
  
  const fromDate = new Date();
  fromDate.setMonth(fromDate.getMonth() - 6);
  
  const result = await mcp__gong_extended__list_calls({
    fromDateTime: fromDate.toISOString(),
    toDateTime: new Date().toISOString()
  });
  
  console.log(`Total calls returned: ${result.calls?.length || 0}`);
  
  const canvaCalls = (result.calls || []).filter((call: any) => 
    call.title?.toLowerCase().includes('canva')
  );
  
  console.log(`\nFound ${canvaCalls.length} Canva calls:`);
  canvaCalls.slice(0, 10).forEach((call: any) => {
    console.log(`\n- ${call.title}`);
    console.log(`  ID: ${call.id}`);
    console.log(`  Date: ${call.scheduled || call.started}`);
  });
}

findCanvaCalls().catch(console.error);
