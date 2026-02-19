/**
 * Customized Demo Plan Agent
 * 
 * Creates personalized demonstration plans that address specific customer
 * pain points and showcase relevant capabilities.
 * 
 * Now ADS-aware: Extracts customer context from Gong calls and selects
 * demo repositories from the ADS GitHub organization based on their
 * tech stack and pain points.
 * 
 * Designed for the Qualification stage to maximize demo impact.
 */

import type {
	AgentOutput,
	OpportunityContext,
	ProductId,
	AgentInput,
} from '../agentTypes.js'
import { makeSimpleLlmAgent, serializeContext, type Agent, cleanJsonParse, loadSystemPrompt } from './baseAgent.js'
import { extractDemoProfile, isValidDemoProfile, getDefaultDemoProfile, formatDemoProfile } from './lib/demoprofileExtractor.js'
import { selectAdsDemoRepos } from './lib/adsRepositorySelector.js'
import { buildDemoFlowContext, serializeDemoFlowContext } from './lib/demoFlowIntegration.js'
import { AgenticLoopRunner } from './toolCallingHelper.js'
import { getAgentConfig } from '../config/agents.js'
import { commonTools } from '../llmClient.js'

// ============================================================================
// Output Types
// ============================================================================

export interface DemoStep {
	action: string
	query: string
	expectation: string
	talkTrack: string
}

export interface SpecificDemo {
	repository?: string
	steps?: DemoStep[]
	ahaFile?: string
	comparison?: string
}

export interface SelectedRepository {
	repo: string
	rationale: string
	alternateRepo?: string
}

export interface DemoFlowSection {
	section: string
	duration: string
	features: string[]
	painAddressed: string
	talkingPoints: string[]
	customerValue: string
	specificDemo?: SpecificDemo
}

export interface ScenarioRecommendation {
	scenario: string
	product: string
	priority: string
	painAddressed: string
	talkingPoints: string[]
	expectedOutcome: string
}

export interface KeyFeature {
	feature: string
	relevance: string
	competitiveAdvantage: string
}

export interface CompetitiveHandling {
	competitors: string[]
	differentiators: string[]
	objectionResponses: Record<string, string>
}

export interface DemoPreparation {
	environment: string
	preloadTabs?: string[]
	savedSearches?: string[]
	backup: string
}

export interface CustomizedDemoOutput {
	demoObjective: string
	targetAudience: string[]
	duration: string
	selectedRepository?: SelectedRepository
	scenarioRecommendations?: ScenarioRecommendation[]
	demoFlow: DemoFlowSection[]
	keyFeatures: KeyFeature[]
	competitiveHandling: CompetitiveHandling
	closingQuestions: string[]
	successMetrics: string[]
	preparation: DemoPreparation
}

// ============================================================================
// Input Types
// ============================================================================

export interface CustomizedDemoInput {
	products?: ProductId[]
	targetRoles?: string[]
	durationMinutes?: number
	focusPains?: string[]
	competitors?: string[]
}

// ============================================================================
// Agent Implementation
// ============================================================================

/**
 * Build user message for demo planning with ADS repository selection.
 */
