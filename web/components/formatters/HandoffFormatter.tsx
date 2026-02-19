'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import {
  Handshake,
  Users,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Trophy,
  FileText,
  Target,
  Clock,
  Zap,
} from 'lucide-react'

interface HandoffFormatterProps {
  data: {
    handoffType: string
    summary: {
      accountName: string
      currentStage: string
      dealValue: string
      closeDate: string
      productsInScope: string[]
      urgency: string
      oneLiner: string
    }
    context: {
      background: string
      currentSituation: string
      recentDevelopments: string
      upcomingEvents: string
    }
    stakeholders: Array<{
      name: string
      title: string
      role: string
      engagement: string
      relationshipOwner: string
      notes: string
    }>
    openItems: Array<{
      item: string
      status: string
      owner: string
      dueDate: string
      context: string
    }>
    technicalContext: {
      currentStack: string[]
      integrationNeeds: string[]
      securityRequirements: string[]
      technicalConcerns: string[]
    }
    competitiveLandscape: {
      competitors: string[]
      ourPosition: string
      keyBattles: string
    }
    recommendations: Array<{
      recommendation: string
      priority: string
      rationale: string
    }>
    timeline: Array<{
      date: string
      event: string
      importance: string
    }>
    attachments: Array<{
      name: string
      location: string
      purpose: string
    }>
    introductionPlan: {
      warmIntro: string
      positioning: string
      keyMessages: string[]
    }
  }
}

function getUrgencyColor(urgency: string): string {
  const colors: Record<string, string> = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-green-100 text-green-800',
  }
  return colors[urgency?.toLowerCase()] || 'bg-gray-100 text-gray-800'
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    in_progress: 'bg-blue-100 text-blue-800',
    pending: 'bg-yellow-100 text-yellow-800',
    blocked: 'bg-red-100 text-red-800',
  }
  return colors[status?.toLowerCase()] || 'bg-gray-100 text-gray-800'
}

function getEngagementColor(engagement: string): string {
  const colors: Record<string, string> = {
    high: 'text-green-700',
    medium: 'text-yellow-700',
    low: 'text-red-700',
  }
  return colors[engagement?.toLowerCase()] || 'text-gray-700'
}

function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    immediate: 'bg-red-100 text-red-800',
    short_term: 'bg-orange-100 text-orange-800',
    ongoing: 'bg-blue-100 text-blue-800',
  }
  return colors[priority?.toLowerCase()] || 'bg-gray-100 text-gray-800'
}

function getRoleColor(role: string): string {
  const colors: Record<string, string> = {
    champion: 'bg-green-100 text-green-800',
    decision_maker: 'bg-purple-100 text-purple-800',
    influencer: 'bg-blue-100 text-blue-800',
    blocker: 'bg-red-100 text-red-800',
    user: 'bg-gray-100 text-gray-800',
  }
  return colors[role?.toLowerCase()] || 'bg-gray-100 text-gray-800'
}

