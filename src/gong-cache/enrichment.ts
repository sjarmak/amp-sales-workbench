/**
 * Company Name Extraction from Gong Call Titles
 * 
 * Extracts company/account names from call titles using regex patterns.
 * Common patterns:
 * - "Company <> Sourcegraph"
 * - "Sourcegraph x Company"
 * - "Company / Sourcegraph"
 * - "Company & Sourcegraph"
 * - "Company - Sourcegraph"
 */

const SOURCEGRAPH_VARIANTS = ['sourcegraph', 'amp']

// Separator patterns between company names
const SEPARATORS = [
	'<>',
	'x',
	'//',
	'/',
	'&',
	'\\+',
	'\\|',
	'-',
	'–', // en-dash
	'—', // em-dash
]

// Build regex pattern to match company names
// Matches: "CompanyName [separator] Sourcegraph" or "Sourcegraph [separator] CompanyName"
// Non-greedy match with word boundary to avoid capturing too much
const SEPARATOR_REGEX = new RegExp(
	`([A-Za-z0-9][A-Za-z0-9\\s&'.]+?)\\s*(?:${SEPARATORS.join('|')})\\s*(?:${SOURCEGRAPH_VARIANTS.join('|')})(?:\\s|:|$)`,
	'gi'
)

const REVERSE_SEPARATOR_REGEX = new RegExp(
	`(?:${SOURCEGRAPH_VARIANTS.join('|')})\\s*(?:${SEPARATORS.join('|')})\\s*([A-Za-z0-9][A-Za-z0-9\\s&'.]+?)(?:\\s*(?:[:|]|$))`,
	'gi'
)

/**
 * Extract company names from a call title
 * Returns array of lowercase company names
 */
export function extractCompanyNames(title: string): string[] {
	const companies = new Set<string>()
	
	if (!title) {
		return []
	}
	
	// Pattern 1: "Company <separator> Sourcegraph"
	let match
	SEPARATOR_REGEX.lastIndex = 0
	while ((match = SEPARATOR_REGEX.exec(title)) !== null) {
		let companyName = match[1].trim().toLowerCase()
		// Clean up trailing words like "bi-weekly", "office"
		companyName = companyName.replace(/\s+(bi-weekly|office|hours|sync|call|meeting|weekly|monthly)$/i, '')
		companyName = companyName.trim()
		
		if (companyName && companyName.length > 1 && !SOURCEGRAPH_VARIANTS.includes(companyName)) {
			companies.add(companyName)
		}
	}
	
	// Pattern 2: "Sourcegraph <separator> Company"
	REVERSE_SEPARATOR_REGEX.lastIndex = 0
	while ((match = REVERSE_SEPARATOR_REGEX.exec(title)) !== null) {
		let companyName = match[1].trim().toLowerCase()
		// Clean up trailing/leading noise
		companyName = companyName.replace(/\s+(bi-weekly|office|hours|sync|call|meeting|weekly|monthly)$/i, '')
		companyName = companyName.trim()
		
		if (companyName && companyName.length > 1 && !SOURCEGRAPH_VARIANTS.includes(companyName)) {
			companies.add(companyName)
		}
	}
	
	// If no companies found, try to extract first word before common separators
	if (companies.size === 0) {
		const firstWord = title.split(/[\s\-–—/\\|<>:]/)[0]?.trim().toLowerCase()
		if (firstWord && firstWord.length > 2 && !SOURCEGRAPH_VARIANTS.includes(firstWord)) {
			companies.add(firstWord)
		}
	}
	
	return Array.from(companies)
}

/**
 * Test cases for company name extraction
 */
export function testExtraction() {
	const testCases = [
		{ title: 'AcmeCorp<>Sourcegraph: Monthly Cadence', expected: ['acmecorp'] },
		{ title: 'Sourcegraph x TechInc - Amp Power user catch up', expected: ['techinc'] },
		{ title: 'GlobalCo / Sourcegraph Connect', expected: ['globalco'] },
		{ title: 'MegaBank & Amp - Sourcegraph', expected: ['megabank', 'amp'] },
		{ title: 'FinCorp + Sourcegraph | Amp Next Steps', expected: ['fincorp'] },
		{ title: 'TradeX <> Sourcegraph Reconnect | Amp Alignment', expected: ['tradex'] },
		{ title: 'Sourcegraph // DevShop bi-weekly call', expected: ['devshop'] },
		{ title: 'SecOps <> Sourcegraph Weekly Sync', expected: ['secops'] },
		{ title: 'Amp x CloudNet - Power user Tips', expected: ['cloudnet'] },
		{ title: 'Sourcegraph Office Hours', expected: ['sourcegraph'] }, // Edge case
	]
	
	console.log('Testing company name extraction:')
	let passed = 0
	let failed = 0
	
	for (const testCase of testCases) {
		const result = extractCompanyNames(testCase.title)
		const success = testCase.expected.every(exp => result.includes(exp))
		
		if (success) {
			console.log(`✓ "${testCase.title}" → ${JSON.stringify(result)}`)
			passed++
		} else {
			console.log(`✗ "${testCase.title}"`)
			console.log(`  Expected: ${JSON.stringify(testCase.expected)}`)
			console.log(`  Got:      ${JSON.stringify(result)}`)
			failed++
		}
	}
	
	console.log(`\nResults: ${passed} passed, ${failed} failed`)
}