function buildUserMessage(context: OpportunityContext, body: CustomizedDemoInput): string {
	try {
		const contextStr = serializeContext(context)

		// Extract demo profile from Gong context
		let profile = extractDemoProfile(context)
		if (!isValidDemoProfile(profile)) {
			if (process.env.DEBUG) {
				console.warn('[customizedDemo] Invalid demo profile, using defaults')
			}
			profile = getDefaultDemoProfile()
		}

	// Select ADS repositories based on profile
	const selectedRepos = selectAdsDemoRepos(profile)
	if (selectedRepos.length === 0 && process.env.DEBUG) {
		console.warn('[customizedDemo] No repositories selected, will use defaults')
	}

	// Build demo flow context for LLM
	const demoFlowContext = buildDemoFlowContext(selectedRepos, profile)
	const contextWithDemo = serializeDemoFlowContext(demoFlowContext)

	if (process.env.DEBUG) {
		console.log('[customizedDemo] Extracted profile:')
		console.log(formatDemoProfile(profile))
		console.log('[customizedDemo] Selected repos:', selectedRepos.map(r => r.name))
	}

	let message = `${contextStr}\n\n`
	message += `## Demo Profile & Repository Selection\n\n`
	message += contextWithDemo
	message += `\n\n## Demo Planning Request\n\n`

	if (body.products && body.products.length > 0) {
		message += `### Products to Demonstrate\n`
		message += body.products.map(p => `- ${p}`).join('\n')
		message += '\n\n'
	}

	if (body.targetRoles && body.targetRoles.length > 0) {
		message += `### Target Audience Roles\n`
		message += body.targetRoles.map(r => `- ${r}`).join('\n')
		message += '\n\n'
	}

	if (body.durationMinutes) {
		message += `### Requested Duration\n`
		message += `${body.durationMinutes} minutes\n\n`
	}

	if (body.focusPains && body.focusPains.length > 0) {
		message += `### Pain Points to Address\n`
		message += body.focusPains.map(p => `- ${p}`).join('\n')
		message += '\n\n'
	}

	if (body.competitors && body.competitors.length > 0) {
		message += `### Known Competitors\n`
		message += body.competitors.map(c => `- ${c}`).join('\n')
		message += '\n\n'
	}

	message += `Based on the account context and selected repositories above, create a customized demo plan that:\n`
	message += `1. ONLY REFERENCES the selected ADS repositories (never Sourcegraph-internal repos)\n`
	message += `2. Leads with customer pain points, not product features\n`
	message += `3. Maps each demo section to specific customer needs\n`
	message += `4. Uses the customer's primary languages in examples\n`
	message += `5. Frames all features in the context of an academic search platform\n`
	message += `6. Includes competitive handling for known competitors\n`
	message += `7. Builds to a compelling "aha moment"\n`
	message += `8. Ends with clear next steps and closing questions\n\n`
	message += `Respond in JSON format matching the CustomizedDemoOutput schema.`

	return message
	} catch (err) {
		console.error('[customizedDemo] Error in buildUserMessage:', err)
		if (err instanceof Error) {
			console.error('Stack:', err.stack)
		}
		throw err
	}
}

/**
 * Parse LLM output to CustomizedDemoOutput.
 */
function parseOutput(content: string): CustomizedDemoOutput {
	try {
		const parsed = cleanJsonParse<any>(content)

		return {
			demoObjective: extractDemoObjective(parsed.demoObjective),
			targetAudience: extractStringArray(parsed.targetAudience),
			duration: extractDuration(parsed.duration),
			selectedRepository: extractSelectedRepository(parsed.selectedRepository),
			scenarioRecommendations: extractScenarioRecommendations(parsed.scenarioRecommendations),
			demoFlow: extractDemoFlow(parsed.demoFlow),
			keyFeatures: extractKeyFeatures(parsed.keyFeatures),
			competitiveHandling: extractCompetitiveHandling(parsed.competitiveHandling),
			closingQuestions: extractStringArray(parsed.closingQuestions),
			successMetrics: extractStringArray(parsed.successMetrics),
			preparation: extractPreparation(parsed.preparation),
		}
	} catch (err) {
		console.error('Failed to parse customized demo output:', err)
		return {
			demoObjective: 'Demonstrate Sourcegraph capabilities',
			targetAudience: [],
			duration: '45 minutes',
			demoFlow: [],
			keyFeatures: [],
			competitiveHandling: {
				competitors: [],
				differentiators: [],
				objectionResponses: {},
			},
			closingQuestions: [],
			successMetrics: [],
			preparation: {
				environment: 'Standard demo environment',
				backup: 'Pre-recorded demo video',
			},
		}
	}
}

/**
 * Extract selected repository info.
 */
function extractSelectedRepository(input: any): SelectedRepository | undefined {
	if (!input) return undefined
	return {
		repo: input.repo || '',
		rationale: input.rationale || '',
		alternateRepo: input.alternateRepo,
	}
}

/**
 * Extract demo objective as a string.
 */
function extractDemoObjective(input: any): string {
	if (!input) return 'Demonstrate Sourcegraph capabilities'
	if (typeof input === 'string') return input
	return String(input)
}

/**
 * Extract duration as a string.
 */
