'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import {
  AlertTriangle,
  CheckCircle2,
  Users,
  MessageSquare,
  Target,
  TrendingUp,
  FileText,
} from 'lucide-react'

interface DiscoveryRecapFormatterProps {
  data: {
    summary?: string
    keyFindings?: Array<{ finding: string; impact: string }>
    customerGoals?: Array<{ goal: string; priority: string; success_criteria: string }>
    painPoints?: Array<{ pain: string; severity: string; impact: string }>
    technicalRequirements?: Array<{ requirement: string; rationale: string }>
    decision_criteria?: Array<{ criterion: string; weight: string; importance: string }>
    risks?: Array<{ risk: string; severity: string; mitigation: string }>
    nextActions?: Array<{ action: string; owner: string; timeline: string }>
    [key: string]: any
  }
}

function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-green-100 text-green-800',
    critical: 'bg-red-200 text-red-900',
  }
  return colors[severity?.toLowerCase()] || 'bg-gray-100 text-gray-800'
}

function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-green-100 text-green-800',
  }
  return colors[priority?.toLowerCase()] || 'bg-gray-100 text-gray-800'
}

export function DiscoveryRecapFormatter({ data }: DiscoveryRecapFormatterProps) {
  return (
    <div className="space-y-6">
      {/* Executive Summary */}
      {data.summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Executive Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-foreground">{data.summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Key Findings */}
      {data.keyFindings && data.keyFindings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Key Findings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.keyFindings.map((f, i) => (
              <div key={i} className="border rounded p-3 hover:bg-muted/30 transition-colors">
                <div className="font-medium text-sm">{f.finding}</div>
                <div className="text-xs text-muted-foreground mt-1">Impact: {f.impact}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Customer Goals */}
      {data.customerGoals && data.customerGoals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Customer Goals & Objectives
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.customerGoals.map((g, i) => (
              <div key={i} className="border rounded p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-sm">{g.goal}</div>
                  <Badge className={getPriorityColor(g.priority)} variant="default">
                    {g.priority}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  <span className="font-medium">Success Criteria:</span> {g.success_criteria}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Pain Points */}
      {data.painPoints && data.painPoints.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              Pain Points & Challenges
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.painPoints.map((p, i) => (
              <div key={i} className={`border rounded p-3 ${getSeverityColor(p.severity)}`}>
                <div className="font-medium text-sm">{p.pain}</div>
                <div className="text-xs mt-1">Business Impact: {p.impact}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Technical Requirements */}
      {data.technicalRequirements && data.technicalRequirements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Technical Requirements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.technicalRequirements.map((r, i) => (
              <div key={i} className="border rounded p-3">
                <div className="font-medium text-sm">{r.requirement}</div>
                <div className="text-xs text-muted-foreground mt-1">Rationale: {r.rationale}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Decision Criteria */}
      {data.decision_criteria && data.decision_criteria.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Decision Criteria</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.decision_criteria.map((c, i) => (
              <div key={i} className="border rounded p-3 flex items-start justify-between">
                <div>
                  <div className="font-medium text-sm">{c.criterion}</div>
                  <div className="text-xs text-muted-foreground">Importance: {c.importance}</div>
                </div>
                <Badge variant="outline">{c.weight}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Risks */}
      {data.risks && data.risks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Identified Risks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.risks.map((r, i) => (
              <div key={i} className={`border rounded p-3 ${getSeverityColor(r.severity)}`}>
                <div className="font-medium text-sm">{r.risk}</div>
                <div className="text-xs mt-1">
                  <span className="font-medium">Mitigation:</span> {r.mitigation}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Next Actions */}
      {data.nextActions && data.nextActions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Next Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.nextActions.map((a, i) => (
              <div key={i} className="border rounded p-3">
                <div className="font-medium text-sm">{a.action}</div>
                <div className="text-xs text-muted-foreground mt-1 flex justify-between">
                  <span>Owner: {a.owner}</span>
                  <span>Timeline: {a.timeline}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
