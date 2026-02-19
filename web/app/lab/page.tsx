'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Play, ArrowLeft, Beaker, CheckCircle2, XCircle, Clock, ChevronDown, ChevronRight, Building2, Users, Lightbulb, Target, Code, History, RefreshCw, MessageSquare, AlertTriangle, CheckSquare, FileText, Calendar, Trash2, Plus, Library, ExternalLink, Presentation, Sparkles, List, Copy, Check } from 'lucide-react'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { Checkbox } from '@/components/ui/checkbox'
import Link from 'next/link'
import type { LifecycleStageId, CostTier } from '@/types/agent'
import { MeetingSummaryFormatter, DiscoveryRecapFormatter, CustomDemoFormatter, RiskHeuristicsFormatter, PostCallUpdateFormatter, ExecSummaryFormatter, CoachingFormatter, QualificationFormatter, HandoffFormatter } from '@/components/formatters'

interface AgentInfo {
  id: string
  label: string
  description: string
  stage: LifecycleStageId
  costTier: CostTier
  requiredInputs: string[]
  optionalInputs: string[]
  model?: string
}
import { LIFECYCLE_STAGES } from '@/lib/lifecycle'

const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    return `http://${window.location.hostname}:3001/api`
  }
  return 'http://localhost:3001/api'
}

interface Account {
  slug: string
  name: string
}

interface GongCall {
  id: string
  title?: string
  subject?: string
  started?: string
  startTime?: string
  scheduled?: string
  duration?: number
  participants?: string[]
  parties?: { name?: string; emailAddress?: string }[]
  hasTranscript?: boolean
}

interface AgentResult {
  success: boolean
  output: any
  error?: string
  runId?: string
  metadata?: {
    duration: number
    timestamp: string
    agentId?: string
    model?: string
    tokensUsed?: { input: number; output: number }
  }
}

interface RunHistoryItem {
  id: string
  timestamp: string
  success: boolean
  duration?: number
  model?: string
}

interface Artifact {
  id: string
  agentId: string
  timestamp: string
  title: string
  summary: string
}

// Helper component for section headers
function SectionHeader({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-5 w-5 text-primary" />
      <h3 className="font-semibold text-lg">{title}</h3>
    </div>
  )
}

// Helper for severity/priority badges
function SeverityBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-green-100 text-green-800',
    critical: 'bg-red-200 text-red-900',
  }
  return <Badge className={colors[level?.toLowerCase()] || 'bg-gray-100 text-gray-800'}>{level}</Badge>
}

