import { readFile } from 'fs/promises'
import { join } from 'path'

export interface SourcegraphFeature {
	name: string
	description: string
	tags: string[]
	sourceUrl: string
	sectionId?: string
}

export interface SourcegraphFeaturesTable {
	generatedAt: string
	sourceUrls: string[]
	features: SourcegraphFeature[]
}

export interface SourcegraphContentSection {
	source: string // key of URLS
	heading: string
	level: number
	content: string
	lineNumber: number
}

export interface SourcegraphSummaryTable {
	generatedAt: string
	sections: Record<string, SourcegraphContentSection[]>
	stats: {
		totalHeadings: number
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
): SourcegraphFeature[] {
	const features: SourcegraphFeature[] = []
	const lines = markdown.split('\n')
	let currentFeature: Partial<SourcegraphFeature> | null = null
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
					features.push(currentFeature as SourcegraphFeature)
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
			features.push(currentFeature as SourcegraphFeature)
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
	source: string
): SourcegraphContentSection[] {
	const sections: SourcegraphContentSection[] = []
	const lines = markdown.split('\n')
	let currentSection: Partial<SourcegraphContentSection> | null = null
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
				} as SourcegraphContentSection)
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
		} as SourcegraphContentSection)
	}

	return sections
}

/**
 * Generate summary table from all Sourcegraph markdown files
 */
export async function generateSummaryTable(
	globalCacheDir: string,
	pages: Record<string, string>
): Promise<SourcegraphSummaryTable> {
	const sectionsMap: Record<string, SourcegraphContentSection[]> = {}
	let totalWords = 0
	let totalHeadings = 0

	for (const [key, _url] of Object.entries(pages)) {
		const mdPath = join(globalCacheDir, `${key}.md`)
		try {
			const content = await readFile(mdPath, 'utf-8')
			const sections = extractContentSections(content, key)
			sectionsMap[key] = sections
			totalWords += content.split(/\s+/).length
			totalHeadings += sections.length
		} catch (err) {
			console.warn(`Could not read ${key}.md:`, err)
			sectionsMap[key] = []
		}
	}

	return {
		generatedAt: new Date().toISOString(),
		sections: sectionsMap,
		stats: {
			totalHeadings,
			totalWords,
		},
	}
}

/**
 * Generate features table from all Sourcegraph markdown files
 */
export async function generateFeaturesTable(
	globalCacheDir: string,
	pages: Record<string, string>
): Promise<SourcegraphFeaturesTable> {
	const features: SourcegraphFeature[] = []

	for (const [key, url] of Object.entries(pages)) {
		const mdPath = join(globalCacheDir, `${key}.md`)
		try {
			const content = await readFile(mdPath, 'utf-8')
			const pageFeatures = extractFeaturesFromMarkdown(content, url)
			
			// Add source tag
			pageFeatures.forEach(f => {
				if (!f.tags.includes(key)) {
					f.tags.push(key)
				}
			})
			
			features.push(...pageFeatures)
		} catch (err) {
			console.warn(`Could not read ${key}.md:`, err)
		}
	}

	// Deduplicate by normalized name
	const uniqueFeatures = new Map<string, SourcegraphFeature>()
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
		sourceUrls: Object.values(pages),
		features: Array.from(uniqueFeatures.values()),
	}
}
