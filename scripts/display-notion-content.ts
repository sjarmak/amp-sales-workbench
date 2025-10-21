#!/usr/bin/env tsx
/**
 * Simple display of Notion Competitive Analysis content
 */

const COMPETITIVE_ANALYSIS_PAGE_ID = '273a8e11265880079d21fa5f21d05564'

console.log('📄 Amp Competitive Analysis Page')
console.log('=' .repeat(80))
console.log(`\nPage ID: ${COMPETITIVE_ANALYSIS_PAGE_ID}`)
console.log(`URL: https://www.notion.so/sourcegraph/Amp-competitive-analysis-${COMPETITIVE_ANALYSIS_PAGE_ID}`)
console.log('\n✅ Configuration updated in notion-config.json')
console.log('\nNext Steps:')
console.log('1. The page ID is now stored in notion-config.json under competitiveAnalysis')
console.log('2. Agents can retrieve this content using the Notion MCP')
console.log('3. Content will be cached locally for offline/analysis use')
console.log('\nUsage in agents:')
console.log('  - Discovery call prep: Include competitor positioning')
console.log('  - Demo prep: Reference competitive advantages')
console.log('  - Qualification: Understand competitive landscape')
console.log('\n' + '='.repeat(80))
