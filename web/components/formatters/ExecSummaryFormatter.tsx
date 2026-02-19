'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import {
  Target,
  Users,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Zap,
  CheckCircle2,
  Trophy,
} from 'lucide-react'

interface ExecSummaryFormatterProps {
  data: {
    overview: {
      accountName: string
      opportunityName: string
      stage: string
      amount: string
      closeDate: string
      probability: number
      daysInStage: number
      lastActivity: string
    }
    dealHealth: {
      score: 'green' | 'yellow' | 'red'
      trend: 'improving' | 'stable' | 'declining'
      summary: string
    }
    keyHighlights: string[]
    risks: Array<{
      risk: string
      severity: 'high' | 'medium' | 'low'
      mitigation: string
    }>
    opportunities: Array<{
      opportunity: string
      potential: 'high' | 'medium' | 'low'
      action: string
    }>
    stakeholders: {
      champion: string
      economicBuyer: string
      blockers: string[]
    }
    competitivePosition: {
      competitors: string[]
      ourPosition: 'winning' | 'competitive' | 'behind'
      keyBattleground: string
    }
    recommendations: Array<{
      action: string
      priority: 'immediate' | 'this_week' | 'this_month'
      owner: string
      rationale: string
    }>
    nextSteps: Array<{
      step: string
      owner: string
      dueDate: string
    }>
    supportNeeded: string[]
  }
}

function getDealHealthColor(score: string): string {
  const colors: Record<string, string> = {
    green: 'bg-green-100 text-green-900 border-green-300',
    yellow: 'bg-yellow-100 text-yellow-900 border-yellow-300',
    red: 'bg-red-100 text-red-900 border-red-300',
  }
  return colors[score?.toLowerCase()] || 'bg-gray-100 text-gray-900'
}

function getTrendColor(trend: string): string {
  const colors: Record<string, string> = {
    improving: 'text-green-600',
    stable: 'text-yellow-600',
    declining: 'text-red-600',
  }
  return colors[trend?.toLowerCase()] || 'text-gray-600'
}

function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-green-100 text-green-800',
  }
  return colors[severity?.toLowerCase()] || 'bg-gray-100 text-gray-800'
}

function getPotentialColor(potential: string): string {
  const colors: Record<string, string> = {
    high: 'bg-green-100 text-green-800',
    medium: 'bg-blue-100 text-blue-800',
    low: 'bg-gray-100 text-gray-800',
  }
  return colors[potential?.toLowerCase()] || 'bg-gray-100 text-gray-800'
}

function getPositionColor(position: string): string {
  const colors: Record<string, string> = {
    winning: 'text-green-700',
    competitive: 'text-blue-700',
    behind: 'text-red-700',
  }
  return colors[position?.toLowerCase()] || 'text-gray-700'
}

function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    immediate: 'bg-red-100 text-red-800',
    this_week: 'bg-orange-100 text-orange-800',
    this_month: 'bg-yellow-100 text-yellow-800',
  }
  return colors[priority?.toLowerCase()] || 'bg-gray-100 text-gray-800'
}

