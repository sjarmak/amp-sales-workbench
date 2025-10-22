import { readFile } from 'fs/promises';
import { join } from 'path';
import { callNotionTool } from '../../mcp-client.js';

interface NotionConfig {
	knowledgePages: Record<string, string>;
	accountsDatabase: string;
}

export interface NotionMirrorData {
	accountSlug: string;
	name: string;
	domain?: string;
	salesforceId?: string;
	callSummary?: string;
	contacts?: Array<{ name: string; title?: string; email?: string }>;
	opportunities?: Array<{ name: string; stage: string; amount?: number; closeDate?: string }>;
	nextActions?: string[];
}

export interface NotionMirrorResult {
	success: boolean;
	pageId?: string;
	pageUrl?: string;
	error?: string;
	created?: boolean;
}

async function loadNotionConfig(): Promise<NotionConfig> {
	const configPath = join(process.cwd(), 'notion-config.json');
	const content = await readFile(configPath, 'utf-8');
	return JSON.parse(content);
}

async function findExistingAccountPage(
	databaseId: string,
	accountName: string,
	salesforceId?: string
): Promise<{ id: string; url: string } | null> {
	try {
		const filters: any[] = [];

		if (salesforceId) {
			filters.push({
				property: 'SF ID',
				rich_text: { equals: salesforceId },
			});
		}

		filters.push({
			property: 'Name',
			title: { contains: accountName },
		});

		for (const filter of filters) {
			const result = await callNotionTool('API-post-database-query', {
				database_id: databaseId,
				filter,
			});

			const parsed = JSON.parse(result[0].text);
			if (parsed.results && parsed.results.length > 0) {
				const page = parsed.results[0];
				return {
					id: page.id,
					url: page.url,
				};
			}
		}
	} catch (error) {
		console.error('Failed to search for existing page:', error);
	}

	return null;
}

function buildRichText(text: string): any[] {
	return [{ type: 'text', text: { content: text } }];
}

function formatContactsList(contacts?: Array<{ name: string; title?: string; email?: string }>): string {
	if (!contacts || contacts.length === 0) return 'No contacts found';

	return contacts
		.slice(0, 10)
		.map((c) => {
			const parts = [c.name];
			if (c.title) parts.push(c.title);
			if (c.email) parts.push(c.email);
			return parts.join(' - ');
		})
		.join('\n');
}

function formatOpportunitiesList(
	opportunities?: Array<{ name: string; stage: string; amount?: number; closeDate?: string }>
): string {
	if (!opportunities || opportunities.length === 0) return 'No opportunities found';

	return opportunities
		.slice(0, 10)
		.map((o) => {
			const parts = [o.name, o.stage];
			if (o.amount) parts.push(`$${o.amount.toLocaleString()}`);
			if (o.closeDate) parts.push(o.closeDate);
			return parts.join(' | ');
		})
		.join('\n');
}

function formatNextActions(nextActions?: string[]): string {
	if (!nextActions || nextActions.length === 0) return 'No next actions';

	return nextActions.slice(0, 10).map((action, i) => `${i + 1}. ${action}`).join('\n');
}