function extractDuration(input: any): string {
	if (!input) return '45 minutes'
	if (typeof input === 'string') return input
	if (typeof input === 'number') return `${input} minutes`
	return String(input)
}

/**
 * Extract string array from various formats.
 */
function extractStringArray(input: any): string[] {
	if (!input) return []
	if (Array.isArray(input)) {
		return input.map(item => String(item))
	}
	if (typeof input === 'string') {
		return [input]
	}
	return []
}

/**
 * Extract scenario recommendations.
 */
function extractScenarioRecommendations(input: any): ScenarioRecommendation[] | undefined {
	if (!input || !Array.isArray(input)) return undefined

	return input.map((item: any) => ({
		scenario: item.scenario || item.name || '',
		product: item.product || '',
		priority: item.priority || 'medium',
		painAddressed: item.painAddressed || '',
		talkingPoints: extractStringArray(item.talkingPoints),
		expectedOutcome: item.expectedOutcome || '',
	}))
}

/**
 * Extract demo steps.
 */
function extractDemoSteps(input: any): DemoStep[] | undefined {
	if (!input || !Array.isArray(input)) return undefined
	return input.map((step: any) => ({
		action: step.action || '',
		query: step.query || '',
		expectation: step.expectation || '',
		talkTrack: step.talkTrack || '',
	}))
}

/**
 * Extract demo flow sections.
 */
function extractDemoFlow(input: any): DemoFlowSection[] {
	if (!input || !Array.isArray(input)) return []

	return input.map((item: any) => ({
		section: item.section || item.name || 'Section',
		duration: extractDuration(item.duration),
		features: extractStringArray(item.features),
		painAddressed: item.painAddressed || item.pain || '',
		talkingPoints: extractStringArray(item.talkingPoints),
		customerValue: item.customerValue || item.value || '',
		specificDemo: item.specificDemo ? {
			repository: item.specificDemo.repository,
			steps: extractDemoSteps(item.specificDemo.steps),
			ahaFile: item.specificDemo.ahaFile,
			comparison: item.specificDemo.comparison,
		} : undefined,
	}))
}

/**
 * Extract key features.
 */
function extractKeyFeatures(input: any): KeyFeature[] {
	if (!input || !Array.isArray(input)) return []

	return input.map((item: any) => ({
		feature: item.feature || item.name || '',
		relevance: item.relevance || item.why || '',
		competitiveAdvantage: item.competitiveAdvantage || item.advantage || '',
	}))
}

/**
 * Extract competitive handling.
 */
function extractCompetitiveHandling(input: any): CompetitiveHandling {
	if (!input) {
		return {
			competitors: [],
			differentiators: [],
			objectionResponses: {},
		}
	}

	return {
		competitors: extractStringArray(input.competitors),
		differentiators: extractStringArray(input.differentiators),
		objectionResponses: extractObjectionResponses(input.objectionResponses),
	}
}

/**
 * Extract objection responses as a record.
 */
function extractObjectionResponses(input: any): Record<string, string> {
	if (!input) return {}
	if (typeof input !== 'object') return {}

	const result: Record<string, string> = {}
	for (const [key, value] of Object.entries(input)) {
		result[key] = String(value)
	}
	return result
}

/**
 * Extract preparation details.
 */
function extractPreparation(input: any): DemoPreparation {
	if (!input) {
		return {
			environment: 'Standard demo environment',
			backup: 'Pre-recorded demo video',
		}
	}

	return {
		environment: input.environment || 'Standard demo environment',
		preloadTabs: extractStringArray(input.preloadTabs),
		savedSearches: extractStringArray(input.savedSearches),
		backup: input.backup || 'Pre-recorded demo video',
	}
}

/**
 * Build system prompt that instructs the agent to use web search.
 */