export function ExecSummaryFormatter({ data }: ExecSummaryFormatterProps) {
  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Opportunity Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase mb-1">Account</div>
              <div className="font-medium text-sm">{data.overview.accountName}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase mb-1">Opportunity</div>
              <div className="font-medium text-sm">{data.overview.opportunityName}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase mb-1">Stage</div>
              <Badge variant="secondary">{data.overview.stage}</Badge>
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase mb-1">Amount</div>
              <div className="font-medium text-sm">{data.overview.amount}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase mb-1">Close Date</div>
              <div className="text-sm">{data.overview.closeDate}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase mb-1">Probability</div>
              <div className="text-sm font-medium">{data.overview.probability}%</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase mb-1">Days in Stage</div>
              <div className="text-sm">{data.overview.daysInStage}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase mb-1">Last Activity</div>
              <div className="text-sm">{data.overview.lastActivity}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deal Health */}
      <Card className={`border-l-4 ${data.dealHealth.score === 'green' ? 'border-l-green-500' : data.dealHealth.score === 'yellow' ? 'border-l-yellow-500' : 'border-l-red-500'}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Deal Health
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Badge className={`capitalize ${getDealHealthColor(data.dealHealth.score)}`}>
              {data.dealHealth.score}
            </Badge>
            <span className={`text-sm capitalize font-medium ${getTrendColor(data.dealHealth.trend)}`}>
              {data.dealHealth.trend}
            </span>
          </div>
          <p className="text-sm text-foreground">{data.dealHealth.summary}</p>
        </CardContent>
      </Card>

      {/* Key Highlights */}
      {data.keyHighlights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Key Highlights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.keyHighlights.map((highlight, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{highlight}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Risks */}
      {data.risks.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Identified Risks ({data.risks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.risks.map((risk, i) => (
              <div key={i} className="border rounded p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-sm">{risk.risk}</div>
                  <Badge className={getSeverityColor(risk.severity)}>
                    {risk.severity}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">Mitigation: </span>
                  {risk.mitigation}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Opportunities */}
      {data.opportunities.length > 0 && (
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <Lightbulb className="h-5 w-5" />
              Expansion Opportunities ({data.opportunities.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.opportunities.map((opp, i) => (
              <div key={i} className="border rounded p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-sm">{opp.opportunity}</div>
                  <Badge className={getPotentialColor(opp.potential)}>
                    {opp.potential} potential
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">Action: </span>
                  {opp.action}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Stakeholders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Stakeholders
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="text-xs text-muted-foreground font-medium uppercase mb-1">Champion</div>
            <div className="text-sm font-medium text-green-700">{data.stakeholders.champion}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium uppercase mb-1">Economic Buyer</div>
            <div className="text-sm font-medium text-blue-700">{data.stakeholders.economicBuyer}</div>
          </div>
          {data.stakeholders.blockers.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase mb-2">Blockers</div>
              <div className="space-y-1">
                {data.stakeholders.blockers.map((blocker, i) => (
                  <div key={i} className="text-sm p-2 bg-red-50 rounded border border-red-200">
                    {blocker}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Competitive Position */}
      <Card className="border-purple-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-purple-600">
            <Trophy className="h-5 w-5" />
            Competitive Position
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium uppercase">Position:</span>
            <span className={`font-medium capitalize ${getPositionColor(data.competitivePosition.ourPosition)}`}>
              {data.competitivePosition.ourPosition}
            </span>
          </div>
          {data.competitivePosition.competitors.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase mb-2">Competitors</div>
              <div className="flex flex-wrap gap-1">
                {data.competitivePosition.competitors.map((comp, i) => (
                  <Badge key={i} variant="outline">{comp}</Badge>
                ))}
              </div>
            </div>
          )}
          <div>
            <div className="text-xs text-muted-foreground font-medium uppercase mb-1">Key Battleground</div>
            <div className="text-sm">{data.competitivePosition.keyBattleground}</div>
          </div>
        </CardContent>
      </Card>

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
                    <div className="font-medium text-sm">{rec.action}</div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                      <Badge className={getPriorityColor(rec.priority)}>
                        {rec.priority.replace('_', ' ')}
                      </Badge>
                      <Badge variant="outline">{rec.owner}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 italic">{rec.rationale}</div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Next Steps */}
      {data.nextSteps.length > 0 && (
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Next Steps ({data.nextSteps.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.nextSteps.map((step, i) => (
              <div key={i} className="border rounded p-3 bg-blue-50">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="font-medium text-sm">{step.step}</div>
                  <Badge variant="secondary" className="text-xs">{step.dueDate}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">Owner: {step.owner}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Support Needed */}
      {data.supportNeeded.length > 0 && (
        <Card className="bg-amber-50 border-amber-200">
          <CardHeader>
            <CardTitle className="text-amber-900">Support Needed</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {data.supportNeeded.map((need, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <span className="text-amber-600 mt-0.5">•</span>
                  <span>{need}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
