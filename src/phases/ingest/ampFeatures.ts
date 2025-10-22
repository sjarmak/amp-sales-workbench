import { readFile } from 'fs/promises'
import { join } from 'path'

export interface AmpFeature {
	name: string
	description: string
	tags: string[]
	sourceUrl: string
	sectionId?: string
}

export interface AmpFeaturesTable {
	generatedAt: string
	sourceUrls: string[]
	features: AmpFeature[]
}

export interface AmpContentSection {
	source: 'news' | 'manual'
	heading: string
	level: number
	content: string
	lineNumber: number
}

export interface AmpSummaryTable {
	generatedAt: string
	sections: {
		news: AmpContentSection[]
		manual: AmpContentSection[]
	}
	stats: {
		newsHeadings: number
		manualHeadings: number
		totalWords: number
	}
}

const KEYWORD_TO_TAG = {
	analytics: ['analytics'],
	sdk: ['sdk', 'integration'],
	api: ['api', 'integration'],
	workflow: ['workflow', 'automation'],
	agent: ['agent', 'ai'],
	oracle: ['oracle', 'ai'],
	search: ['search', 'codebase'],
	tool: ['tools'],
	mcp: ['mcp', 'integration'],
	claude: ['claude', 'ai'],
	'model context protocol': ['mcp', 'integration'],
	git: ['git', 'version-control'],
	test: ['testing'],
	debug: ['debugging'],
	'code review': ['code-review'],
	refactor: ['refactoring'],
}

/**
 * Extract features from markdown content
 * Parses headings and content to create structured feature entries
 */
