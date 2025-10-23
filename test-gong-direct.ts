/**
 * Test Gong MCP Direct Client
 * Minimal reproduction to debug MCP connection issues
 */

import { callGongListCalls } from './src/phases/ingest/mcp-wrapper.js'

async function main() {
  console.log('Testing Gong MCP direct client...\n')
  
  try {
    // Test list_calls with last 24 hours
    const fromDate = new Date(Date.now() - 86400000).toISOString()
    const toDate = new Date().toISOString()
    
    console.log(`Fetching calls from ${fromDate} to ${toDate}`)
    
    const result = await callGongListCalls({
      fromDateTime: fromDate,
      toDateTime: toDate
    })
    
    console.log('\n✅ Success!')
    console.log('Result keys:', Object.keys(result))
    console.log('Calls count:', result.calls?.length || 0)
    if (result.calls?.length > 0) {
      console.log('First call:', JSON.stringify(result.calls[0], null, 2).substring(0, 300))
    }
  } catch (error: any) {
    console.error('\n❌ Failed:', error.message)
    console.error('Full error:', error)
  }
}

main()
