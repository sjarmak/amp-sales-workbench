// Direct MCP tool invocation test
// This will only work when executed by Amp agent, not standalone tsx

const testSalesforce = async () => {
  console.log('Testing Salesforce MCP connection...');
  
  // This requires Amp runtime with MCP tools available
  const mcp = (globalThis as any).mcp__salesforce__soql_query;
  
  if (!mcp) {
    console.error('MCP tools not available - this must run in Amp context');
    process.exit(1);
  }
  
  const result = await mcp({
    query: 'SELECT COUNT() FROM Account'
  });
  
  return result;
};

testSalesforce().then(r => console.log(JSON.stringify(r, null, 2)));