async function createNotionPage(databaseId: string, data: NotionMirrorData): Promise<NotionMirrorResult> {
	try {
		const properties: any = {
			Name: {
				title: [{ type: 'text', text: { content: data.name } }],
			},
		};

		if (data.domain) {
			properties.Domain = {
				rich_text: buildRichText(data.domain),
			};
		}

		if (data.salesforceId) {
			properties['SF ID'] = {
				rich_text: buildRichText(data.salesforceId),
			};
		}

		properties['Last Sync'] = {
			date: {
				start: new Date().toISOString().split('T')[0],
			},
		};

		const children: any[] = [];

		if (data.callSummary) {
			children.push(
				{
					type: 'heading_2',
					heading_2: { rich_text: buildRichText('Call Summary') },
				},
				{
					type: 'paragraph',
					paragraph: { rich_text: buildRichText(data.callSummary) },
				}
			);
		}

		if (data.contacts && data.contacts.length > 0) {
			children.push(
				{
					type: 'heading_2',
					heading_2: { rich_text: buildRichText('Contacts') },
				},
				{
					type: 'paragraph',
					paragraph: { rich_text: buildRichText(formatContactsList(data.contacts)) },
				}
			);
		}

		if (data.opportunities && data.opportunities.length > 0) {
			children.push(
				{
					type: 'heading_2',
					heading_2: { rich_text: buildRichText('Opportunities') },
				},
				{
					type: 'paragraph',
					paragraph: { rich_text: buildRichText(formatOpportunitiesList(data.opportunities)) },
				}
			);
		}

		if (data.nextActions && data.nextActions.length > 0) {
			children.push(
				{
					type: 'heading_2',
					heading_2: { rich_text: buildRichText('Next Actions') },
				},
				{
					type: 'paragraph',
					paragraph: { rich_text: buildRichText(formatNextActions(data.nextActions)) },
				}
			);
		}

		const result = await callNotionTool('API-post-page', {
			parent: { database_id: databaseId },
			properties,
			children: children.length > 0 ? children : undefined,
		});

		const parsed = JSON.parse(result[0].text);

		return {
			success: true,
			pageId: parsed.id,
			pageUrl: parsed.url,
			created: true,
		};
	} catch (error) {
		console.error('Failed to create Notion page:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

async function updateNotionPage(pageId: string, data: NotionMirrorData): Promise<NotionMirrorResult> {
	try {
		const properties: any = {
			Name: {
				title: [{ type: 'text', text: { content: data.name } }],
			},
		};

		if (data.domain) {
			properties.Domain = {
				rich_text: buildRichText(data.domain),
			};
		}

		if (data.salesforceId) {
			properties['SF ID'] = {
				rich_text: buildRichText(data.salesforceId),
			};
		}

		properties['Last Sync'] = {
			date: {
				start: new Date().toISOString().split('T')[0],
			},
		};

		await callNotionTool('API-patch-page', {
			page_id: pageId,
			properties,
		});

		const existingBlocks = await callNotionTool('API-get-block-children', {
			block_id: pageId,
			page_size: 100,
		});

		const blocks = JSON.parse(existingBlocks[0].text);
		for (const block of blocks.results || []) {
			try {
				await callNotionTool('API-delete-a-block', { block_id: block.id });
			} catch (deleteError) {
				console.warn(`Failed to delete block ${block.id}:`, deleteError);
			}
		}

		const children: any[] = [];

		if (data.callSummary) {
			children.push(
				{
					type: 'heading_2',
					heading_2: { rich_text: buildRichText('Call Summary') },
				},
				{
					type: 'paragraph',
					paragraph: { rich_text: buildRichText(data.callSummary) },
				}
			);
		}

		if (data.contacts && data.contacts.length > 0) {
			children.push(
				{
					type: 'heading_2',
					heading_2: { rich_text: buildRichText('Contacts') },
				},
				{
					type: 'paragraph',
					paragraph: { rich_text: buildRichText(formatContactsList(data.contacts)) },
				}
			);
		}

		if (data.opportunities && data.opportunities.length > 0) {
			children.push(
				{
					type: 'heading_2',
					heading_2: { rich_text: buildRichText('Opportunities') },
				},
				{
					type: 'paragraph',
					paragraph: { rich_text: buildRichText(formatOpportunitiesList(data.opportunities)) },
				}
			);
		}

		if (data.nextActions && data.nextActions.length > 0) {
			children.push(
				{
					type: 'heading_2',
					heading_2: { rich_text: buildRichText('Next Actions') },
				},
				{
					type: 'paragraph',
					paragraph: { rich_text: buildRichText(formatNextActions(data.nextActions)) },
				}
			);
		}

		if (children.length > 0) {
			await callNotionTool('API-patch-block-children', {
				block_id: pageId,
				children,
			});
		}

		const updatedPage = await callNotionTool('API-retrieve-a-page', { page_id: pageId });
		const parsed = JSON.parse(updatedPage[0].text);

		return {
			success: true,
			pageId: parsed.id,
			pageUrl: parsed.url,
			created: false,
		};
	} catch (error) {
		console.error('Failed to update Notion page:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

export async function mirrorToNotion(data: NotionMirrorData): Promise<NotionMirrorResult> {
	try {
		const config = await loadNotionConfig();

		if (config.accountsDatabase === 'database-id-here') {
			return {
				success: false,
				error: 'Notion accounts database not configured in notion-config.json',
			};
		}

		const existingPage = await findExistingAccountPage(
			config.accountsDatabase,
			data.name,
			data.salesforceId
		);

		if (existingPage) {
			return await updateNotionPage(existingPage.id, data);
		} else {
			return await createNotionPage(config.accountsDatabase, data);
		}
	} catch (error) {
		console.error('mirrorToNotion failed:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}
