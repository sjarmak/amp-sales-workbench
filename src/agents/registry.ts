/**
 * Agent Registry
 * 
 * Central registry for all agents. Provides methods to:
 * - Get agent by ID
 * - List all agents
 * - Filter agents by lifecycle stage
 * - Execute agents with proper context
 */

import type {
	AgentId,
	AgentConfig,
	AgentDefinition,
	AgentRegistry,
	LifecycleStageId,
	AgentInput,
	AgentOutput,
} from '../agentTypes.js'
import { AGENTS, getAgentConfig, getAgentsByStage as getConfigsByStage } from '../config/agents.js'
import { makeSimpleLlmAgent, type Agent } from './baseAgent.js'

// ============================================================================
// Agent Instance Cache
// ============================================================================

const agentCache = new Map<AgentId, Agent>()

/**
 * Get or create an agent instance by ID.
 */
function getOrCreateAgent(id: AgentId): Agent | undefined {
	if (agentCache.has(id)) {
		return agentCache.get(id)
	}

	const config = getAgentConfig(id)
	if (!config) {
		return undefined
	}

	// Create a simple LLM agent with default settings
	const agent = makeSimpleLlmAgent({ agentId: id })
	agentCache.set(id, agent)
	return agent
}

// ============================================================================
// Registry Implementation
// ============================================================================

/**
 * Get an agent definition by ID.
 */
export function getAgent(id: AgentId): AgentDefinition | undefined {
	const agent = getOrCreateAgent(id)
	if (!agent) {
		return undefined
	}

	return {
		config: agent.config,
		execute: (input: AgentInput) => agent.execute(input),
	}
}

/**
 * List all agent configurations.
 */
export function listAgents(): AgentConfig[] {
	return [...AGENTS]
}

/**
 * List agents by lifecycle stage.
 */
export function listAgentsByStage(stage: LifecycleStageId): AgentConfig[] {
	return getConfigsByStage(stage)
}

/**
 * Execute an agent by ID with the given input.
 */
export async function executeAgent<T = any>(
	id: AgentId,
	input: AgentInput
): Promise<AgentOutput<T>> {
	const agent = getOrCreateAgent(id)
	if (!agent) {
		return {
			success: false,
			error: `Unknown agent ID: ${id}`,
			metadata: {
				agentId: id,
				stage: 'global',
				executionTimeMs: 0,
				model: 'unknown',
				timestamp: new Date().toISOString(),
			},
		}
	}

	return agent.execute(input) as Promise<AgentOutput<T>>
}

/**
 * Get quick action agents for a lifecycle stage.
 */
export function getQuickActions(stage: LifecycleStageId): AgentConfig[] {
	return getConfigsByStage(stage).filter((config) => {
		// Quick actions are agents that can run without specific call context
		return config.requiredInputs.length === 0 || 
			!config.requiredInputs.includes('callId')
	})
}

/**
 * Get call-dependent agents (need a specific call/transcript).
 */
export function getCallAgents(): AgentConfig[] {
	return AGENTS.filter((config) => 
		config.requiredInputs.includes('callId')
	)
}

/**
 * Clear the agent cache (useful for development/testing).
 */
export function clearAgentCache(): void {
	agentCache.clear()
}

// ============================================================================
// Registry Object (for interface compliance)
// ============================================================================

export const registry: AgentRegistry = {
	get: getAgent,
	list: listAgents,
	listByStage: listAgentsByStage,
}

export default registry