async function getSystemPromptWithWebSearch(): Promise<string> {
	try {
		const basePrompt = await loadSystemPrompt('prompts/agents/custom_demo_plan.md')
		
		// Add web search instructions
		const enhancedPrompt = basePrompt + `

---

## WEB SEARCH CAPABILITY

You have access to web search and web page reading tools. Use them to:
1. Fetch the latest Sourcegraph documentation from https://sourcegraph.com/docs/
2. Verify current product capabilities and feature status
3. Look up information about the customer's tech stack if needed

When generating demo plans, search for and reference the latest product information
to ensure your recommendations align with current Sourcegraph capabilities.

Important: Only search for official Sourcegraph documentation and verified information.
Do not search for competitor information or customer confidential data.`

		return enhancedPrompt
	} catch (err) {
		console.warn('[customizedDemo] Could not load enhanced prompt, using default:', err)
		return ''
	}
}

/**
 * Create the Customized Demo agent with web search capability via agentic loop.
 */
export function createCustomizedDemoAgent(): Agent<CustomizedDemoInput, CustomizedDemoOutput> {
	const config = getAgentConfig('custom_demo_plan')
	if (!config) {
		throw new Error('Agent config for custom_demo_plan not found')
	}

	return {
		config,
		async execute(input: AgentInput<CustomizedDemoInput>): Promise<AgentOutput<CustomizedDemoOutput>> {
			const startTime = Date.now()
			
			try {
				// Get enhanced system prompt with web search instructions
				const systemPrompt = await getSystemPromptWithWebSearch()
				
				// Build the user message
				const userMessage = buildUserMessage(input.context, input.body)
				
				// Create agentic loop runner with web search tools
				const runner = new AgenticLoopRunner({
					maxIterations: 3, // Limited iterations: search docs, build plan, finalize
					tools: [commonTools.web_search, commonTools.read_web_page],
					verbose: process.env.DEBUG ? true : false,
				})
				
				// Run the agentic loop
				const result = await runner.run({
					config: {
						provider: 'openai',
						model: 'gpt-4o',
						temperature: 0.5,
						maxOutputTokens: 8192,
						costTier: 'quality',
					},
					systemPrompt: systemPrompt || 'You are a Sourcegraph custom demo plan generator.',
					initialQuery: userMessage,
				})
				
				// Parse the output
				const output = parseOutput(result.finalContent)
				
				return {
					success: true,
					data: output,
					metadata: {
						agentId: 'custom_demo_plan',
						stage: input.context.stage,
						executionTimeMs: Date.now() - startTime,
						model: 'gpt-4o',
						tokensUsed: {
							input: result.totalTokens, // Approximation
							output: result.totalTokens,
						},
						timestamp: new Date().toISOString(),
					},
				}
			} catch (err) {
				const error = err instanceof Error ? err.message : String(err)
				if (process.env.DEBUG) {
					console.error('[customizedDemo] Execution error:', error)
				}
				
				return {
					success: false,
					error,
					metadata: {
						agentId: 'custom_demo_plan',
						stage: input.context.stage,
						executionTimeMs: Date.now() - startTime,
						model: 'gpt-4o',
						timestamp: new Date().toISOString(),
					},
				}
			}
		},
	}
}

/**
 * Legacy factory function for backwards compatibility with simple LLM agent pattern.
 */
export function createSimpleCustomizedDemoAgent(): Agent<CustomizedDemoInput, CustomizedDemoOutput> {
	return makeSimpleLlmAgent<CustomizedDemoInput, CustomizedDemoOutput>({
		agentId: 'custom_demo_plan',
		buildUserMessage,
		parseOutput,
		llmOverride: {
			model: 'gpt-4o',
			temperature: 0.5,
			maxOutputTokens: 8192,
		},
	})
}

// ============================================================================
// Direct Execution Functions
// ============================================================================

/**
 * Execute demo planning directly without going through the registry.
 */
export async function executeCustomizedDemo(
	context: OpportunityContext,
	options?: CustomizedDemoInput
): Promise<AgentOutput<CustomizedDemoOutput>> {
	const agent = createCustomizedDemoAgent()
	return agent.execute({
		context,
		body: options || {},
	})
}

/**
 * Quick demo plan for simple cases.
 */
export async function quickCustomizedDemo(
	context: OpportunityContext,
	products?: ProductId[]
): Promise<CustomizedDemoOutput> {
	const result = await executeCustomizedDemo(context, { products })
	if (!result.success) {
		throw new Error(result.error || 'Demo planning failed')
	}
	return result.data!
}

// Export the agent factory
export default createCustomizedDemoAgent
