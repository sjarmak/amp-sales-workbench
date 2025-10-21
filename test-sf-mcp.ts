import { execute } from '@sourcegraph/amp-sdk';

// Use MCP tool to query Salesforce
const result = await (globalThis as any).mcp__salesforce__soql_query({
  query: 'SELECT COUNT() FROM Account'
});

console.log(JSON.stringify(result, null, 2));