export function extractFeaturesFromMarkdown(
	markdown: string,
	sourceUrl: string
): AmpFeature[] {
	const features: AmpFeature[] = []
	const lines = markdown.split('\n')
	let currentFeature: Partial<AmpFeature> | null = null
	let descriptionLines: string[] = []

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim()

		// Check for h2 or h3 heading
		const h2Match = line.match(/^##\s+(.+)$/)
		const h3Match = line.match(/^###\s+(.+)$/)

		if (h2Match || h3Match) {
			// Save previous feature if exists
			if (currentFeature && currentFeature.name) {
				const description = descriptionLines
					.join(' ')
					.trim()
					.replace(/\s+/g, ' ')
				if (description) {
					currentFeature.description = description
					currentFeature.tags = inferTags(currentFeature.name, description)
					features.push(currentFeature as AmpFeature)
				}
			}

			// Start new feature
			const heading = (h2Match || h3Match)![1]
			const cleanHeading = heading
				.replace(/[#*`]/g, '')
				.trim()
			
			// Skip generic headings
			if (
				cleanHeading.toLowerCase().includes('table of contents') ||
				cleanHeading.toLowerCase().includes('overview') ||
				cleanHeading.toLowerCase() === 'introduction'
			) {
				currentFeature = null
				descriptionLines = []
				continue
			}

			currentFeature = {
				name: cleanHeading,
				sourceUrl,
				sectionId: cleanHeading.toLowerCase().replace(/\s+/g, '-'),
			}
			descriptionLines = []
		} else if (currentFeature && line) {
			// Add to description (skip empty lines at start)
			if (descriptionLines.length > 0 || line) {
				// Clean up markdown artifacts
				const cleaned = line
					.replace(/^\*\s+/, '• ') // Convert markdown bullets
					.replace(/^\-\s+/, '• ')
					.replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold
					.replace(/`(.+?)`/g, '$1') // Remove inline code
					.replace(/\[(.+?)\]\(.+?\)/g, '$1') // Convert links to text
				
				if (cleaned && !cleaned.startsWith('#')) {
					descriptionLines.push(cleaned)
				}
			}
		}
	}

	// Save last feature
	if (currentFeature && currentFeature.name) {
		const description = descriptionLines
			.join(' ')
			.trim()
			.replace(/\s+/g, ' ')
		if (description) {
			currentFeature.description = description
			currentFeature.tags = inferTags(currentFeature.name, description)
			features.push(currentFeature as AmpFeature)
		}
	}

	return features
}

/**
 * Infer tags from feature name and description based on keywords
 */
function inferTags(name: string, description: string): string[] {
	const combined = `${name} ${description}`.toLowerCase()
	const tags = new Set<string>()

	for (const [keyword, keywordTags] of Object.entries(KEYWORD_TO_TAG)) {
		if (combined.includes(keyword)) {
			keywordTags.forEach(tag => tags.add(tag))
		}
	}

	// Default tag if none found
	if (tags.size === 0) {
		tags.add('general')
	}

	return Array.from(tags)
}

/**
 * Extract content sections from markdown for summary table
 */
export function extractContentSections(
	markdown: string,
	source: 'news' | 'manual'
): AmpContentSection[] {
	const sections: AmpContentSection[] = []
	const lines = markdown.split('\n')
	let currentSection: Partial<AmpContentSection> | null = null
	let contentLines: string[] = []
	let lineNumber = 0

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]
		lineNumber = i + 1

		// Check for headings
		const h1Match = line.match(/^#\s+(.+)$/)
		const h2Match = line.match(/^##\s+(.+)$/)
		const h3Match = line.match(/^###\s+(.+)$/)

		if (h1Match || h2Match || h3Match) {
			// Save previous section
			if (currentSection && currentSection.heading) {
				sections.push({
					...currentSection,
					content: contentLines.join('\n').trim(),
				} as AmpContentSection)
			}

			// Start new section
			const level = h1Match ? 1 : h2Match ? 2 : 3
			const heading = (h1Match || h2Match || h3Match)![1].replace(/[#*`]/g, '').trim()

			currentSection = {
				source,
				heading,
				level,
				lineNumber,
			}
			contentLines = []
		} else if (currentSection && line.trim()) {
			// Add to current section content (skip empty lines at start)
			if (contentLines.length > 0 || line.trim()) {
				contentLines.push(line)
			}
		}
	}

	// Save last section
	if (currentSection && currentSection.heading) {
		sections.push({
			...currentSection,
			content: contentLines.join('\n').trim(),
		} as AmpContentSection)
	}

	return sections
}

/**
 * Generate summary table from news and manual markdown files
 */
export async function generateSummaryTable(
	globalCacheDir: string
): Promise<AmpSummaryTable> {
	const newsPath = join(globalCacheDir, 'news.md')
	const manualPath = join(globalCacheDir, 'manual.md')

	const newsSections: AmpContentSection[] = []
	const manualSections: AmpContentSection[] = []
	let totalWords = 0

	// Extract from news
	try {
		const newsContent = await readFile(newsPath, 'utf-8')
		const sections = extractContentSections(newsContent, 'news')
		newsSections.push(...sections)
		totalWords += newsContent.split(/\s+/).length
	} catch (err) {
		console.warn('Could not read news.md:', err)
	}

	// Extract from manual
	try {
		const manualContent = await readFile(manualPath, 'utf-8')
		const sections = extractContentSections(manualContent, 'manual')
		manualSections.push(...sections)
		totalWords += manualContent.split(/\s+/).length
	} catch (err) {
		console.warn('Could not read manual.md:', err)
	}

	return {
		generatedAt: new Date().toISOString(),
		sections: {
			news: newsSections,
			manual: manualSections,
		},
		stats: {
			newsHeadings: newsSections.length,
			manualHeadings: manualSections.length,
			totalWords,
		},
	}
}

/**
 * Generate features table from news and manual markdown files
 */
export async function generateFeaturesTable(
	globalCacheDir: string
): Promise<AmpFeaturesTable> {
	const newsPath = join(globalCacheDir, 'news.md')
	const manualPath = join(globalCacheDir, 'manual.md')

	const features: AmpFeature[] = []

	// Extract from manual
	try {
		const manualContent = await readFile(manualPath, 'utf-8')
		const manualFeatures = extractFeaturesFromMarkdown(
			manualContent,
			'https://ampcode.com/manual'
		)
		features.push(...manualFeatures)
	} catch (err) {
		console.warn('Could not read manual.md:', err)
	}

	// Extract from news
	try {
		const newsContent = await readFile(newsPath, 'utf-8')
		const newsFeatures = extractFeaturesFromMarkdown(
			newsContent,
			'https://ampcode.com/news'
		)
		// Add "news" tag to all news features
		newsFeatures.forEach(f => {
			if (!f.tags.includes('news')) {
				f.tags.push('news')
			}
		})
		features.push(...newsFeatures)
	} catch (err) {
		console.warn('Could not read news.md:', err)
	}

	// Deduplicate by normalized name
	const uniqueFeatures = new Map<string, AmpFeature>()
	for (const feature of features) {
		const key = feature.name.toLowerCase().trim()
		const existing = uniqueFeatures.get(key)
		
		if (existing) {
			// Merge descriptions
			existing.description += ` ${feature.description}`
			// Merge tags
			feature.tags.forEach(tag => {
				if (!existing.tags.includes(tag)) {
					existing.tags.push(tag)
				}
			})
		} else {
			uniqueFeatures.set(key, feature)
		}
	}

	return {
		generatedAt: new Date().toISOString(),
		sourceUrls: ['https://ampcode.com/news', 'https://ampcode.com/manual'],
		features: Array.from(uniqueFeatures.values()),
	}
}
