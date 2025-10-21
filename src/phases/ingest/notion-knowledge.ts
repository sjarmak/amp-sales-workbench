/**
 * Notion Knowledge Integration
 * 
 * Retrieves and caches knowledge pages from Notion for use in analysis tasks
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { callNotionTool } from '../../mcp-client.js'

export interface NotionKnowledgeConfig {
  knowledgePages: {
    customerWins?: string
    competitiveAnalysis?: string
    productInfo?: string
  }
  accountsDatabase?: string
}

export interface NotionPageContent {
  id: string
  title: string
  url: string
  lastEdited: string
  content: string
  blocks: any[]
}

/**
 * Load Notion configuration
 */
export function loadNotionConfig(): NotionKnowledgeConfig {
  const configPath = join(process.cwd(), 'notion-config.json')
  
  if (!existsSync(configPath)) {
    throw new Error('notion-config.json not found. Please create it with your page IDs.')
  }
  
  return JSON.parse(readFileSync(configPath, 'utf-8'))
}

/**
 * Extract text from Notion rich text array
 */
function extractRichText(richTextArray: any[]): string {
  if (!richTextArray || !Array.isArray(richTextArray)) return ''
  return richTextArray.map(item => item.plain_text || '').join('')
}

/**
 * Recursively extract content from Notion blocks
 */
async function extractBlockContent(blockId: string, indent: number = 0): Promise<string[]> {
  const data = await callNotionTool('API-get-block-children', { block_id: blockId })
  const blocks: any[] = data.results || []
  const content: string[] = []

  for (const block of blocks) {
    const prefix = '  '.repeat(indent)

    switch (block.type) {
      case 'heading_1':
        content.push(`\n${prefix}# ${extractRichText(block.heading_1.rich_text)}`)
        if (block.has_children) {
          const childContent = await extractBlockContent(block.id, indent + 1)
          content.push(...childContent)
        }
        break

      case 'heading_2':
        content.push(`\n${prefix}## ${extractRichText(block.heading_2.rich_text)}`)
        if (block.has_children) {
          const childContent = await extractBlockContent(block.id, indent + 1)
          content.push(...childContent)
        }
        break

      case 'heading_3':
        content.push(`${prefix}### ${extractRichText(block.heading_3.rich_text)}`)
        if (block.has_children) {
          const childContent = await extractBlockContent(block.id, indent + 1)
          content.push(...childContent)
        }
        break

      case 'paragraph':
        const text = extractRichText(block.paragraph.rich_text)
        if (text.trim()) {
          content.push(`${prefix}${text}`)
        }
        if (block.has_children) {
          const childContent = await extractBlockContent(block.id, indent + 1)
          content.push(...childContent)
        }
        break

      case 'bulleted_list_item':
        content.push(`${prefix}- ${extractRichText(block.bulleted_list_item.rich_text)}`)
        if (block.has_children) {
          const childContent = await extractBlockContent(block.id, indent + 1)
          content.push(...childContent)
        }
        break

      case 'numbered_list_item':
        content.push(`${prefix}1. ${extractRichText(block.numbered_list_item.rich_text)}`)
        if (block.has_children) {
          const childContent = await extractBlockContent(block.id, indent + 1)
          content.push(...childContent)
        }
        break

      case 'toggle':
        content.push(`${prefix}▶ ${extractRichText(block.toggle.rich_text)}`)
        if (block.has_children) {
          const childContent = await extractBlockContent(block.id, indent + 1)
          content.push(...childContent)
        }
        break

      case 'callout':
        content.push(`${prefix}💡 ${extractRichText(block.callout.rich_text)}`)
        if (block.has_children) {
          const childContent = await extractBlockContent(block.id, indent + 1)
          content.push(...childContent)
        }
        break

      case 'quote':
        content.push(`${prefix}> ${extractRichText(block.quote.rich_text)}`)
        if (block.has_children) {
          const childContent = await extractBlockContent(block.id, indent + 1)
          content.push(...childContent)
        }
        break

      case 'divider':
        content.push(`${prefix}---`)
        break

      case 'table':
        if (block.has_children) {
          const childContent = await extractBlockContent(block.id, indent)
          content.push(...childContent)
        }
        break

      case 'table_row':
        const cells = block.table_row.cells || []
        const cellTexts = cells.map((cell: any[]) => extractRichText(cell))
        content.push(`${prefix}| ${cellTexts.join(' | ')} |`)
        break

      case 'column_list':
      case 'column':
        if (block.has_children) {
          const childContent = await extractBlockContent(block.id, indent)
          content.push(...childContent)
        }
        break

      default:
        // Skip unknown block types
        break
    }
  }

  return content
}

/**
 * Retrieve a Notion page with full content
 */
export async function retrieveNotionPage(pageId: string): Promise<NotionPageContent> {
  const page = await callNotionTool('API-retrieve-a-page', { page_id: pageId })
  const title = page.properties?.Page?.title?.[0]?.plain_text || 'Untitled'
  
  const contentLines = await extractBlockContent(pageId)
  const content = contentLines.join('\n')
  
  return {
    id: pageId,
    title,
    url: page.url,
    lastEdited: page.last_edited_time,
    content,
    blocks: contentLines
  }
}

/**
 * Retrieve competitive analysis content
 */
export async function getCompetitiveAnalysis(): Promise<NotionPageContent | null> {
  const config = loadNotionConfig()
  
  if (!config.knowledgePages.competitiveAnalysis) {
    console.warn('Competitive analysis page ID not configured')
    return null
  }
  
  return retrieveNotionPage(config.knowledgePages.competitiveAnalysis)
}

/**
 * Cache Notion content locally
 */
export async function cacheNotionKnowledge(outputDir: string): Promise<void> {
  const config = loadNotionConfig()
  const knowledgeDir = join(outputDir, 'knowledge')
  
  if (!existsSync(knowledgeDir)) {
    mkdirSync(knowledgeDir, { recursive: true })
  }
  
  console.log('📚 Caching Notion knowledge pages...')
  
  // Cache competitive analysis
  if (config.knowledgePages.competitiveAnalysis) {
    console.log('  → Competitive Analysis')
    const content = await retrieveNotionPage(config.knowledgePages.competitiveAnalysis)
    writeFileSync(
      join(knowledgeDir, 'competitive-analysis.json'),
      JSON.stringify(content, null, 2),
      'utf-8'
    )
    writeFileSync(
      join(knowledgeDir, 'competitive-analysis.md'),
      `# ${content.title}\n\nSource: ${content.url}\nLast updated: ${content.lastEdited}\n\n${content.content}`,
      'utf-8'
    )
  }
  
  // Cache customer wins
  if (config.knowledgePages.customerWins) {
    console.log('  → Customer Wins')
    const content = await retrieveNotionPage(config.knowledgePages.customerWins)
    writeFileSync(
      join(knowledgeDir, 'customer-wins.json'),
      JSON.stringify(content, null, 2),
      'utf-8'
    )
  }
  
  // Cache product info
  if (config.knowledgePages.productInfo) {
    console.log('  → Product Info')
    const content = await retrieveNotionPage(config.knowledgePages.productInfo)
    writeFileSync(
      join(knowledgeDir, 'product-info.json'),
      JSON.stringify(content, null, 2),
      'utf-8'
    )
  }
  
  console.log('✅ Knowledge cache updated')
}