export function HandoffFormatter({ data }: HandoffFormatterProps) {
  return (
    <div className="space-y-6">
      {/* Handoff Summary */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Handshake className="h-5 w-5" />
            Handoff Summary
          </CardTitle>
          <CardDescription className="text-sm capitalize">{data.handoffType.replace(/_/g, ' to ')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.summary.oneLiner && (
            <div className="p-3 bg-blue-50 rounded border border-blue-200">
              <div className="text-sm italic">{data.summary.oneLiner}</div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase mb-1">Account</div>
              <div className="font-medium text-sm">{data.summary.accountName}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase mb-1">Current Stage</div>
              <Badge variant="secondary">{data.summary.currentStage}</Badge>
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase mb-1">Deal Value</div>
              <div className="font-medium text-sm">{data.summary.dealValue}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase mb-1">Close Date</div>
              <div className="text-sm">{data.summary.closeDate}</div>
            </div>
            <div className="col-span-2">
              <div className="text-xs text-muted-foreground font-medium uppercase mb-2">Urgency</div>
              <Badge className={getUrgencyColor(data.summary.urgency)}>
                {data.summary.urgency}
              </Badge>
            </div>
          </div>

          {data.summary.productsInScope.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase mb-2">Products in Scope</div>
              <div className="flex flex-wrap gap-1">
                {data.summary.productsInScope.map((product, i) => (
                  <Badge key={i} variant="outline">{product}</Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Context */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Account Context
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.context.background && (
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase mb-1">Background</div>
              <div className="text-sm text-foreground">{data.context.background}</div>
            </div>
          )}
          {data.context.currentSituation && (
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase mb-1">Current Situation</div>
              <div className="text-sm text-foreground">{data.context.currentSituation}</div>
            </div>
          )}
          {data.context.recentDevelopments && (
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase mb-1">Recent Developments</div>
              <div className="text-sm text-foreground">{data.context.recentDevelopments}</div>
            </div>
          )}
          {data.context.upcomingEvents && (
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase mb-1">Upcoming Events</div>
              <div className="text-sm text-foreground">{data.context.upcomingEvents}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stakeholders */}
      {data.stakeholders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Stakeholders ({data.stakeholders.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.stakeholders.map((stakeholder, i) => (
              <div key={i} className="border rounded p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-sm">{stakeholder.name}</div>
                    <div className="text-xs text-muted-foreground">{stakeholder.title}</div>
                  </div>
                  <div className="flex gap-1">
                    <Badge className={getRoleColor(stakeholder.role)} style={{ whiteSpace: 'nowrap' }}>
                      {stakeholder.role.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Engagement:</span>
                  <span className={`font-medium capitalize ${getEngagementColor(stakeholder.engagement)}`}>
                    {stakeholder.engagement}
                  </span>
                </div>
                {stakeholder.relationshipOwner && (
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">Current Owner:</span> {stakeholder.relationshipOwner}
                  </div>
                )}
                {stakeholder.notes && (
                  <div className="text-xs p-2 bg-gray-50 rounded border border-gray-200">
                    {stakeholder.notes}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Open Items */}
      {data.openItems.length > 0 && (
        <Card className="border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <Clock className="h-5 w-5" />
              Open Items ({data.openItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.openItems.map((item, i) => (
              <div key={i} className="border rounded p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-sm">{item.item}</div>
                  <Badge className={getStatusColor(item.status)}>
                    {item.status.replace('_', ' ')}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div><span className="font-medium">Owner:</span> {item.owner}</div>
                  <div><span className="font-medium">Due:</span> {item.dueDate}</div>
                </div>
                {item.context && (
                  <div className="text-sm p-2 bg-gray-50 rounded border border-gray-200">
                    {item.context}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Technical Context */}
      {(data.technicalContext.currentStack.length > 0 ||
        data.technicalContext.integrationNeeds.length > 0 ||
        data.technicalContext.securityRequirements.length > 0 ||
        data.technicalContext.technicalConcerns.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Technical Context
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.technicalContext.currentStack.length > 0 && (
              <div>
                <div className="text-xs text-muted-foreground font-medium uppercase mb-2">Current Stack</div>
                <div className="flex flex-wrap gap-1">
                  {data.technicalContext.currentStack.map((item, i) => (
                    <Badge key={i} variant="secondary">{item}</Badge>
                  ))}
                </div>
              </div>
            )}

            {data.technicalContext.integrationNeeds.length > 0 && (
              <div>
                <div className="text-xs text-muted-foreground font-medium uppercase mb-2">Integration Needs</div>
                <ul className="space-y-1">
                  {data.technicalContext.integrationNeeds.map((need, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{need}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.technicalContext.securityRequirements.length > 0 && (
              <div>
                <div className="text-xs text-muted-foreground font-medium uppercase mb-2">Security Requirements</div>
                <ul className="space-y-1">
                  {data.technicalContext.securityRequirements.map((req, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="text-blue-600 mt-0.5">•</span>
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.technicalContext.technicalConcerns.length > 0 && (
              <div>
                <div className="text-xs text-muted-foreground font-medium uppercase mb-2">Technical Concerns</div>
                <ul className="space-y-1">
                  {data.technicalContext.technicalConcerns.map((concern, i) => (
                    <li key={i} className="text-sm flex items-start gap-2 text-yellow-700">
                      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>{concern}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Competitive Landscape */}
      {(data.competitiveLandscape.competitors.length > 0 || data.competitiveLandscape.ourPosition) && (
        <Card className="border-purple-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-600">
              <Trophy className="h-5 w-5" />
              Competitive Landscape
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.competitiveLandscape.ourPosition && (
              <div className="p-3 border rounded bg-purple-50">
                <div className="text-xs text-muted-foreground font-medium uppercase mb-1">Our Position</div>
                <div className="text-sm font-medium">{data.competitiveLandscape.ourPosition}</div>
              </div>
            )}

            {data.competitiveLandscape.competitors.length > 0 && (
              <div>
                <div className="text-xs text-muted-foreground font-medium uppercase mb-2">Competitors</div>
                <div className="flex flex-wrap gap-1">
                  {data.competitiveLandscape.competitors.map((comp, i) => (
                    <Badge key={i} variant="outline">{comp}</Badge>
                  ))}
                </div>
              </div>
            )}

            {data.competitiveLandscape.keyBattles && (
              <div className="p-3 border rounded">
                <div className="text-xs text-muted-foreground font-medium uppercase mb-1">Key Battleground</div>
                <div className="text-sm">{data.competitiveLandscape.keyBattles}</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      {data.timeline.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Key Dates & Milestones
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.timeline.map((item, i) => (
              <div key={i} className="border rounded p-3 flex gap-3">
                <div className="flex-shrink-0 w-20">
                  <div className="text-sm font-semibold">{item.date}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{item.event}</div>
                  {item.importance && (
                    <div className="text-xs text-muted-foreground mt-1">{item.importance}</div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Introduction Plan */}
      {(data.introductionPlan.warmIntro || data.introductionPlan.positioning || data.introductionPlan.keyMessages.length > 0) && (
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <Handshake className="h-5 w-5" />
              Introduction Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.introductionPlan.warmIntro && (
              <div>
                <div className="text-xs text-muted-foreground font-medium uppercase mb-1">Warm Introduction</div>
                <div className="text-sm p-2 bg-green-50 rounded border border-green-200">
                  {data.introductionPlan.warmIntro}
                </div>
              </div>
            )}

            {data.introductionPlan.positioning && (
              <div>
                <div className="text-xs text-muted-foreground font-medium uppercase mb-1">Positioning</div>
                <div className="text-sm p-2 bg-green-50 rounded border border-green-200">
                  {data.introductionPlan.positioning}
                </div>
              </div>
            )}

            {data.introductionPlan.keyMessages.length > 0 && (
              <div>
                <div className="text-xs text-muted-foreground font-medium uppercase mb-2">Key Messages</div>
                <ul className="space-y-2">
                  {data.introductionPlan.keyMessages.map((msg, i) => (
                    <li key={i} className="text-sm flex items-start gap-2 p-2 bg-green-50 rounded border border-green-200">
                      <span className="text-green-600 font-bold mt-0.5">{i + 1}.</span>
                      <span>{msg}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {data.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Recommendations ({data.recommendations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recommendations.map((rec, i) => (
              <div key={i} className="border rounded p-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm mb-1">{rec.recommendation}</div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={getPriorityColor(rec.priority)}>
                        {rec.priority.replace('_', ' ')}
                      </Badge>
                    </div>
                    {rec.rationale && (
                      <div className="text-xs text-muted-foreground italic">{rec.rationale}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Attachments */}
      {data.attachments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Reference Materials ({data.attachments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.attachments.map((attachment, i) => (
              <div key={i} className="border rounded p-3">
                <div className="font-medium text-sm mb-1">{attachment.name}</div>
                {attachment.purpose && (
                  <div className="text-xs text-muted-foreground mb-1">{attachment.purpose}</div>
                )}
                {attachment.location && (
                  <div className="text-xs p-1 bg-gray-50 rounded border border-gray-200 font-mono break-all">
                    {attachment.location}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