// Formatted output renderer for structured agent results
function FormattedOutput({ output }: { output: any }) {
  if (typeof output === 'string') {
    return <pre className="text-sm whitespace-pre-wrap">{output}</pre>
  }

  // Executive Summary output (check before PostCall since both have 'summary')
  if (output.overview && output.dealHealth && output.stakeholders) {
    return <ExecSummaryFormatter data={output} />
  }

  // Coaching output
  if (output.callOverview && output.strengths && output.improvements && output.metrics) {
    return <CoachingFormatter data={output} />
  }

  // Qualification output
  if (output.methodology && output.scores && output.overallAssessment) {
    return <QualificationFormatter data={output} />
  }

  // Handoff output
  if (output.handoffType && output.summary && output.context && output.stakeholders && output.introductionPlan) {
    return <HandoffFormatter data={output} />
  }

  // Post-Call Update output
  if (output.summary && output.keyTakeaways && output.actionItems) {
    return <PostCallUpdateFormatter data={output} />
  }

  // Risk Heuristics output
  if (output.riskScore && output.risks) {
    return <RiskHeuristicsFormatter data={output} />
  }

  // Discovery Recap output (new structured format)
  if (output.summary && (output.customerGoals || output.painPoints)) {
    return <DiscoveryRecapFormatter data={output} />
  }

  // Discovery Recap output (legacy format)
  if (output.painPoints && output.stakeholderMap && !output.summary) {
    return (
      <div className="space-y-6">
        {/* Pain Points */}
        {output.painPoints?.length > 0 && (
          <div>
            <SectionHeader icon={AlertTriangle} title="Pain Points" />
            <div className="space-y-3">
              {output.painPoints.map((pp: any, i: number) => (
                <div key={i} className="text-sm p-3 border rounded">
                  <div className="flex items-center gap-2 mb-2">
                    <SeverityBadge level={pp.severity} />
                    <span className="font-medium">{pp.description}</span>
                  </div>
                  {pp.businessImpact && (
                    <div className="text-muted-foreground mb-2">{pp.businessImpact}</div>
                  )}
                  {pp.quotes?.length > 0 && (
                    <div className="mt-2 pl-3 border-l-2 border-primary/30 italic text-muted-foreground">
                      {pp.quotes.map((q: string, j: number) => <div key={j}>"{q}"</div>)}
                    </div>
                  )}
                  {pp.relevantProducts?.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {pp.relevantProducts.map((p: string) => (
                        <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stakeholder Map */}
        {output.stakeholderMap?.length > 0 && (
          <div>
            <SectionHeader icon={Users} title="Stakeholder Map" />
            <div className="space-y-2">
              {output.stakeholderMap.map((s: any, i: number) => (
                <div key={i} className="text-sm p-3 border rounded">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span className="font-medium">{s.name}</span>
                      <span className="text-muted-foreground ml-2">— {s.title}</span>
                    </div>
                    <div className="flex gap-1">
                      <Badge variant="outline">{s.role}</Badge>
                      <Badge variant={s.engagement === 'high' ? 'default' : 'secondary'}>{s.engagement}</Badge>
                    </div>
                  </div>
                  {s.priorities?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {s.priorities.map((p: string, j: number) => (
                        <Badge key={j} variant="secondary" className="text-xs">{p}</Badge>
                      ))}
                    </div>
                  )}
                  {s.notes && <div className="text-muted-foreground text-xs mt-1">{s.notes}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Decision Process */}
        {output.decisionProcess && (
          <div>
            <SectionHeader icon={Target} title="Decision Process" />
            <div className="text-sm grid grid-cols-2 gap-3">
              {output.decisionProcess.makers?.length > 0 && (
                <div><span className="font-medium">Decision Makers:</span> {output.decisionProcess.makers.join(', ')}</div>
              )}
              {output.decisionProcess.champions?.length > 0 && (
                <div><span className="font-medium">Champions:</span> {output.decisionProcess.champions.join(', ')}</div>
              )}
              {output.decisionProcess.timeline && (
                <div><span className="font-medium">Timeline:</span> {output.decisionProcess.timeline}</div>
              )}
              {output.decisionProcess.process && (
                <div className="col-span-2"><span className="font-medium">Process:</span> {output.decisionProcess.process}</div>
              )}
            </div>
          </div>
        )}

        {/* Current State */}
        {output.currentState && (
          <div>
            <SectionHeader icon={Code} title="Current State" />
            <div className="text-sm space-y-2">
              {output.currentState.tools?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  <span className="font-medium mr-2">Tools:</span>
                  {output.currentState.tools.map((t: string) => <Badge key={t} variant="secondary">{t}</Badge>)}
                </div>
              )}
              {output.currentState.frustrations?.length > 0 && (
                <div>
                  <span className="font-medium">Frustrations:</span>
                  <ul className="list-disc list-inside text-muted-foreground mt-1">
                    {output.currentState.frustrations.map((f: string, i: number) => <li key={i}>{f}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Next Steps */}
        {output.nextSteps?.length > 0 && (
          <div>
            <SectionHeader icon={CheckSquare} title="Next Steps" />
            <div className="space-y-2">
              {output.nextSteps.map((ns: any, i: number) => (
                <div key={i} className="text-sm p-2 border rounded flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <SeverityBadge level={ns.priority} />
                    <span>{ns.action}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <Badge variant="outline">{ns.owner}</Badge>
                    {ns.dueDate && <span>{ns.dueDate}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Qualification Notes */}
        {output.qualificationNotes && (
          <div>
            <SectionHeader icon={Lightbulb} title="Qualification Notes" />
            <div className="text-sm grid grid-cols-2 gap-4">
              {output.qualificationNotes.strengths?.length > 0 && (
                <div>
                  <div className="font-medium text-green-600 mb-1">Strengths</div>
                  <ul className="list-disc list-inside text-muted-foreground">
                    {output.qualificationNotes.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
              {output.qualificationNotes.concerns?.length > 0 && (
                <div>
                  <div className="font-medium text-orange-600 mb-1">Concerns</div>
                  <ul className="list-disc list-inside text-muted-foreground">
                    {output.qualificationNotes.concerns.map((c: string, i: number) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              )}
              {output.qualificationNotes.recommendations?.length > 0 && (
                <div className="col-span-2">
                  <div className="font-medium text-blue-600 mb-1">Recommendations</div>
                  <ul className="list-disc list-inside text-muted-foreground">
                    {output.qualificationNotes.recommendations.map((r: string, i: number) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // MEDDPICC / Qualification output
  if (output.metrics || output.economicBuyer || output.meddpicc) {
    const data = output.meddpicc || output
    return (
      <div className="space-y-4">
        <SectionHeader icon={Target} title="Qualification (MEDDPICC)" />
        <div className="grid gap-3">
          {['metrics', 'economicBuyer', 'decisionCriteria', 'decisionProcess', 'paperProcess', 'identifyPain', 'champion', 'competition'].map((field) => {
            const value = data[field]
            if (!value) return null
            const label = field.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())
            return (
              <div key={field} className="text-sm p-3 border rounded">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{label}</span>
                  {value.score && <Badge variant={value.score >= 3 ? 'default' : 'secondary'}>{value.score}/5</Badge>}
                </div>
                <div className="text-muted-foreground">{value.notes || value.description || (typeof value === 'string' ? value : JSON.stringify(value))}</div>
                {value.evidence && <div className="mt-1 text-xs italic">Evidence: {value.evidence}</div>}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Deal Review / Risk output
  if (output.dealHealth || output.risks || output.overallScore !== undefined) {
    return (
      <div className="space-y-6">
        {output.dealHealth && (
          <div>
            <SectionHeader icon={Target} title="Deal Health" />
            <div className="text-sm p-4 border rounded">
              <div className="flex items-center gap-4 mb-3">
                <div className="text-3xl font-bold">{output.dealHealth.score || output.overallScore}/100</div>
                <Badge className={output.dealHealth.score >= 70 ? 'bg-green-100 text-green-800' : output.dealHealth.score >= 40 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}>
                  {output.dealHealth.status || (output.dealHealth.score >= 70 ? 'Healthy' : output.dealHealth.score >= 40 ? 'At Risk' : 'Critical')}
                </Badge>
              </div>
              {output.dealHealth.summary && <p className="text-muted-foreground">{output.dealHealth.summary}</p>}
            </div>
          </div>
        )}
        {output.risks?.length > 0 && (
          <div>
            <SectionHeader icon={AlertTriangle} title="Risks" />
            <div className="space-y-2">
              {output.risks.map((risk: any, i: number) => (
                <div key={i} className="text-sm p-3 border rounded">
                  <div className="flex items-center gap-2 mb-1">
                    <SeverityBadge level={risk.severity || risk.level || 'medium'} />
                    <span className="font-medium">{risk.title || risk.description || risk}</span>
                  </div>
                  {risk.mitigation && <div className="text-muted-foreground text-xs">Mitigation: {risk.mitigation}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
        {output.recommendations?.length > 0 && (
          <div>
            <SectionHeader icon={Lightbulb} title="Recommendations" />
            <ul className="text-sm space-y-1 list-disc list-inside">
              {output.recommendations.map((r: any, i: number) => <li key={i}>{typeof r === 'string' ? r : r.action || r.description}</li>)}
            </ul>
          </div>
        )}
      </div>
    )
  }

  // Executive Summary output
  if (output.executiveSummary || output.summary) {
    return (
      <div className="space-y-6">
        <div>
          <SectionHeader icon={FileText} title="Executive Summary" />
          <div className="text-sm p-4 border rounded bg-muted/30">
            <p>{output.executiveSummary || output.summary}</p>
          </div>
        </div>
        {output.keyPoints?.length > 0 && (
          <div>
            <SectionHeader icon={Lightbulb} title="Key Points" />
            <ul className="text-sm space-y-1 list-disc list-inside">
              {output.keyPoints.map((p: string, i: number) => <li key={i}>{p}</li>)}
            </ul>
          </div>
        )}
        {output.nextSteps?.length > 0 && (
          <div>
            <SectionHeader icon={CheckSquare} title="Next Steps" />
            <ul className="text-sm space-y-1 list-disc list-inside">
              {output.nextSteps.map((s: any, i: number) => <li key={i}>{typeof s === 'string' ? s : s.action}</li>)}
            </ul>
          </div>
        )}
      </div>
    )
  }

  // Coaching output
  if (output.strengths && output.improvements) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <SectionHeader icon={CheckCircle2} title="Strengths" />
            <ul className="text-sm space-y-2">
              {output.strengths.map((s: any, i: number) => (
                <li key={i} className="p-2 border rounded bg-green-50">
                  {typeof s === 'string' ? s : s.observation || s.description}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <SectionHeader icon={AlertTriangle} title="Areas for Improvement" />
            <ul className="text-sm space-y-2">
              {output.improvements.map((imp: any, i: number) => (
                <li key={i} className="p-2 border rounded bg-orange-50">
                  {typeof imp === 'string' ? imp : imp.observation || imp.description}
                  {imp.suggestion && <div className="text-xs text-muted-foreground mt-1">Tip: {imp.suggestion}</div>}
                </li>
              ))}
            </ul>
          </div>
        </div>
        {output.overallScore !== undefined && (
          <div className="text-center p-4 border rounded">
            <div className="text-3xl font-bold">{output.overallScore}/10</div>
            <div className="text-muted-foreground">Overall Performance</div>
          </div>
        )}
      </div>
    )
  }

  // Follow-up Email output  
  if (output.subject && output.body) {
    return (
      <div className="space-y-4">
        <SectionHeader icon={MessageSquare} title="Follow-Up Email" />
        <div className="text-sm border rounded overflow-hidden">
          <div className="p-3 bg-muted/50 border-b">
            <span className="font-medium">Subject:</span> {output.subject}
          </div>
          <div className="p-4 whitespace-pre-wrap">{output.body}</div>
        </div>
      </div>
    )
  }

  // Meeting Summary output (new structured format)
  if (output.meetingInfo && output.objectives && output.discussion) {
    return <MeetingSummaryFormatter data={output} />
  }

  // Meeting Summary output (legacy format)
  if (output.objectives && output.keyDiscussions && !output.meetingInfo) {
    return (
      <div className="space-y-6">
        <div>
          <SectionHeader icon={Target} title="Meeting Objectives" />
          <ul className="text-sm space-y-1 list-disc list-inside">
            {output.objectives.map((o: string, i: number) => <li key={i}>{o}</li>)}
          </ul>
        </div>
        <div>
          <SectionHeader icon={MessageSquare} title="Key Discussions" />
          <div className="space-y-2">
            {output.keyDiscussions.map((d: any, i: number) => (
              <div key={i} className="text-sm p-3 border rounded">
                <div className="font-medium">{d.topic}</div>
                <div className="text-muted-foreground">{d.summary || d.details}</div>
              </div>
            ))}
          </div>
        </div>
        {output.actionItems?.length > 0 && (
          <div>
            <SectionHeader icon={CheckSquare} title="Action Items" />
            <div className="space-y-1">
              {output.actionItems.map((a: any, i: number) => (
                <div key={i} className="text-sm p-2 border rounded flex justify-between">
                  <span>{a.action || a}</span>
                  {a.owner && <Badge variant="outline">{a.owner}</Badge>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Research/Prospector output
  if (output.companyOverview) {
    return (
      <div className="space-y-6">
        <div>
          <SectionHeader icon={Building2} title="Company Overview" />
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Name:</span> <span className="font-medium">{output.companyOverview.name}</span></div>
            <div><span className="text-muted-foreground">Industry:</span> {output.companyOverview.industry}</div>
            <div><span className="text-muted-foreground">Size:</span> {output.companyOverview.size}</div>
            <div><span className="text-muted-foreground">HQ:</span> {output.companyOverview.headquarters}</div>
            <div><span className="text-muted-foreground">Founded:</span> {output.companyOverview.founded}</div>
            <div><span className="text-muted-foreground">Funding:</span> {output.companyOverview.funding}</div>
          </div>
        </div>
        {output.techStack && (
          <div>
            <SectionHeader icon={Code} title="Tech Stack" />
            <div className="space-y-2 text-sm">
              {output.techStack.languages?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  <span className="text-muted-foreground mr-2">Languages:</span>
                  {output.techStack.languages.map((lang: string) => <Badge key={lang} variant="secondary">{lang}</Badge>)}
                </div>
              )}
              {output.techStack.frameworks?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  <span className="text-muted-foreground mr-2">Frameworks:</span>
                  {output.techStack.frameworks.map((fw: string) => <Badge key={fw} variant="outline">{fw}</Badge>)}
                </div>
              )}
            </div>
          </div>
        )}
        {output.keyContacts?.length > 0 && (
          <div>
            <SectionHeader icon={Users} title="Key Contacts" />
            <div className="space-y-2">
              {output.keyContacts.map((contact: any, i: number) => (
                <div key={i} className="text-sm p-2 bg-muted/50 rounded">
                  <div className="font-medium">{contact.name}</div>
                  <div className="text-muted-foreground">{contact.title}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {output.relevantUseCases?.length > 0 && (
          <div>
            <SectionHeader icon={Lightbulb} title="Relevant Use Cases" />
            <div className="space-y-3">
              {output.relevantUseCases.map((uc: any, i: number) => (
                <div key={i} className="text-sm p-3 border rounded">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{uc.useCase}</span>
                    <Badge variant="secondary">{uc.product}</Badge>
                  </div>
                  <div className="text-muted-foreground">{uc.painPoint}</div>
                  <div className="text-green-600 mt-1">{uc.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Pre-Call Brief output
  if (output.meetingType && output.attendees) {
    return (
      <div className="space-y-6">
        <div>
          <SectionHeader icon={Calendar} title="Meeting Overview" />
          <Badge variant="secondary" className="mb-2">{output.meetingType}</Badge>
          {output.agenda?.length > 0 && (
            <ol className="text-sm list-decimal list-inside space-y-1 mt-2">
              {output.agenda.map((item: string, i: number) => <li key={i}>{item}</li>)}
            </ol>
          )}
        </div>
        {output.attendees?.length > 0 && (
          <div>
            <SectionHeader icon={Users} title="Attendees" />
            <div className="space-y-2">
              {output.attendees.map((a: any, i: number) => (
                <div key={i} className="text-sm p-3 border rounded">
                  <div className="flex justify-between">
                    <div><span className="font-medium">{a.name}</span> — {a.title}</div>
                    <Badge variant="outline">{a.role}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {output.talkingPoints?.length > 0 && (
          <div>
            <SectionHeader icon={MessageSquare} title="Talking Points" />
            <div className="space-y-2">
              {output.talkingPoints.map((tp: any, i: number) => (
                <div key={i} className="text-sm p-3 border rounded">
                  <div className="font-medium">{tp.topic}</div>
                  <div className="text-muted-foreground">{tp.context}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Custom Demo Plan output (new structured format)
  if (output.overview && (output.segments || output.keyMessages)) {
    return <CustomDemoFormatter data={output} />
  }

  // Custom Demo Plan output (legacy format)
  if (output.demoObjective || output.demoFlow || output.scenarioRecommendations) {
    return (
      <div className="space-y-6">
        {/* Demo Objective */}
        {output.demoObjective && (
          <div>
            <SectionHeader icon={Target} title="Demo Objective" />
            <div className="text-sm p-4 border rounded bg-primary/5">
              <p>{output.demoObjective}</p>
            </div>
          </div>
        )}

        {/* Selected Repository */}
        {output.selectedRepository && (
          <div>
            <SectionHeader icon={Code} title="Demo Repository" />
            <div className="text-sm p-4 border rounded bg-blue-50 dark:bg-blue-950">
              <div className="flex items-center gap-2 mb-2">
                <code className="font-mono text-base font-semibold">{output.selectedRepository.repo}</code>
                <a 
                  href={`https://sourcegraph.com/${output.selectedRepository.repo}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
              <p className="text-muted-foreground mb-2">{output.selectedRepository.rationale}</p>
              {output.selectedRepository.alternateRepo && (
                <div className="text-xs">
                  <span className="font-medium">Backup: </span>
                  <code>{output.selectedRepository.alternateRepo}</code>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Target Audience & Duration */}
        {(output.targetAudience || output.duration) && (
          <div className="flex gap-4 text-sm">
            {output.targetAudience?.length > 0 && (
              <div className="flex-1 p-3 border rounded">
                <div className="font-medium mb-1">Target Audience</div>
                <ul className="text-muted-foreground text-xs space-y-1">
                  {output.targetAudience.map((a: string, i: number) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            )}
            {output.duration && (
              <div className="p-3 border rounded text-center">
                <div className="text-2xl font-bold">{output.duration}</div>
                <div className="text-xs text-muted-foreground">duration</div>
              </div>
            )}
          </div>
        )}

        {/* Scenario Recommendations */}
        {output.scenarioRecommendations?.length > 0 && (
          <div>
            <SectionHeader icon={Presentation} title="Recommended Scenarios" />
            <div className="space-y-3">
              {output.scenarioRecommendations.map((scenario: any, i: number) => (
                <div key={i} className="text-sm p-4 border rounded">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-base">{scenario.scenario || scenario.name}</span>
                    <div className="flex gap-2">
                      {scenario.priority && <SeverityBadge level={scenario.priority} />}
                      {scenario.product && <Badge variant="secondary">{scenario.product}</Badge>}
                    </div>
                  </div>
                  {scenario.painAddressed && (
                    <div className="mb-2">
                      <span className="text-muted-foreground">Pain Addressed: </span>
                      <span>{scenario.painAddressed}</span>
                    </div>
                  )}
                  {scenario.talkingPoints?.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs font-medium text-muted-foreground uppercase mb-1">Talking Points</div>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        {scenario.talkingPoints.map((tp: string, j: number) => <li key={j}>{tp}</li>)}
                      </ul>
                    </div>
                  )}
                  {scenario.expectedOutcome && (
                    <div className="mt-2 text-green-600 text-xs">
                      <span className="font-medium">Expected Outcome:</span> {scenario.expectedOutcome}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Demo Flow */}
        {output.demoFlow?.length > 0 && (
          <div>
            <SectionHeader icon={List} title="Demo Flow" />
            <div className="space-y-4">
              {output.demoFlow.map((step: any, i: number) => {
                const title = step.section || step.step || step.title || (typeof step === 'string' ? step : `Step ${i + 1}`)
                return (
                  <div key={i} className="text-sm border rounded overflow-hidden">
                    {/* Section Header */}
                    <div className="flex items-center gap-3 p-4 bg-muted/30 border-b">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-base">{title}</span>
                          {step.duration && <Badge variant="outline">{step.duration} min</Badge>}
                        </div>
                        {step.painAddressed && (
                          <div className="text-muted-foreground text-sm mt-1">{step.painAddressed}</div>
                        )}
                      </div>
                    </div>
                    
                    <div className="p-4 space-y-4">
                      {/* Features */}
                      {step.features?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {step.features.map((f: string, j: number) => (
                            <Badge key={j} variant="secondary">{f}</Badge>
                          ))}
                        </div>
                      )}

                      {/* Specific Demo Steps */}
                      {step.specificDemo?.steps?.length > 0 && (
                        <div className="space-y-3">
                          <div className="text-xs font-medium text-muted-foreground uppercase">Step-by-Step Instructions</div>
                          {step.specificDemo.steps.map((demoStep: any, k: number) => (
                            <div key={k} className="p-3 border rounded bg-slate-50 dark:bg-slate-900">
                              <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 w-6 h-6 rounded bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-medium">
                                  {k + 1}
                                </div>
                                <div className="flex-1 space-y-2">
                                  <div className="font-medium">{demoStep.action}</div>
                                  {demoStep.query && (
                                    <div className="flex items-center gap-2">
                                      <code className="flex-1 text-xs bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded font-mono">
                                        {demoStep.query}
                                      </code>
                                      <button 
                                        onClick={() => navigator.clipboard.writeText(demoStep.query)}
                                        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
                                        title="Copy query"
                                      >
                                        <Copy className="h-3 w-3" />
                                      </button>
                                    </div>
                                  )}
                                  {demoStep.expectation && (
                                    <div className="text-xs text-muted-foreground">
                                      <span className="font-medium">Expected: </span>{demoStep.expectation}
                                    </div>
                                  )}
                                  {demoStep.talkTrack && (
                                    <div className="text-xs italic text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 p-2 rounded">
                                      💬 "{demoStep.talkTrack}"
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Aha File */}
                      {step.specificDemo?.ahaFile && (
                        <div className="p-3 border rounded bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-yellow-600" />
                            <span className="font-medium text-yellow-800 dark:text-yellow-200">Aha Moment File</span>
                          </div>
                          <code className="text-xs mt-1 block">{step.specificDemo.ahaFile}</code>
                        </div>
                      )}

                      {/* Comparison */}
                      {step.specificDemo?.comparison && (
                        <div className="p-3 border rounded bg-green-50 dark:bg-green-950">
                          <div className="text-xs font-medium text-green-700 dark:text-green-300 uppercase mb-1">Why This Beats Alternatives</div>
                          <div className="text-sm text-green-800 dark:text-green-200">{step.specificDemo.comparison}</div>
                        </div>
                      )}

                      {/* Talking Points */}
                      {step.talkingPoints?.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground uppercase mb-1">Talking Points</div>
                          <ul className="list-disc list-inside space-y-1 text-muted-foreground text-sm">
                            {step.talkingPoints.map((tp: string, j: number) => <li key={j}>{tp}</li>)}
                          </ul>
                        </div>
                      )}

                      {/* Customer Value */}
                      {step.customerValue && (
                        <div className="text-sm text-green-600 bg-green-50 dark:bg-green-950 p-3 rounded">
                          <span className="font-medium">Customer Value:</span> {step.customerValue}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Key Messages */}
        {output.keyMessages?.length > 0 && (
          <div>
            <SectionHeader icon={Sparkles} title="Key Messages" />
            <div className="grid gap-2">
              {output.keyMessages.map((msg: string, i: number) => (
                <div key={i} className="text-sm p-3 border rounded bg-muted/30 flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>{msg}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Key Features */}
        {output.keyFeatures?.length > 0 && (
          <div>
            <SectionHeader icon={Sparkles} title="Key Features" />
            <div className="space-y-2">
              {output.keyFeatures.map((kf: any, i: number) => (
                <div key={i} className="text-sm p-3 border rounded">
                  <div className="font-medium">{kf.feature}</div>
                  {kf.relevance && <div className="text-muted-foreground mt-1">{kf.relevance}</div>}
                  {kf.competitiveAdvantage && (
                    <div className="text-xs text-green-600 mt-1">
                      <span className="font-medium">Advantage:</span> {kf.competitiveAdvantage}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Competitive Handling */}
        {output.competitiveHandling && (
          <div>
            <SectionHeader icon={Target} title="Competitive Handling" />
            <div className="text-sm p-4 border rounded space-y-4">
              {output.competitiveHandling.competitors?.length > 0 && (
                <div>
                  <div className="font-medium mb-2">Competitors</div>
                  <div className="flex flex-wrap gap-2">
                    {output.competitiveHandling.competitors.map((c: string, i: number) => (
                      <Badge key={i} variant="outline">{c}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {output.competitiveHandling.differentiators?.length > 0 && (
                <div>
                  <div className="font-medium mb-2">Our Differentiators</div>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    {output.competitiveHandling.differentiators.map((d: string, i: number) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>
              )}
              {output.competitiveHandling.objectionResponses && (
                <div>
                  <div className="font-medium mb-2">Objection Responses</div>
                  <div className="space-y-2">
                    {Object.entries(output.competitiveHandling.objectionResponses).map(([objection, response], i) => (
                      <div key={i} className="p-2 bg-muted/50 rounded">
                        <div className="font-medium text-xs text-orange-600">"{objection}"</div>
                        <div className="text-muted-foreground text-xs mt-1">{response as string}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Competitive Positioning (legacy format) */}
        {output.competitivePositioning && (
          <div>
            <SectionHeader icon={Target} title="Competitive Positioning" />
            <div className="text-sm p-4 border rounded">
              {typeof output.competitivePositioning === 'string' ? (
                <p>{output.competitivePositioning}</p>
              ) : (
                <div className="space-y-2">
                  {output.competitivePositioning.competitors?.map((comp: any, i: number) => (
                    <div key={i} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                      <span className="font-medium">{comp.name}</span>
                      <span className="text-muted-foreground text-xs">{comp.positioning || comp.differentiator}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Closing Questions */}
        {output.closingQuestions?.length > 0 && (
          <div>
            <SectionHeader icon={MessageSquare} title="Closing Questions" />
            <div className="space-y-2">
              {output.closingQuestions.map((q: string, i: number) => (
                <div key={i} className="text-sm p-3 border rounded flex items-start gap-2">
                  <MessageSquare className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>{q}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Success Metrics */}
        {output.successMetrics?.length > 0 && (
          <div>
            <SectionHeader icon={CheckSquare} title="Success Metrics" />
            <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
              {output.successMetrics.map((m: string, i: number) => <li key={i}>{m}</li>)}
            </ul>
          </div>
        )}

        {/* Preparation */}
        {output.preparation && (
          <div>
            <SectionHeader icon={FileText} title="Preparation" />
            <div className="text-sm p-4 border rounded space-y-3">
              {output.preparation.environment && (
                <div>
                  <div className="font-medium">Environment</div>
                  <div className="text-muted-foreground text-xs">{output.preparation.environment}</div>
                </div>
              )}
              {output.preparation.data && (
                <div>
                  <div className="font-medium">Data</div>
                  <div className="text-muted-foreground text-xs">{output.preparation.data}</div>
                </div>
              )}
              {output.preparation.backup && (
                <div>
                  <div className="font-medium">Backup Plan</div>
                  <div className="text-muted-foreground text-xs">{output.preparation.backup}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Preparation Notes (legacy format) */}
        {output.preparationNotes?.length > 0 && (
          <div>
            <SectionHeader icon={FileText} title="Preparation Notes" />
            <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
              {output.preparationNotes.map((note: string, i: number) => <li key={i}>{note}</li>)}
            </ul>
          </div>
        )}
      </div>
    )
  }

  // Fallback to nicely formatted JSON with copy button
  return (
    <FormattedJsonOutput data={output} />
  )
}

// Nicely formatted JSON output component with syntax highlighting
function FormattedJsonOutput({ data }: { data: any }) {
  const [copied, setCopied] = useState(false)
  const jsonString = JSON.stringify(data, null, 2)

  const copyToClipboard = () => {
    navigator.clipboard.writeText(jsonString)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Simple syntax highlighting for JSON
  const highlightJson = (json: string) => {
    return json
      .replace(/"([^"]+)":/g, '<span class="text-blue-600 dark:text-blue-400">"$1"</span>:')
      .replace(/: "([^"]+)"/g, ': <span class="text-green-600 dark:text-green-400">"$1"</span>')
      .replace(/: (\d+)/g, ': <span class="text-amber-600 dark:text-amber-400">$1</span>')
      .replace(/: (true|false)/g, ': <span class="text-purple-600 dark:text-purple-400">$1</span>')
      .replace(/: (null)/g, ': <span class="text-gray-500">$1</span>')
  }

  return (
    <div className="relative">
      <div className="absolute top-2 right-2 z-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={copyToClipboard}
          className="h-8 px-2"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
      <div 
        className="text-sm bg-muted/50 p-4 rounded-lg overflow-auto font-mono leading-relaxed border"
        dangerouslySetInnerHTML={{ __html: `<pre>${highlightJson(jsonString)}</pre>` }}
      />
    </div>
  )
}

export default function AgentLabPage() {
  const API_URL = getApiUrl()
  
  // State
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [selectedAgent, setSelectedAgent] = useState<AgentInfo | null>(null)
  const [activeStage, setActiveStage] = useState<LifecycleStageId | 'all'>('all')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AgentResult | null>(null)
  const [inputParams, setInputParams] = useState<Record<string, string>>({})
  const [expandedOutput, setExpandedOutput] = useState(true)
  const [runHistory, setRunHistory] = useState<RunHistoryItem[]>([])
  // showHistory state removed - history is always visible
  const [availableCalls, setAvailableCalls] = useState<GongCall[]>([])
  const [availableArtifacts, setAvailableArtifacts] = useState<Artifact[]>([])
  const [selectedArtifacts, setSelectedArtifacts] = useState<string[]>([])
  const [showArtifactPicker, setShowArtifactPicker] = useState(false)
  
  // Load accounts
  useEffect(() => {
    fetch(`${API_URL}/accounts`)
      .then(res => res.json())
      .then(data => {
        setAccounts(data)
        const savedSlug = localStorage.getItem('selectedAccountSlug')
        const saved = data.find((a: Account) => a.slug === savedSlug)
        if (saved) setSelectedAccount(saved)
        else if (data.length > 0) setSelectedAccount(data[0])
      })
      .catch(console.error)
  }, [])
  
  // Load agents
  useEffect(() => {
    fetch(`${API_URL}/agents`)
      .then(res => res.json())
      .then((data: { agents: AgentInfo[] }) => {
        setAgents(data.agents || [])
      })
      .catch(console.error)
  }, [])

  // Load Gong calls when account changes
  useEffect(() => {
    if (selectedAccount) {
      fetch(`${API_URL}/accounts/${selectedAccount.slug}/calls`)
        .then(res => res.json())
        .then((calls: GongCall[]) => setAvailableCalls(calls || []))
        .catch(() => setAvailableCalls([]))
    } else {
      setAvailableCalls([])
    }
  }, [selectedAccount, API_URL])

  // Load available artifacts when account changes
  useEffect(() => {
    if (selectedAccount) {
      fetch(`${API_URL}/accounts/${selectedAccount.slug}/artifacts`)
        .then(res => res.json())
        .then((artifacts: Artifact[]) => setAvailableArtifacts(artifacts || []))
        .catch(() => setAvailableArtifacts([]))
    } else {
      setAvailableArtifacts([])
    }
  }, [selectedAccount, API_URL])

  // Load run history when agent or account changes
  useEffect(() => {
    if (selectedAccount && selectedAgent) {
      fetch(`${API_URL}/accounts/${selectedAccount.slug}/agents/${selectedAgent.id}/runs`)
        .then(res => res.json())
        .then(setRunHistory)
        .catch(() => setRunHistory([]))
    } else {
      setRunHistory([])
    }
  }, [selectedAccount, selectedAgent, API_URL])

  // Load a specific run from history
  const loadRun = async (runId: string) => {
    if (!selectedAccount || !selectedAgent) return
    try {
      const res = await fetch(
        `${API_URL}/accounts/${selectedAccount.slug}/agents/${selectedAgent.id}/runs/${runId}`
      )
      const data = await res.json()
      setResult({
        success: data.success,
        output: data.output,
        error: data.error,
        runId: data.id,
        metadata: data.metadata,
      })
    } catch (error) {
      console.error('Failed to load run:', error)
    }
  }

  // Delete a single run
  const deleteRun = async (runId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!selectedAccount || !selectedAgent) return
    
    try {
      await fetch(
        `${API_URL}/accounts/${selectedAccount.slug}/agents/${selectedAgent.id}/runs/${runId}`,
        { method: 'DELETE' }
      )
      setRunHistory(prev => prev.filter(r => r.id !== runId))
      if (result?.runId === runId) {
        setResult(null)
      }
      // Refresh artifacts
      fetch(`${API_URL}/accounts/${selectedAccount.slug}/artifacts`)
        .then(res => res.json())
        .then((data) => setAvailableArtifacts(data || []))
        .catch(() => setAvailableArtifacts([]))
    } catch (error) {
      console.error('Failed to delete run:', error)
    }
  }

  // Clear run history
  const clearHistory = async () => {
    if (!selectedAccount || !selectedAgent) return
    if (!confirm('Clear all run history for this agent?')) return
    
    try {
      await fetch(
        `${API_URL}/accounts/${selectedAccount.slug}/agents/${selectedAgent.id}/runs`,
        { method: 'DELETE' }
      )
      setRunHistory([])
      setResult(null)
      // Refresh artifacts
      fetch(`${API_URL}/accounts/${selectedAccount.slug}/artifacts`)
        .then(res => res.json())
        .then((data) => setAvailableArtifacts(data || []))
        .catch(() => setAvailableArtifacts([]))
    } catch (error) {
      console.error('Failed to clear history:', error)
    }
  }
  
  // Filter agents by stage
  const filteredAgents = activeStage === 'all' 
    ? agents 
    : agents.filter(a => a.stage === activeStage || a.stage === 'global')
  
  // Group agents by stage for display
  const groupedAgents = filteredAgents.reduce((acc, agent) => {
    const stage = agent.stage
    if (!acc[stage]) acc[stage] = []
    acc[stage].push(agent)
    return acc
  }, {} as Record<string, AgentInfo[]>)
  
  const runAgent = async () => {
    if (!selectedAccount || !selectedAgent) return
    
    setLoading(true)
    setResult(null)
    
    try {
      const res = await fetch(
        `${API_URL}/accounts/${selectedAccount.slug}/agents/${selectedAgent.id}/run`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            ...inputParams,
            selectedArtifacts: selectedArtifacts.length > 0 ? selectedArtifacts : undefined,
          }),
        }
      )
      const data = await res.json()
      setResult(data)
      
      // Refresh run history and artifacts
      fetch(`${API_URL}/accounts/${selectedAccount.slug}/agents/${selectedAgent.id}/runs`)
        .then(res => res.json())
        .then((data) => setRunHistory(data || []))
        .catch(() => setRunHistory([]))
      fetch(`${API_URL}/accounts/${selectedAccount.slug}/artifacts`)
        .then(res => res.json())
        .then((data) => setAvailableArtifacts(data || []))
        .catch(() => setAvailableArtifacts([]))
    } catch (error) {
      setResult({
        success: false,
        output: null,
        error: String(error),
      })
    } finally {
      setLoading(false)
    }
  }
  
  const getStageBadgeColor = (stage: LifecycleStageId) => {
    const colors: Record<string, string> = {
      prospecting: 'bg-blue-100 text-blue-800',
      qualification: 'bg-purple-100 text-purple-800',
      solution_mapping: 'bg-indigo-100 text-indigo-800',
      validation: 'bg-green-100 text-green-800',
      handoff_close: 'bg-orange-100 text-orange-800',
      post_mortem: 'bg-gray-100 text-gray-800',
      global: 'bg-slate-100 text-slate-800',
    }
    return colors[stage] || 'bg-gray-100 text-gray-800'
  }
  
  const getCostBadgeColor = (tier: string) => {
    const colors: Record<string, string> = {
      cheap: 'bg-emerald-100 text-emerald-800',
      balanced: 'bg-amber-100 text-amber-800',
      quality: 'bg-rose-100 text-rose-800',
    }
    return colors[tier] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="border-b h-16 flex-shrink-0 bg-background z-10">
        <div className="h-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Beaker className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold">Agent Lab</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select 
              value={selectedAccount?.slug || ''} 
              onValueChange={(slug) => {
                const account = accounts.find(a => a.slug === slug)
                if (account) {
                  setSelectedAccount(account)
                  localStorage.setItem('selectedAccountSlug', slug)
                }
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map(account => (
                  <SelectItem key={account.slug} value={account.slug}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      {/* Main Content with Resizable Panels */}
      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
        
        {/* Left: Agent List */}
        <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
          <div className="h-full flex flex-col bg-muted/10 overflow-hidden">
            <div className="p-4 border-b flex-shrink-0">
              <Tabs value={activeStage} onValueChange={(v) => setActiveStage(v as any)}>
                <TabsList className="grid grid-cols-4 w-full">
                  <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                  <TabsTrigger value="prospecting" className="text-xs">Prospect</TabsTrigger>
                  <TabsTrigger value="qualification" className="text-xs">Qualify</TabsTrigger>
                  <TabsTrigger value="solution_mapping" className="text-xs">Solution</TabsTrigger>
                </TabsList>
                <TabsList className="grid grid-cols-3 w-full mt-1">
                  <TabsTrigger value="validation" className="text-xs">Validate</TabsTrigger>
                  <TabsTrigger value="handoff_close" className="text-xs">Handoff</TabsTrigger>
                  <TabsTrigger value="post_mortem" className="text-xs">Post</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="p-4 space-y-4">
                {Object.entries(groupedAgents).map(([stage, stageAgents]) => (
                  <div key={stage}>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      {LIFECYCLE_STAGES.find(s => s.id === stage)?.label || stage}
                    </div>
                    <div className="space-y-2">
                      {stageAgents.map(agent => (
                        <Card 
                          key={agent.id}
                          className={`cursor-pointer transition-all hover:shadow-md ${
                            selectedAgent?.id === agent.id 
                              ? 'ring-2 ring-primary bg-primary/5' 
                              : 'hover:bg-muted/50'
                          }`}
                          onClick={() => {
                            setSelectedAgent(agent)
                            setInputParams({})
                            setResult(null)
                            setSelectedArtifacts([])
                            setShowArtifactPicker(false)
                          }}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">{agent.label}</div>
                                <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                  {agent.description}
                                </div>
                              </div>
                              <Badge variant="outline" className={`text-[10px] shrink-0 ${getCostBadgeColor(agent.costTier)}`}>
                                {agent.costTier}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
                
                {filteredAgents.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No agents found for this stage
                  </div>
                )}
              </div>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right: Agent Details & Execution */}
        <ResizablePanel defaultSize={70} minSize={40}>
          <div className="h-full flex flex-col bg-background overflow-hidden">
          {selectedAgent ? (
            <>
              {/* Agent Header */}
              <div className="p-6 border-b flex-shrink-0">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-bold">{selectedAgent.label}</h2>
                      <Badge className={getStageBadgeColor(selectedAgent.stage)}>
                        {selectedAgent.stage}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mt-1">{selectedAgent.description}</p>
                  </div>
                  <Button 
                    size="lg" 
                    onClick={runAgent}
                    disabled={loading || !selectedAccount}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Run Agent
                      </>
                    )}
                  </Button>
                </div>
                
                {/* Agent Config Info */}
                <div className="flex gap-4 mt-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <span className="font-medium">Cost Tier:</span>
                    <Badge className={getCostBadgeColor(selectedAgent.costTier)}>
                      {selectedAgent.costTier}
                    </Badge>
                  </div>
                  {selectedAgent.model && (
                    <div className="flex items-center gap-1">
                      <span className="font-medium">Model:</span>
                      <span>{selectedAgent.model}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Vertical resizable split: Input params, History, Output */}
              <ResizablePanelGroup direction="vertical" className="flex-1 min-h-0">
                <ResizablePanel defaultSize={50} minSize={20}>
                  <div className="h-full overflow-y-auto p-4">
                    {/* Input Parameters - filter out accountName since it comes from dropdown */}
              {(() => {
                const filteredRequired = selectedAgent.requiredInputs.filter(i => i !== 'accountName')
                const filteredOptional = selectedAgent.optionalInputs.filter(i => i !== 'accountName' && i !== 'domain')
                if (filteredRequired.length === 0 && filteredOptional.length === 0) return null

                // Friendly labels for inputs
                const inputLabels: Record<string, string> = {
                  briefAgenda: 'Brief Agenda',
                  meetingType: 'Meeting Type',
                  callId: 'Call ID',
                  opportunityId: 'Opportunity',
                }

                // Dropdown options for specific inputs
                const meetingTypeOptions = [
                  { value: '', label: 'Auto-detect from context' },
                  { value: 'Discovery', label: 'Discovery' },
                  { value: 'Demo', label: 'Demo' },
                  { value: 'Technical Deep Dive', label: 'Technical Deep Dive' },
                  { value: 'Executive Review', label: 'Executive Review' },
                  { value: 'Negotiation', label: 'Negotiation' },
                  { value: 'Kickoff', label: 'Kickoff' },
                ]

                // Sourcegraph products for multi-select
                const productOptions = [
                  { id: 'code_search', label: 'Code Search', description: 'Universal code search across all repos', docUrl: 'https://sourcegraph.com/docs/code-search' },
                  { id: 'deep_search', label: 'Deep Search', description: 'AI-powered semantic code search', docUrl: 'https://sourcegraph.com/docs/deep-search' },
                  { id: 'code_insights', label: 'Code Insights', description: 'Track codebase metrics over time', docUrl: 'https://sourcegraph.com/docs/code-insights' },
                  { id: 'batch_changes', label: 'Batch Changes', description: 'Large-scale code refactoring', docUrl: 'https://sourcegraph.com/docs/batch-changes' },
                  { id: 'sourcegraph_mcp', label: 'Sourcegraph MCP', description: 'Model Context Protocol for AI agents', docUrl: 'https://sourcegraph.com/docs/mcp' },
                ]

                // Format call for display in dropdown
                const formatCallLabel = (call: GongCall) => {
                  const title = call.title || call.subject || 'Untitled Call'
                  const date = call.started || call.startTime || call.scheduled
                  const dateStr = date ? new Date(date).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    year: 'numeric'
                  }) : ''
                  const duration = call.duration ? `${Math.round(call.duration / 60)}m` : ''
                  return `${title}${dateStr ? ` (${dateStr}${duration ? `, ${duration}` : ''})` : ''}`
                }

                const renderInput = (input: string, required: boolean) => {
                  const label = inputLabels[input] || input.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())
                  
                  // Render dropdown for callId with available Gong calls
                  if (input === 'callId') {
                    return (
                      <div key={input} className="space-y-2">
                        <Label className={required ? '' : 'text-muted-foreground'}>
                          Select Call {required && <span className="text-red-500">*</span>}
                        </Label>
                        <Select
                          value={inputParams[input] || ''}
                          onValueChange={(value) => setInputParams(prev => ({ ...prev, [input]: value === '_none' ? '' : value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={availableCalls.length > 0 ? "Select a call" : "No calls available"} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">
                              <span className="text-muted-foreground">None (use most recent)</span>
                            </SelectItem>
                            {availableCalls.map(call => (
                              <SelectItem key={call.id} value={call.id}>
                                <span className="flex items-center gap-2">
                                  {formatCallLabel(call)}
                                  {call.hasTranscript ? (
                                    <Badge variant="secondary" className="text-xs">transcript</Badge>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">(no transcript)</span>
                                  )}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {availableCalls.length === 0 && (
                          <p className="text-xs text-muted-foreground">
                            No Gong calls found. Refresh Gong data for this account.
                          </p>
                        )}
                        {availableCalls.length > 0 && availableCalls.every(c => !c.hasTranscript) && (
                          <p className="text-xs text-orange-600">
                            No calls have transcripts. Refresh Gong data to fetch transcripts.
                          </p>
                        )}
                      </div>
                    )
                  }
                  
                  // Render dropdown for meetingType
                  if (input === 'meetingType') {
                    return (
                      <div key={input} className="space-y-2">
                        <Label className={required ? '' : 'text-muted-foreground'}>
                          {label} {required && <span className="text-red-500">*</span>}
                        </Label>
                        <Select
                          value={inputParams[input] || ''}
                          onValueChange={(value) => setInputParams(prev => ({ ...prev, [input]: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select meeting type" />
                          </SelectTrigger>
                          <SelectContent>
                            {meetingTypeOptions.map(opt => (
                              <SelectItem key={opt.value} value={opt.value || '_auto'}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )
                  }

                  // Render checkboxes for products
                  if (input === 'products') {
                    const selectedProducts = inputParams.products ? inputParams.products.split(',').filter(Boolean) : []
                    
                    const toggleProduct = (productId: string) => {
                      const current = selectedProducts
                      const updated = current.includes(productId)
                        ? current.filter(p => p !== productId)
                        : [...current, productId]
                      setInputParams(prev => ({ ...prev, products: updated.join(',') }))
                    }

                    return (
                      <div key={input} className="space-y-3 col-span-2">
                        <Label className={required ? '' : 'text-muted-foreground'}>
                          Products of Interest {required && <span className="text-red-500">*</span>}
                        </Label>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {productOptions.map(product => (
                            <div 
                              key={product.id}
                              className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                                selectedProducts.includes(product.id) ? 'bg-primary/5 border-primary' : 'hover:bg-muted/50'
                              }`}
                              onClick={() => toggleProduct(product.id)}
                            >
                              <Checkbox 
                                checked={selectedProducts.includes(product.id)}
                                onCheckedChange={() => toggleProduct(product.id)}
                                className="mt-0.5"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{product.label}</span>
                                  <a 
                                    href={product.docUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-muted-foreground hover:text-primary"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </div>
                                <p className="text-xs text-muted-foreground">{product.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        {selectedProducts.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Selected: {selectedProducts.map(id => productOptions.find(p => p.id === id)?.label).join(', ')}
                          </p>
                        )}
                      </div>
                    )
                  }

                  // Default text input
                  return (
                    <div key={input} className="space-y-2">
                      <Label className={required ? '' : 'text-muted-foreground'}>
                        {label} {required && <span className="text-red-500">*</span>}
                      </Label>
                      <Input
                        placeholder={input === 'briefAgenda' ? 'e.g., demo and trial alignment' : `Enter ${label.toLowerCase()}`}
                        value={inputParams[input] || ''}
                        onChange={e => setInputParams(prev => ({ ...prev, [input]: e.target.value }))}
                      />
                    </div>
                  )
                }

                return (
                  <div className="mb-6">
                    <h3 className="font-semibold mb-4">Input Parameters</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {filteredRequired.map(input => renderInput(input, true))}
                      {filteredOptional.map(input => renderInput(input, false))}
                    </div>
                  </div>
                )
              })()}

              {/* Artifact Context Selection */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Library className="h-4 w-4" />
                    Include Context from Previous Runs
                  </h3>
                  {availableArtifacts && availableArtifacts.length > 0 ? (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowArtifactPicker(!showArtifactPicker)}
                    >
                      {showArtifactPicker ? 'Hide' : 'Show'} ({selectedArtifacts.length} selected)
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">No artifacts available yet</span>
                  )}
                </div>
                  
                  {/* Selected artifacts summary */}
                  {selectedArtifacts.length > 0 && !showArtifactPicker && (
                    <div className="flex flex-wrap gap-2">
                      {selectedArtifacts.map(id => {
                        const artifact = availableArtifacts.find(a => a.id === id)
                        if (!artifact) return null
                        return (
                          <Badge 
                            key={id} 
                            variant="secondary" 
                            className="flex items-center gap-1 cursor-pointer"
                            onClick={() => setSelectedArtifacts(prev => prev.filter(a => a !== id))}
                          >
                            {artifact.title}
                            <XCircle className="h-3 w-3 ml-1" />
                          </Badge>
                        )
                      })}
                    </div>
                  )}

                  {/* Artifact picker */}
                  {showArtifactPicker && availableArtifacts && availableArtifacts.length > 0 && (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {availableArtifacts.map((artifact) => (
                        <div
                          key={artifact.id}
                          className={`flex items-center justify-between p-2 bg-background rounded border cursor-pointer transition-colors ${
                            selectedArtifacts.includes(artifact.id) 
                              ? 'ring-2 ring-primary bg-primary/5' 
                              : 'hover:bg-muted/50'
                          }`}
                          onClick={() => {
                            setSelectedArtifacts(prev => 
                              prev.includes(artifact.id)
                                ? prev.filter(a => a !== artifact.id)
                                : [...prev, artifact.id]
                            )
                          }}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input 
                              type="checkbox" 
                              checked={selectedArtifacts.includes(artifact.id)}
                              onChange={() => {}}
                              className="h-4 w-4"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{artifact.title}</span>
                                <Badge variant="outline" className="text-[10px]">{artifact.agentId}</Badge>
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {artifact.summary}
                              </div>
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                            {new Date(artifact.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
              </div>

                  </div>
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* Run History Panel - Always visible */}
                <ResizablePanel defaultSize={10} minSize={8} maxSize={30}>
                  <div className="h-full flex flex-col border-t border-b">
                    <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b flex-shrink-0">
                      <h3 className="font-semibold text-sm flex items-center gap-2">
                        <History className="h-4 w-4" />
                        Run History
                        {runHistory.length > 0 && (
                          <Badge variant="secondary" className="text-xs">{runHistory.length}</Badge>
                        )}
                      </h3>
                      {runHistory.length > 0 && (
                        <Button variant="ghost" size="sm" onClick={clearHistory} className="h-6 text-xs text-destructive hover:text-destructive" title="Clear all history">
                          <Trash2 className="h-3 w-3 mr-1" />
                          Clear
                        </Button>
                      )}
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                      {runHistory.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                          No runs yet
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {runHistory.map((run) => (
                            <div
                              key={run.id}
                              className={`flex items-center justify-between p-2 rounded border cursor-pointer hover:bg-muted/50 transition-colors group ${result?.runId === run.id ? 'bg-primary/5 border-primary' : 'bg-background'}`}
                              onClick={() => loadRun(run.id)}
                            >
                              <div className="flex items-center gap-2">
                                {run.success ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-500" />
                                )}
                                <span className="text-sm">
                                  {new Date(run.timestamp).toLocaleString()}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {run.duration && <span>{run.duration}ms</span>}
                                {run.model && <Badge variant="outline" className="text-[10px]">{run.model}</Badge>}
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive transition-opacity"
                                  onClick={(e) => deleteRun(run.id, e)}
                                  title="Delete this run"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* Results Panel */}
                <ResizablePanel defaultSize={40} minSize={15}>
                  <div className="h-full overflow-y-auto">
                <div className="p-6">
                  {result ? (
                    <div className="space-y-4">
                      {/* Status Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {result.success ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                          <span className={`font-semibold ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                            {result.success ? 'Success' : 'Failed'}
                          </span>
                          {result.runId && (
                            <span className="text-xs text-muted-foreground">
                              Run: {result.runId.slice(0, 19)}
                            </span>
                          )}
                        </div>
                        {result.metadata && (
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              <span>{result.metadata.duration}ms</span>
                            </div>
                            {result.metadata.tokensUsed && (
                              <span>
                                {result.metadata.tokensUsed.input + result.metadata.tokensUsed.output} tokens
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Error Message */}
                      {result.error && (
                        <Card className="border-red-200 bg-red-50">
                          <CardContent className="p-4">
                            <div className="font-medium text-red-800">Error</div>
                            <pre className="text-sm text-red-700 whitespace-pre-wrap mt-2">
                              {result.error}
                            </pre>
                          </CardContent>
                        </Card>
                      )}

                      {/* Output */}
                      {result.output && (
                        <Card>
                          <CardHeader className="pb-2">
                            <button 
                              className="flex items-center gap-2 text-left"
                              onClick={() => setExpandedOutput(!expandedOutput)}
                            >
                              {expandedOutput ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                              <CardTitle className="text-lg">Output</CardTitle>
                            </button>
                          </CardHeader>
                          {expandedOutput && (
                            <CardContent>
                              <FormattedOutput output={result.output} />
                            </CardContent>
                          )}
                        </Card>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Beaker className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Select an account and click "Run Agent" to test</p>
                    </div>
                  )}
                </div>
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Beaker className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Select an agent to get started</p>
                <p className="text-sm mt-2">
                  Test agents independently with custom parameters
                </p>
              </div>
            </div>
          )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
