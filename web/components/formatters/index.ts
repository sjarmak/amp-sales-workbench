export { MeetingSummaryFormatter } from './MeetingSummaryFormatter'
export { DiscoveryRecapFormatter } from './DiscoveryRecapFormatter'
export { CustomDemoFormatter } from './CustomDemoFormatter'
export { RiskHeuristicsFormatter } from './RiskHeuristicsFormatter'
export { PostCallUpdateFormatter } from './PostCallUpdateFormatter'
export { ExecSummaryFormatter } from './ExecSummaryFormatter'
export { CoachingFormatter } from './CoachingFormatter'
export { QualificationFormatter } from './QualificationFormatter'
export { HandoffFormatter } from './HandoffFormatter'

/**
 * Registry of agent output formatters
 * Maps agent IDs to their respective formatter components
 */
export const AGENT_FORMATTERS: Record<string, any> = {
  'meeting_summary': 'MeetingSummaryFormatter',
  'discovery_recap': 'DiscoveryRecapFormatter',
  'custom_demo_plan': 'CustomDemoFormatter',
  'risk_heuristics': 'RiskHeuristicsFormatter',
  'postcall': 'PostCallUpdateFormatter',
  'exec_summary': 'ExecSummaryFormatter',
  'coaching': 'CoachingFormatter',
  'qualification': 'QualificationFormatter',
  'handoff': 'HandoffFormatter',
}

/**
 * Determine if a given agent ID has a dedicated formatter
 */
export function hasFormatter(agentId: string): boolean {
  return agentId in AGENT_FORMATTERS
}

/**
 * Get the formatter name for an agent ID
 */
export function getFormatterName(agentId: string): string | null {
  return AGENT_FORMATTERS[agentId] || null
}
