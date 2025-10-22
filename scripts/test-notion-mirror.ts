#!/usr/bin/env tsx
/**
 * Test script for Notion mirror functionality
 * Tests the end-to-end flow of mirroring account data to Notion
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE = 'http://localhost:3001';

interface SnapshotData {
  accountKey?: {
    name: string;
    domain?: string;
    salesforceId?: string;
  };
  accountProfile?: {
    name: string;
    domain?: string;
  };
  contacts?: any[];
  opportunities?: any[];
  nextActions?: string[];
  callSummary?: string;
  recentActivity?: {
    lastCallsSummary?: string;
  };
}

async function loadCanvaData(): Promise<SnapshotData> {
  const accountDir = path.join(__dirname, '..', 'data', 'accounts', 'canva');
  const snapshotsDir = path.join(accountDir, 'snapshots');
  
  console.log('📂 Loading Canva snapshot data...');
  
  try {
    const files = await fs.readdir(snapshotsDir);
    const snapshotFiles = files
      .filter(f => f.startsWith('snapshot-') && f.endsWith('.json'))
      .sort()
      .reverse();
    
    if (snapshotFiles.length === 0) {
      throw new Error('No snapshot files found');
    }
    
    const latestSnapshot = path.join(snapshotsDir, snapshotFiles[0]);
    console.log(`   Using: ${snapshotFiles[0]}`);
    
    const data = await fs.readFile(latestSnapshot, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ Failed to load snapshot data:', error);
    throw error;
  }
}

async function testNotionMirror() {
  console.log('\n🧪 Testing Notion Mirror Functionality\n');
  console.log('='.repeat(50));
  
  // Load test data
  const snapshot = await loadCanvaData();
  
  const accountKey = snapshot.accountKey || snapshot.accountProfile;
  if (!accountKey) {
    throw new Error('No account key found in snapshot');
  }
  
  // Prepare request payload
  const payload = {
    accountSlug: 'canva',
    name: accountKey.name,
    domain: accountKey.domain,
    salesforceId: accountKey.salesforceId,
    callSummary: snapshot.callSummary || snapshot.recentActivity?.lastCallsSummary || 'Recent engagement with technical team on Source Control use cases',
    contacts: (snapshot.contacts || []).slice(0, 5), // Send top 5 contacts
    opportunities: snapshot.opportunities || [],
    nextActions: snapshot.nextActions || [
      'Follow up on expansion opportunities',
      'Schedule technical review with Alex Sadleir'
    ]
  };
  
  console.log('\n📤 Sending test payload:');
  console.log(`   Account: ${payload.name}`);
  console.log(`   Domain: ${payload.domain}`);
  console.log(`   Salesforce ID: ${payload.salesforceId}`);
  console.log(`   Contacts: ${payload.contacts.length}`);
  console.log(`   Opportunities: ${payload.opportunities.length}`);
  console.log(`   Next Actions: ${payload.nextActions.length}`);
  
  // Test Method 1: Direct /api/notion/mirror endpoint
  console.log('\n🔄 Testing POST /api/notion/mirror...');
  
  try {
    const response = await fetch(`${API_BASE}/api/notion/mirror`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error(`❌ Request failed with status ${response.status}`);
      console.error('   Error:', result.error || result);
      return false;
    }
    
    if (result.success) {
      console.log('✅ Mirror successful!');
      console.log(`   Page ID: ${result.pageId}`);
      if (result.url) {
        console.log(`   URL: ${result.url}`);
      }
      if (result.updated) {
        console.log('   ℹ️  Existing page was updated');
      } else {
        console.log('   ℹ️  New page was created');
      }
      return true;
    } else {
      console.error('❌ Mirror failed:', result.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Request error:', error instanceof Error ? error.message : error);
    return false;
  }
}

async function testAccountSpecificEndpoint() {
  console.log('\n🔄 Testing POST /api/accounts/canva/notion/mirror...');
  
  try {
    const response = await fetch(`${API_BASE}/api/accounts/canva/notion/mirror`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}), // Empty body - should auto-load from account data
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error(`❌ Request failed with status ${response.status}`);
      console.error('   Error:', result.error || result);
      return false;
    }
    
    if (result.success) {
      console.log('✅ Mirror successful!');
      console.log(`   Page ID: ${result.pageId}`);
      if (result.url) {
        console.log(`   URL: ${result.url}`);
      }
      if (result.updated) {
        console.log('   ℹ️  Existing page was updated');
      } else {
        console.log('   ℹ️  New page was created');
      }
      return true;
    } else {
      console.error('❌ Mirror failed:', result.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Request error:', error instanceof Error ? error.message : error);
    return false;
  }
}

async function main() {
  try {
    // Check if API server is running
    console.log('🔍 Checking if API server is running...');
    try {
      const healthCheck = await fetch(`${API_BASE}/api/accounts`);
      if (!healthCheck.ok) {
        throw new Error('Server not responding');
      }
      console.log('✅ API server is running\n');
    } catch {
      console.error('❌ API server is not running!');
      console.error('   Please start it with: npm run start:web');
      process.exit(1);
    }
    
    // Test direct endpoint
    const test1 = await testNotionMirror();
    
    // Test account-specific endpoint
    const test2 = await testAccountSpecificEndpoint();
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Test Summary:');
    console.log(`   Direct endpoint: ${test1 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Account endpoint: ${test2 ? '✅ PASS' : '❌ FAIL'}`);
    console.log('='.repeat(50) + '\n');
    
    if (test1 && test2) {
      console.log('🎉 All tests passed!');
      console.log('\n📝 What was tested:');
      console.log('   ✓ Loading Canva account data from snapshots');
      console.log('   ✓ Formatting data for Notion mirror API');
      console.log('   ✓ Calling POST /api/notion/mirror with explicit data');
      console.log('   ✓ Calling POST /api/accounts/:slug/notion/mirror with auto-load');
      console.log('   ✓ Verifying successful page creation/update in Notion');
      console.log('\n🔗 Next steps:');
      console.log('   → Check the "Canva (Workbench Test)" page in Notion');
      console.log('   → Verify contacts, opportunities, and next actions are displayed');
      console.log('   → Test the UI buttons in the web interface');
      process.exit(0);
    } else {
      console.log('⚠️  Some tests failed - see errors above');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Test execution failed:', error);
    process.exit(1);
  }
}

main();
