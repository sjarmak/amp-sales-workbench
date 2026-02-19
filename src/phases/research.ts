import { stat, readdir } from 'fs/promises'
import { join } from 'path'
import type { AccountKey } from '../types.js'

interface ResearchResult {
	completed: boolean
	outputDir: string
	wasStale: boolean
}

const RESEARCH_STALE_DAYS = 30

export async function runResearch(
	accountKey: AccountKey,
	accountDataDir: string,
	forceResearch: boolean = false
): Promise<ResearchResult> {
	const prospectingDir = join(accountDataDir, 'prospecting')

	// Check if research is stale
	const isStale = await checkResearchStale(prospectingDir)

	if (!forceResearch && !isStale) {
		console.log('   Using cached research (not stale)')
		return {
			completed: false,
			outputDir: prospectingDir,
			wasStale: false,
		}
	}

	// Run amp-prospector
	await executeProspector(accountKey, prospectingDir)

	return {
		completed: true,
		outputDir: prospectingDir,
		wasStale: isStale,
	}
}

async function checkResearchStale(prospectingDir: string): Promise<boolean> {
	try {
		// Check if directory exists and has files
		const entries = await readdir(prospectingDir)

		if (entries.length === 0) {
			return true // No research done yet
		}

		// Check modification time of directory
		const stats = await stat(prospectingDir)
		const ageMs = Date.now() - stats.mtimeMs
		const ageDays = ageMs / (1000 * 60 * 60 * 24)

		return ageDays > RESEARCH_STALE_DAYS
	} catch (error) {
		// Directory doesn't exist or error reading
		return true
	}
}

async function executeProspector(
	accountKey: AccountKey,
	outputDir: string
): Promise<void> {
	console.log(`   Running amp-prospector for ${accountKey.name}...`)

	// TODO: Import and call runProspector from amp-prospector
	// This requires amp-prospector to be available as a local package or imported module

	// For now, provide instructions
	console.warn(
		`   amp-prospector integration stubbed. To integrate:
   1. Add amp-prospector as a local dependency or import
   2. Call: await runProspector({ 
        companyName: "${accountKey.name}", 
        domain: "${accountKey.domain || ''}", 
        outputDir: "${outputDir}" 
      })`
	)

	// Placeholder for actual integration:
	/*
	import { runProspector } from '../../../amp-prospector/src/orchestrator.js'
	
	await runProspector({
		companyName: accountKey.name,
		domain: accountKey.domain,
		outputDir,
		skipWeb: false,
	})
	*/
}
