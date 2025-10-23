/**
 * Test Gong get_call API
 */

import { callGongTool } from '../src/mcp-client.js'

async function main() {
  console.log('Testing Gong get_call...\n')
  
  // Use a known call ID from cache
  const testCallId = '1781810788594146516'
  
  try {
    console.log(`Fetching call details for ${testCallId}...`)
    const result = await callGongTool('get_call', { callId: testCallId })
    
    console.log('\nResult type:', result[0]?.type)
    const data = JSON.parse(result[0].text)
    
    console.log('\nCall details:')
    console.log('  Title:', data.title)
    console.log('  Participants:', data.participants?.length || 0)
    
    if (data.participants && data.participants.length > 0) {
      console.log('\nFirst 3 participants:')
      data.participants.slice(0, 3).forEach((p: any) => {
        console.log(`  - ${p.name || 'Unknown'} <${p.email || 'no-email'}>`)
      })
    } else {
      console.log('\n⚠️  No participants returned!')
    }
    
  } catch (error: any) {
    console.error('\n❌ Failed:', error.message)
    console.error('Full error:', error)
  }
}

main()
