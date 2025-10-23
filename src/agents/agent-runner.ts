/**
 * Agent Runner - Unified interface for executing agents via API
 * 
 * This module provides a single entry point for the API server to execute
 * agents with MCP access through Amp SDK context.
 */

import type { AccountKey } from '../types.js';
import { generatePreCallBrief } from './preCallBrief.js';
import { refreshData } from './refreshData.js';

export type AgentName = 
  | 'precall-brief'
  | 'postcall'
  | 'demo-ideas'
  | 'qualification'
  | 'email'
  | 'coaching'
  | 'exec-summary'
  | 'deal-review'
  | 'closedlost'
  | 'backfill'
  | 'handoff'
  | 'full-refresh'
  | 'prospector'
  | 'risk-heuristics'
  | 'meeting-summary';

export interface AgentOptions {
  accountName: string;
  callId?: string;
  meetingDate?: string;
  apply?: boolean;
  mode?: 'auto' | 'incremental' | 'full';
  sources?: string;
  [key: string]: any;
}

export interface AgentResult {
  success: boolean;
  output: any;
  error?: string;
  metadata?: {
    duration: number;
    timestamp: string;
  };
}

/**
 * Execute an agent by name with given options
 */
export async function runAgent(
  agentName: AgentName,
  options: AgentOptions
): Promise<AgentResult> {
  const startTime = Date.now();
  
  try {
    const accountKey: AccountKey = {
      name: options.accountName,
    };
    
    const accountSlug = options.accountName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const accountDataDir = `data/accounts/${accountSlug}`;
    
    let result: any;
    
    switch (agentName) {
      case 'precall-brief':
        result = await generatePreCallBrief(accountKey, options.meetingDate, options.callId);
        break;
        
      case 'qualification':
        const { generateQualification } = await import('./qualification.js');
        result = await generateQualification(accountKey, accountDataDir, 'MEDDIC');
        break;
        
      case 'exec-summary':
        const { generateExecutiveSummary } = await import('./execSummary.js');
        result = await generateExecutiveSummary(accountKey, accountDataDir);
        break;
        
      case 'deal-review':
        const { generateDealReview } = await import('./dealReview.js');
        result = await generateDealReview(accountKey, accountDataDir);
        break;
        
      case 'full-refresh':
        result = await refreshData(accountKey, {
          mode: 'full',
          sources: ['all']
        });
        break;
        
      case 'postcall':
        const { generatePostCallUpdate } = await import('./postCallUpdate.js');
        result = await generatePostCallUpdate(accountKey, accountDataDir, options.callId);
        break;
        
      case 'demo-ideas':
        const { generateDemoIdea } = await import('./demoIdea.js');
        result = await generateDemoIdea(accountKey, accountDataDir);
        break;
        
      case 'email':
        const { generateFollowUpEmail } = await import('./followUpEmail.js');
        result = await generateFollowUpEmail(accountKey, accountDataDir, options.callId);
        break;
        
      case 'coaching':
        const { generateCoachingFeedback } = await import('./coaching.js');
        result = await generateCoachingFeedback(accountKey, accountDataDir, options.callId);
        break;
        
      case 'closedlost':
        const { runClosedLostAgent } = await import('./closedLost.js');
        result = await runClosedLostAgent(accountKey, accountDataDir, options.opportunityId);
        break;
        
      case 'backfill':
        const { runBackfillAgent } = await import('./backfill.js');
        result = await runBackfillAgent(accountKey, accountDataDir);
        break;
        
      case 'handoff':
        const { runHandoffAgent } = await import('./handoff.js');
        result = await runHandoffAgent(accountKey, accountDataDir, options.handoffType);
        break;
        
      case 'prospector':
        // Prospector uses amp-prospector external tool
        result = {
          message: 'Prospector integration pending - see amp-prospector repository',
          accountKey,
        };
        break;
        
      case 'risk-heuristics':
        const { analyzeRiskHeuristics } = await import('./riskHeuristics.js');
        result = await analyzeRiskHeuristics(accountKey, accountDataDir);
        break;
        
      case 'meeting-summary':
        if (!options.callId) {
          throw new Error('callId is required for meeting-summary agent');
        }
        const { generateMeetingSummary } = await import('./meetingSummary.js');
        result = await generateMeetingSummary(accountKey, accountDataDir, options.callId);
        break;
        
      default:
        throw new Error(`Unknown agent: ${agentName}`);
    }
    
    const duration = Date.now() - startTime;
    
    return {
      success: true,
      output: result,
      metadata: {
        duration,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    
    return {
      success: false,
      output: null,
      error: error instanceof Error ? error.message : String(error),
      metadata: {
        duration,
        timestamp: new Date().toISOString(),
      },
    };
  }
}

/**
 * Get metadata about available agents
 */
export function getAgentInfo(agentName: AgentName): {
  name: string;
  description: string;
  requiredParams: string[];
  optionalParams: string[];
} {
  const agentInfo: Record<AgentName, any> = {
    'precall-brief': {
      name: 'Pre-Call Brief',
      description: 'Generate a comprehensive pre-call brief with attendees, agenda, and talking points',
      requiredParams: ['accountName'],
      optionalParams: ['meetingDate'],
    },
    'postcall': {
      name: 'Post-Call Update',
      description: 'Generate post-call summary and CRM updates',
      requiredParams: ['accountName'],
      optionalParams: ['callId'],
    },
    'demo-ideas': {
      name: 'Demo Ideas',
      description: 'Generate customized demo ideas based on account context',
      requiredParams: ['accountName'],
      optionalParams: [],
    },
    'qualification': {
      name: 'Qualification (MEDDIC)',
      description: 'Generate MEDDIC qualification report',
      requiredParams: ['accountName'],
      optionalParams: [],
    },
    'email': {
      name: 'Follow-up Email',
      description: 'Generate follow-up email draft',
      requiredParams: ['accountName'],
      optionalParams: ['callId'],
    },
    'coaching': {
      name: 'Call Coaching',
      description: 'Generate call coaching feedback',
      requiredParams: ['accountName'],
      optionalParams: ['callId'],
    },
    'exec-summary': {
      name: 'Executive Summary',
      description: 'Generate executive summary of account status',
      requiredParams: ['accountName'],
      optionalParams: [],
    },
    'deal-review': {
      name: 'Deal Review',
      description: 'Generate comprehensive deal review',
      requiredParams: ['accountName'],
      optionalParams: [],
    },
    'closedlost': {
      name: 'Closed-Lost Analysis',
      description: 'Analyze closed-lost opportunity',
      requiredParams: ['accountName'],
      optionalParams: ['opportunityId'],
    },
    'backfill': {
      name: 'Data Backfill',
      description: 'Backfill missing account data',
      requiredParams: ['accountName'],
      optionalParams: [],
    },
    'handoff': {
      name: 'Handoff Document',
      description: 'Generate handoff document',
      requiredParams: ['accountName'],
      optionalParams: ['handoffType'],
    },
    'full-refresh': {
      name: 'Full Data Refresh',
      description: 'Refresh all data sources',
      requiredParams: ['accountName'],
      optionalParams: [],
    },
    'prospector': {
      name: 'Prospector',
      description: 'Run prospector research',
      requiredParams: ['accountName'],
      optionalParams: [],
    },
    'risk-heuristics': {
      name: 'Risk Heuristics',
      description: 'Analyze deal risks using heuristic detection',
      requiredParams: ['accountName'],
      optionalParams: [],
    },
    'meeting-summary': {
      name: 'Meeting Summary',
      description: 'Generate structured meeting summary from call transcript',
      requiredParams: ['accountName', 'callId'],
      optionalParams: [],
    },
  };
  
  return agentInfo[agentName] || {
    name: agentName,
    description: 'Unknown agent',
    requiredParams: [],
    optionalParams: [],
  };
}
