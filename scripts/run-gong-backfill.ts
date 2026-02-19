/**
 * Test Gong Cache Backfill
 * Runs the backfill process with direct MCP client
 */

import { getGongCacheManager } from '../src/gong-cache/manager.js'

async function main() {
  console.log('Starting Gong cache backfill test...\n')
  
  try {
    const manager = getGongCacheManager()
    
    console.log('Running backfill (last 6 months)...')
    const result = await manager.backfill({ months: 6 })
    
    console.log('\n✅ Backfill complete!')
    console.log('Stats:', JSON.stringify(result, null, 2))
    
    // Test query for an account by domain
    console.log('\n\nTesting query for "Acme Corp" by domain...')
    const testCalls = await manager.getCallsForAccount('Acme Corp', {
      maxResults: 10,
      domain: 'acme.com'
    })

    console.log(`Found ${testCalls.length} test calls`)
    if (testCalls.length > 0) {
      console.log('First call:')
      console.log('  Title:', testCalls[0].title)
      console.log('  Participants:', testCalls[0].participantEmails)
      console.log('  Date:', testCalls[0].scheduled)
    }
    
    // Get overall stats
    console.log('\n\nCache stats:')
    const stats = await manager.getStats()
    console.log(JSON.stringify(stats, null, 2))
    
  } catch (error: any) {
    console.error('\n❌ Backfill failed:', error.message)
    console.error('Full error:', error)
    process.exit(1)
  }
}

main()
