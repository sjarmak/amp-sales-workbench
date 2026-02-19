import { runProspector } from '../../amp-prospector/src/orchestrator.js'
import type { AccountKey } from '../src/types.js'
import { join } from 'path'

async function testProspector() {
	const accountName = process.argv[2]
	const domain = process.argv[3]
	
	if (!accountName) {
		console.error('Usage: npx tsx scripts/test-prospector.ts "Account Name" [domain]')
		console.error('Example: npx tsx scripts/test-prospector.ts "Acme Corp" "acme.com"')
		process.exit(1)
	}
	
	const accountKey: AccountKey = {
		name: accountName,
		domain: domain,
	}
	
	const slug = accountName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
	const outputDir = join(process.cwd(), 'data/accounts', slug, 'prospecting')
	
	try {
		console.log(`\n🔍 Running prospector for ${accountName}...`)
		
		const result = await runProspector({
			company: accountName,
			domains: domain ? [domain] : undefined,
			outDir: outputDir,
		})
		
		console.log('\n✅ Prospector completed successfully!')
		console.log(`\n📊 Summary:`)
		console.log(`   - Files generated: ${result.filesWritten}`)
		console.log(`   - Output directory: ${result.outputDir}`)
		console.log(`\n📁 Files:`)
		for (const file of result.manifest.files) {
			console.log(`   - ${file.path}`)
		}
		
		console.log(`\n✅ View files at: data/accounts/${slug}/prospecting/`)
		
	} catch (error) {
		console.error('\n❌ Error running prospector:', error)
		if (error instanceof Error) {
			console.error(error.stack)
		}
		process.exit(1)
	}
}

testProspector()
