/**
 * Check Gong API pagination
 */

import { callGongTool } from '../src/mcp-client.js'

async function main() {
  console.log('Checking Gong API response structure...\n')
  
  const fromDate = new Date()
  fromDate.setMonth(fromDate.getMonth() - 6)
  const toDate = new Date()
  
  try {
    console.log(`Fetching calls from ${fromDate.toISOString()} to ${toDate.toISOString()}`)
    const result = await callGongTool('list_calls', {
      fromDateTime: fromDate.toISOString(),
      toDateTime: toDate.toISOString()
    })
    
    const data = JSON.parse(result[0].text)
    
    console.log('\nResponse keys:', Object.keys(data))
    console.log('Calls count:', data.calls?.length || 0)
    console.log('Has cursor?', 'cursor' in data || 'nextCursor' in data || 'records' in data)
    console.log('Has pagination?', 'totalRecords' in data || 'hasMore' in data)
    
    console.log('\nFull response structure:')
    console.log(JSON.stringify(data, null, 2).substring(0, 1000))
    
  } catch (error: any) {
    console.error('\n❌ Failed:', error.message)
  }
}

main()
