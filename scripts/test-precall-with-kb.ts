/**
 * Test pre-call brief agent with portfolio KB injection
 */

import type { OpportunityContext } from '../src/agentTypes.js'
import { executePreCallBrief } from '../src/agents/preCallBrief.js'
import { generatePortfolioContext } from '../src/portfolio/loader.js'

async function testPreCallWithKb() {
  console.log('📋 Testing Pre-Call Brief with Portfolio KB\n')

  // Mock account context
  const mockContext: OpportunityContext = {
    accountName: 'Acme Corp',
    accountId: '001xx000003DHL1',
    accountDomain: 'acme.com',
    opportunityId: '006xx000000aqxqAAA',
    opportunityName: 'Acme Implementation - Code Search',
    stage: '3 - Technical Discovery',
    products: ['code_search', 'code_insights'],
    salesforceSnapshot: {
      account: {
        Id: '001xx000003DHL1',
        Name: 'Acme Corp',
        Industry: 'Technology',
        AnnualRevenue: 50000000,
        NumberOfEmployees: 2000,
        Website: 'www.acme.com',
      },
      opportunity: {
        Id: '006xx000000aqxqAAA',
        Name: 'Acme Implementation - Code Search',
        StageName: '3 - Technical Discovery',
        Amount: 250000,
        CloseDate: '2025-02-28',
        Probability: 65,
      },
      contacts: [
        {
          Id: '003xx000004MZZ1',
          Name: 'John Smith',
          Title: 'VP Engineering',
          Email: 'john.smith@acme.com',
        },
        {
          Id: '003xx000004MZZ2',
          Name: 'Sarah Johnson',
          Title: 'Tech Lead',
          Email: 'sarah.johnson@acme.com',
        },
      ],
    },
    activities: [],
    knowledgeDocs: [],
    artifacts: [],
    recentTranscript: [],
  }

  // Generate portfolio context
  console.log('📚 Loading portfolio KB...')
  const portfolioContext = await generatePortfolioContext('Technology', ['code_search', 'code_insights'])

  if (portfolioContext) {
    console.log('✓ Portfolio KB loaded')
    console.log(`   Context length: ${portfolioContext.length} chars\n`)
  } else {
    console.log('⚠️  No portfolio KB found - will use baseline context only\n')
  }

  // Execute brief
  console.log('🤖 Generating pre-call brief...')
  const result = await executePreCallBrief(
    mockContext,
    {
      meetingDate: '2025-01-15',
      meetingTitle: 'Code Search Implementation Planning',
    },
    portfolioContext
  )

  if (result.success && result.data) {
    console.log('✅ Brief generated successfully\n')
    console.log('📋 Meeting Type:', result.data.meetingType)
    console.log('👥 Attendees:', result.data.attendees.length)
    console.log('📋 Agenda Items:', result.data.agenda.length)
    console.log('💡 Talking Points:', result.data.talkingPoints.length)
    console.log('⚠️  Risks:', result.data.risks.length)
    console.log('🎯 Objectives:', result.data.objectives.length)

    // Show sample content
    if (result.data.talkingPoints.length > 0) {
      console.log('\n🗣️  Sample Talking Point:')
      const tp = result.data.talkingPoints[0]
      console.log(`   Topic: ${tp.topic}`)
      console.log(`   Context: ${tp.context.substring(0, 100)}...`)
    }
  } else {
    console.error('❌ Brief generation failed:', result.error)
  }
}

testPreCallWithKb().catch(console.error)
