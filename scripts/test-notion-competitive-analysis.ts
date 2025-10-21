#!/usr/bin/env tsx
/**
 * Test script to retrieve and display Amp Competitive Analysis from Notion
 * 
 * Usage: npx tsx scripts/test-notion-competitive-analysis.ts
 */

import { writeFileSync } from 'fs'
import { join } from 'path'
import { callNotionTool } from '../src/mcp-client.js'

const COMPETITIVE_ANALYSIS_PAGE_ID = '273a8e11-2658-8007-9d21-fa5f21d05564'

interface NotionBlock {
  id: string
  type: string
  [key: string]: any
}

interface NotionPage {
  id: string
  properties: {
    Page?: {
      title: Array<{
        plain_text: string
      }>
    }
  }
  [key: string]: any
}

/**
 * Extract text content from Notion rich text array
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
  const blocks: NotionBlock[] = data.results || []
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
        break

      case 'heading_3':
        content.push(`${prefix}### ${extractRichText(block.heading_3.rich_text)}`)
        break

      case 'paragraph':
        const text = extractRichText(block.paragraph.rich_text)
        if (text.trim()) {
          content.push(`${prefix}${text}`)
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

      case 'table':
        content.push(`${prefix}[Table with ${block.table.table_width} columns]`)
        if (block.has_children) {
          const childContent = await extractBlockContent(block.id, indent + 1)
          content.push(...childContent)
        }
        break

      case 'table_row':
        const cells = block.table_row.cells || []
        const cellTexts = cells.map((cell: any[]) => extractRichText(cell))
        content.push(`${prefix}| ${cellTexts.join(' | ')} |`)
        break

      case 'divider':
        content.push(`${prefix}---`)
        break

      case 'column_list':
        if (block.has_children) {
          const childContent = await extractBlockContent(block.id, indent)
          content.push(...childContent)
        }
        break

      case 'column':
        if (block.has_children) {
          const childContent = await extractBlockContent(block.id, indent)
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
        break

      case 'quote':
        content.push(`${prefix}> ${extractRichText(block.quote.rich_text)}`)
        break

      default:
        // Skip unknown block types silently
        break
    }
  }

  return content
}

/**
 * Main function to retrieve and display competitive analysis
 */
async function main() {
  console.log('🔍 Retrieving Amp Competitive Analysis from Notion...\n')

  try {
    // Retrieve page metadata
    const page: NotionPage = await callNotionTool('API-retrieve-a-page', {
      page_id: COMPETITIVE_ANALYSIS_PAGE_ID
    })
    const title = page.properties?.Page?.title?.[0]?.plain_text || 'Competitive Analysis'

    console.log(`📄 Page: ${title}`)
    console.log(`🔗 URL: ${page.url}\n`)
    console.log('=' .repeat(80))

    // Extract all block content
    const content = await extractBlockContent(COMPETITIVE_ANALYSIS_PAGE_ID)

    // Display content
    console.log(content.join('\n'))
    console.log('\n' + '='.repeat(80))

    // Save to markdown file for reference
    const outputPath = join(process.cwd(), 'data', 'notion-competitive-analysis.md')
    const markdown = `# ${title}\n\nRetrieved from: ${page.url}\nLast edited: ${page.last_edited_time}\n\n${content.join('\n')}`

    writeFileSync(outputPath, markdown, 'utf-8')
    console.log(`\n✅ Content saved to: ${outputPath}`)

    // Save raw JSON for debugging
    const jsonPath = join(process.cwd(), 'data', 'notion-competitive-analysis.json')
    writeFileSync(
      jsonPath,
      JSON.stringify({ page, content: content.join('\n') }, null, 2),
      'utf-8'
    )
    console.log(`✅ Raw JSON saved to: ${jsonPath}`)

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

main()
