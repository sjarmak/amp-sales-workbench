/**
 * Agent Runner - Unified interface for executing agents via API
 * 
 * This module provides a single entry point for the API server to execute
 * agents with MCP access through Amp SDK context.
 */

import type { AccountKey } from '../types.js';
import type { OpportunityContext, LifecycleStageId } from '../agentTypes.js';
import { refreshData } from './refreshData.js';
import { createDataLayerService } from '../services/dataLayerService.js';
import path from 'path';
import { promises as fs } from 'fs';

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
  | 'closedwon'
  | 'win-story'
  | 'loss-analysis'
  | 'backfill'
  | 'handoff'
  | 'full-refresh'
  | 'prospector'
  | 'risk-heuristics'
  | 'meeting-summary'
  | 'solution-map'
  | 'business-case'
  | 'evaluation-criteria'
  | 'exec-talking-points'
  | 'mutual-action-plan'
  | 'custom-demo-plan'
  | 'live-qna';

export interface AgentOptions {
  accountName: string;
  callId?: string;
  meetingDate?: string;
  meetingTitle?: string;
  meetingAgenda?: string;
  forceMeetingType?: string;
  apply?: boolean;
  mode?: 'auto' | 'incremental' | 'full';
  sources?: string;
  opportunityId?: string;
  handoffType?: string;
  methodology?: string;
  products?: string[];
  question?: string;
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
 * Build an OpportunityContext from account data
 */
async function buildContext(
  accountKey: AccountKey,
  accountDataDir: string
): Promise<OpportunityContext> {
  let salesforceSnapshot: any = {};
  let activities: any[] = [];
  let stage: LifecycleStageId = 'prospecting';
  
  try {
    const sfPath = path.join(accountDataDir, 'raw', 'salesforce.json');
    const sfData = JSON.parse(await fs.readFile(sfPath, 'utf-8'));
    salesforceSnapshot = {
      account: sfData.account,
      opportunity: sfData.opportunities?.[0],
      contacts: sfData.contacts || [],
    };
    
    // Infer stage from opportunity
    if (sfData.opportunities?.[0]?.StageName) {
      const sfStage = sfData.opportunities[0].StageName.toLowerCase();
      if (sfStage.includes('prospect') || sfStage.includes('qualification')) {
        stage = 'prospecting';
      } else if (sfStage.includes('discovery') || sfStage.includes('demo')) {
        stage = 'qualification';
      } else if (sfStage.includes('proposal') || sfStage.includes('value')) {
        stage = 'solution_mapping';
      } else if (sfStage.includes('negotiation') || sfStage.includes('poc')) {
        stage = 'validation';
      } else if (sfStage.includes('closed won') || sfStage.includes('pending')) {
        stage = 'handoff_close';
      } else if (sfStage.includes('closed')) {
        stage = 'post_mortem';
      }
    }
  } catch {
    // No SF data
  }
  
  try {
    const gongPath = path.join(accountDataDir, 'raw', 'gong.json');
    const gongData = JSON.parse(await fs.readFile(gongPath, 'utf-8'));
    activities = (gongData.calls || []).slice(0, 10).map((c: any) => ({
      id: c.id,
      type: 'gong_call' as const,
      date: c.started || c.scheduled,
      title: c.title || 'Call',
      summary: c.summary,
      participants: c.parties?.map((p: any) => p.name).filter(Boolean) || [],
      duration: c.duration,
      source: 'gong',
    }));
  } catch {
    // No Gong data
  }
  
  return {
    accountId: accountKey.salesforceId || accountKey.name,
    accountName: accountKey.name,
    accountDomain: accountKey.domain,
    opportunityId: salesforceSnapshot.opportunity?.Id,
    opportunityName: salesforceSnapshot.opportunity?.Name,
    stage,
    products: [],
    salesforceSnapshot,
    activities,
    knowledgeDocs: [],
    artifacts: [],
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
    // Resolve account using DataLayerService for accurate Salesforce ID lookup
    let accountSlug = options.accountName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    let accountKey: AccountKey = {
      name: options.accountName,
    };
    
    try {
      const dataLayer = await createDataLayerService(process.cwd());
      const searchResults = dataLayer.searchAccounts(options.accountName, { limit: 1 });
      
      if (searchResults.length > 0) {
        const foundAccount = searchResults[0].account;
        accountKey.salesforceId = foundAccount.account_id;
        accountKey.domain = foundAccount.company_domain_name_c || undefined;
        
        // Try to infer slug from company name if available
        if (foundAccount.name) {
          accountSlug = foundAccount.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        }
      }
    } catch (error) {
      // DataLayerService unavailable - fall back to file-based lookup
      console.warn(`DataLayerService lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}, falling back to metadata.json`);
      
      try {
        const accountDataDir = `data/accounts/${accountSlug}`;
        const metadataPath = path.join(accountDataDir, 'metadata.json');
        const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
        accountKey.domain = metadata.domain;
        accountKey.salesforceId = metadata.salesforceId;
      } catch {
        // Metadata doesn't exist or is invalid, use defaults
      }
    }
    
    const accountDataDir = `data/accounts/${accountSlug}`;
    
    // Build context for new-style agents
    const context = await buildContext(accountKey, accountDataDir);
    
    let result: any;
    
    switch (agentName) {
      case 'precall-brief': {
        const { executePreCallBrief } = await import('./preCallBrief.js');
        result = await executePreCallBrief(context, {
          meetingDate: options.meetingDate,
          meetingTitle: options.meetingTitle,
          forceMeetingType: options.forceMeetingType as any,
        });
        break;
      }
        
      case 'qualification': {
        const { executeQualification } = await import('./qualification.js');
        const methodology = (options.methodology || 'MEDDIC') as 'MEDDIC' | 'BANT' | 'SPICED';
        result = await executeQualification(context, { methodology });
        break;
      }
        
      case 'exec-summary': {
        const { executeExecSummary } = await import('./execSummary.js');
        result = await executeExecSummary(context);
        break;
      }
        
      case 'deal-review': {
        const { executeDealReview } = await import('./dealReview.js');
        result = await executeDealReview(context);
        break;
      }
        
      case 'full-refresh':
        result = await refreshData(accountKey, {
          mode: 'full',
          sources: ['all']
        });
        break;
        
      case 'postcall': {
        const { executePostCallUpdate } = await import('./postCallUpdate.js');
        const { buildOpportunityContext } = await import('../context/buildOpportunityContext.js');
        if (!options.callId) {
          throw new Error('callId is required for postcall agent');
        }
        // Rebuild context with transcript for postcall agent
        const postcallContext = await buildOpportunityContext({
          accountSlug: accountKey.name?.toLowerCase().replace(/\s+/g, '-') || 'unknown',
          includeTranscript: true,
          transcriptCallId: options.callId,
          includeProductDocs: false,
        });
        result = await executePostCallUpdate(postcallContext, { callId: options.callId });
        break;
      }
        
      case 'demo-ideas': {
        const { generateDemoIdea } = await import('./demoIdea.js');
        result = await generateDemoIdea(accountKey, accountDataDir);
        break;
      }
        
      case 'email': {
        const { executeFollowUpEmail } = await import('./followUpEmail.js');
        const { buildOpportunityContext } = await import('../context/buildOpportunityContext.js');
        if (!options.callId) {
          throw new Error('callId is required for email agent');
        }
        // Rebuild context with transcript for email agent
        const emailContext = await buildOpportunityContext({
          accountSlug: accountKey.name?.toLowerCase().replace(/\s+/g, '-') || 'unknown',
          includeTranscript: true,
          transcriptCallId: options.callId,
          includeProductDocs: false,
        });
        result = await executeFollowUpEmail(emailContext, { callId: options.callId });
        break;
      }
        
      case 'coaching': {
        const { executeCoaching } = await import('./coaching.js');
        const { buildOpportunityContext } = await import('../context/buildOpportunityContext.js');
        if (!options.callId) {
          throw new Error('callId is required for coaching agent');
        }
        // Rebuild context with transcript for coaching agent
        const coachingContext = await buildOpportunityContext({
          accountSlug: accountKey.name?.toLowerCase().replace(/\s+/g, '-') || 'unknown',
          includeTranscript: true,
          transcriptCallId: options.callId,
          includeProductDocs: false,
        });
        result = await executeCoaching(coachingContext, { callId: options.callId });
        break;
      }
        
      case 'closedlost': {
        const { executeClosedLost } = await import('./closedLost.js');
        result = await executeClosedLost(context, { opportunityId: options.opportunityId });
        break;
      }
        
      case 'closedwon': {
        const { executeClosedWon } = await import('./closedWon.js');
        result = await executeClosedWon(context, { opportunityId: options.opportunityId });
        break;
      }
        
      case 'win-story': {
        const { executeWinStory } = await import('./winStory.js');
        result = await executeWinStory(context, { opportunityId: options.opportunityId });
        break;
      }
        
      case 'loss-analysis': {
        const { executeLossAnalysis } = await import('./lossAnalysis.js');
        result = await executeLossAnalysis(context, { opportunityId: options.opportunityId });
        break;
      }
        
      case 'backfill': {
        const { executeBackfill } = await import('./backfill.js');
        result = await executeBackfill(context);
        break;
      }
        
      case 'handoff': {
        const { executeHandoff } = await import('./handoff.js');
        const handoffType = options.handoffType as any;
        result = await executeHandoff(context, { handoffType });
        break;
      }
        
      case 'prospector':
        // Run amp-prospector (dynamically imported from separate project)
        // Note: This requires amp-prospector to be available at ../../../amp-prospector
        try {
          // Dynamic import to avoid TypeScript rootDir issues
          const prospectorPath = '../../../amp-prospector/src/orchestrator.js';
          const prospectorModule = await import(/* @vite-ignore */ prospectorPath);
          const prospectResult = await prospectorModule.runProspector({
            company: accountKey.name,
            domains: accountKey.domain ? [accountKey.domain] : undefined,
            outDir: path.join(accountDataDir, 'prospecting'),
          });
          result = {
            success: true,
            filesWritten: prospectResult.filesWritten,
            outputDir: prospectResult.outputDir,
            files: prospectResult.manifest.files.map((f: any) => f.path),
          };
        } catch (error: any) {
          result = {
            success: false,
            error: error.message || 'Prospector failed - amp-prospector may not be installed',
          };
        }
        break;
        
      case 'risk-heuristics': {
        const { executeRiskHeuristics } = await import('./riskHeuristics.js');
        result = await executeRiskHeuristics(context);
        break;
      }
        
      case 'meeting-summary': {
        if (!options.callId) {
          throw new Error('callId is required for meeting-summary agent');
        }
        const { executeMeetingSummary } = await import('./meetingSummary.js');
        result = await executeMeetingSummary(context, { callId: options.callId });
        break;
      }
        
      case 'solution-map': {
        const { executeSolutionMap } = await import('./solutionMap.js');
        result = await executeSolutionMap(context, { products: options.products as any });
        break;
      }
        
      case 'business-case': {
        const { executeBusinessCase } = await import('./businessCase.js');
        result = await executeBusinessCase(context);
        break;
      }
        
      case 'evaluation-criteria': {
        const { executeEvaluationCriteria } = await import('./evaluationCriteria.js');
        result = await executeEvaluationCriteria(context, { products: options.products as any });
        break;
      }
        
      case 'exec-talking-points': {
        const { executeExecTalkingPoints } = await import('./execTalkingPoints.js');
        result = await executeExecTalkingPoints(context);
        break;
      }
        
      case 'mutual-action-plan': {
        const { executeMutualActionPlan } = await import('./mutualActionPlan.js');
        result = await executeMutualActionPlan(context, { targetCloseDate: options.targetCloseDate });
        break;
      }
        
      case 'custom-demo-plan': {
        const { executeCustomizedDemo } = await import('./customizedDemo.js');
        result = await executeCustomizedDemo(context, { products: options.products as any });
        break;
      }
        
      case 'live-qna': {
        if (!options.question) {
          throw new Error('question is required for live-qna agent');
        }
        const { executeLiveQna } = await import('./liveQna.js');
        result = await executeLiveQna(context, options.question);
        break;
      }
        
      default:
        throw new Error(`Unknown agent: ${agentName}`);
    }
    
    const duration = Date.now() - startTime;
    
    // Handle AgentOutput format
    if (result && typeof result === 'object' && 'success' in result) {
      return {
        success: result.success,
        output: result.data || result,
        error: result.error,
        metadata: {
          duration,
          timestamp: new Date().toISOString(),
          ...result.metadata,
        },
      };
    }
    
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
      optionalParams: ['meetingDate', 'meetingTitle'],
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
      optionalParams: ['methodology'],
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
      requiredParams: ['accountName', 'callId'],
      optionalParams: [],
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
    'closedwon': {
      name: 'Closed-Won Analysis',
      description: 'Analyze closed-won opportunity for playbook',
      requiredParams: ['accountName'],
      optionalParams: ['opportunityId'],
    },
    'win-story': {
      name: 'Win Story',
      description: 'Capture win story with differentiators and replicable actions',
      requiredParams: ['accountName'],
      optionalParams: ['opportunityId'],
    },
    'loss-analysis': {
      name: 'Loss Analysis',
      description: 'Analyze loss with root causes and prevention strategies',
      requiredParams: ['accountName'],
      optionalParams: ['opportunityId'],
    },
    'backfill': {
      name: 'Data Backfill',
      description: 'Identify missing CRM data to capture',
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
    'solution-map': {
      name: 'Solution Map',
      description: 'Map customer pains to Sourcegraph products',
      requiredParams: ['accountName'],
      optionalParams: ['products'],
    },
    'business-case': {
      name: 'Business Case',
      description: 'Generate ROI and business case documentation',
      requiredParams: ['accountName'],
      optionalParams: [],
    },
    'evaluation-criteria': {
      name: 'Evaluation Criteria',
      description: 'Define success criteria and evaluation rubric',
      requiredParams: ['accountName'],
      optionalParams: ['products'],
    },
    'exec-talking-points': {
      name: 'Exec Talking Points',
      description: 'Prepare talking points for executive engagement',
      requiredParams: ['accountName'],
      optionalParams: [],
    },
    'mutual-action-plan': {
      name: 'Mutual Action Plan',
      description: 'Create initial mutual action plan with milestones',
      requiredParams: ['accountName'],
      optionalParams: ['targetCloseDate'],
    },
    'custom-demo-plan': {
      name: 'Custom Demo Plan',
      description: 'Generate qualification-aware demo plan',
      requiredParams: ['accountName'],
      optionalParams: ['products'],
    },
    'live-qna': {
      name: 'Live Q&A',
      description: 'Answer questions about the customer with context awareness',
      requiredParams: ['accountName', 'question'],
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
