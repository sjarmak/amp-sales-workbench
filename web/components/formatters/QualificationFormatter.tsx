'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import {
  BarChart3,
  AlertTriangle,
  TrendingUp,
  Zap,
  Target,
  CheckCircle2,
  AlertCircle,
  Grid3x3,
} from 'lucide-react'

interface QualificationFormatterProps {
  data: {
    methodology: string
    scores: {
      overall: number
      elements: Array<{
        element: string
        score: number
        maxScore: number
        status: string
        evidence: string[]
        notes: string
      }>
    }
    gaps: Array<{
      element: string
      gap: string
      priority: string
      suggestedAction: string
      questions: string[]
    }>
    strengths: Array<{
      element: string
      strength: string
      leverage: string
    }>
    recommendations: Array<{
      action: string
      rationale: string
      priority: string
    }>
    overallAssessment: {
      qualified: boolean
      confidence: string
      stageAppropriate: boolean
      summary: string
      nextMilestone: string
    }
    disqualificationRisks: Array<{
      risk: string
      severity: string
      validationNeeded: string
    }>
  }
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    strong: 'bg-green-100 text-green-800',
    partial: 'bg-yellow-100 text-yellow-800',
    weak: 'bg-red-100 text-red-800',
    unknown: 'bg-gray-100 text-gray-800',
  }
  return colors[status?.toLowerCase()] || 'bg-gray-100 text-gray-800'
}

function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    critical: 'bg-red-200 text-red-900 border-red-300',
    high: 'bg-red-100 text-red-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-green-100 text-green-800',
  }
  return colors[priority?.toLowerCase()] || 'bg-gray-100 text-gray-800'
}

function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-green-100 text-green-800',
  }
  return colors[severity?.toLowerCase()] || 'bg-gray-100 text-gray-800'
}

function getConfidenceColor(confidence: string): string {
  const colors: Record<string, string> = {
    high: 'text-green-600',
    medium: 'text-yellow-600',
    low: 'text-red-600',
  }
  return colors[confidence?.toLowerCase()] || 'text-gray-600'
}

export function QualificationFormatter({ data }: QualificationFormatterProps) {
  const scorePercentage = data.scores.overall
  const isQualified = data.overallAssessment.qualified

  return (
    <div className="space-y-6">
      {/* Overall Assessment */}
      <Card className={`border-l-4 ${isQualified ? 'border-l-green-500' : 'border-l-red-500'}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Qualification Summary ({data.methodology})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 border rounded text-center">
              <div className="text-xs text-muted-foreground font-medium uppercase mb-1">Overall Score</div>
              <div className="text-3xl font-bold text-primary">{scorePercentage}</div>
              <div className="text-xs text-muted-foreground">points</div>
            </div>
            <div className="p-3 border rounded text-center">
              <div className="text-xs text-muted-foreground font-medium uppercase mb-1">Status</div>
              <Badge className={isQualified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                {isQualified ? 'Qualified' : 'Not Qualified'}
              </Badge>
            </div>
            <div className="p-3 border rounded text-center">
              <div className="text-xs text-muted-foreground font-medium uppercase mb-1">Confidence</div>
              <div className={`font-medium capitalize ${getConfidenceColor(data.overallAssessment.confidence)}`}>
                {data.overallAssessment.confidence}
              </div>
            </div>
          </div>

          {data.overallAssessment.summary && (
            <div className="p-3 bg-muted/50 rounded border">
              <div className="text-sm">{data.overallAssessment.summary}</div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-2">
              <div className={data.overallAssessment.stageAppropriate ? 'text-green-600' : 'text-yellow-600'}>
                {data.overallAssessment.stageAppropriate ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <AlertCircle className="h-5 w-5" />
                )}
              </div>
              <div className="text-sm">Stage Appropriate</div>
            </div>
            {data.overallAssessment.nextMilestone && (
              <div className="text-sm p-2 bg-blue-50 rounded border border-blue-200">
                <span className="font-medium">Next Milestone: </span>
                {data.overallAssessment.nextMilestone}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Element Scores */}
      {data.scores.elements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Grid3x3 className="h-5 w-5" />
              {data.methodology} Elements
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.scores.elements.map((element, i) => (
              <div key={i} className="border rounded p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm">{element.element}</div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-bold">
                      {element.score}/{element.maxScore}
                    </div>
                    <Badge className={getStatusColor(element.status)}>
                      {element.status}
                    </Badge>
                  </div>
                </div>

                {/* Score Bar */}
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      element.status === 'strong'
                        ? 'bg-green-500'
                        : element.status === 'partial'
                          ? 'bg-yellow-500'
                          : element.status === 'weak'
                            ? 'bg-red-500'
                            : 'bg-gray-400'
                    }`}
                    style={{ width: `${(element.score / element.maxScore) * 100}%` }}
                  />
                </div>

                {element.notes && (
                  <div className="text-sm text-muted-foreground">{element.notes}</div>
                )}

                {element.evidence.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs font-medium text-muted-foreground uppercase mb-1">Evidence</div>
                    <ul className="space-y-1">
                      {element.evidence.map((ev, j) => (
                        <li key={j} className="text-xs flex items-start gap-2 text-muted-foreground">
                          <span className="mt-1">•</span>
                          <span>{ev}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Strengths */}
      {data.strengths.length > 0 && (
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              Strengths ({data.strengths.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.strengths.map((strength, i) => (
              <div key={i} className="border rounded p-3 space-y-2 bg-green-50">
                <div className="font-medium text-sm">{strength.element}</div>
                <div className="text-sm">{strength.strength}</div>
                <div className="text-sm p-2 bg-white rounded border border-green-200">
                  <span className="font-medium">How to leverage: </span>
                  {strength.leverage}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Gaps */}
      {data.gaps.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Gaps & Risks ({data.gaps.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.gaps.map((gap, i) => (
              <div key={i} className="border rounded p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-sm">{gap.element}</div>
                  <Badge className={getPriorityColor(gap.priority)}>
                    {gap.priority}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">Gap: </span>
                  {gap.gap}
                </div>
                <div className="text-sm p-2 bg-blue-50 rounded border border-blue-200">
                  <span className="font-medium">Suggested action: </span>
                  {gap.suggestedAction}
                </div>
                {gap.questions.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground uppercase mb-1">Discovery Questions</div>
                    <ul className="space-y-1">
                      {gap.questions.map((q, j) => (
                        <li key={j} className="text-xs text-muted-foreground flex items-start gap-2">
                          <span className="mt-1">→</span>
                          <span>{q}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
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
                    <div className="font-medium text-sm mb-1">{rec.action}</div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={getPriorityColor(rec.priority)}>
                        {rec.priority}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground italic">{rec.rationale}</div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Disqualification Risks */}
      {data.disqualificationRisks.length > 0 && (
        <Card className="border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <Zap className="h-5 w-5" />
              Disqualification Risks ({data.disqualificationRisks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.disqualificationRisks.map((risk, i) => (
              <div key={i} className="border rounded p-3 space-y-2 bg-orange-50">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-sm">{risk.risk}</div>
                  <Badge className={getSeverityColor(risk.severity)}>
                    {risk.severity}
                  </Badge>
                </div>
                <div className="text-sm p-2 bg-white rounded border border-orange-200">
                  <span className="font-medium">Validation needed: </span>
                  {risk.validationNeeded}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
