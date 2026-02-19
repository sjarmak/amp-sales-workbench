'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import {
  Lightbulb,
  AlertCircle,
  TrendingUp,
  Users,
  MessageSquare,
  Target,
  CheckCircle2,
  Volume2,
} from 'lucide-react'

interface CoachingFormatterProps {
  data: {
    callOverview: {
      type: string
      duration: number
      participants: string[]
      overallRating: string
    }
    strengths: Array<{
      area: string
      evidence: string
      impact: string
    }>
    improvements: Array<{
      area: string
      observation: string
      suggestion: string
      example: string
      priority: string
    }>
    metrics: {
      talkRatio: {
        rep: number
        customer: number
        recommendation: string
      }
      questionsAsked: {
        total: number
        open: number
        closed: number
        followUp: number
        recommendation: string
      }
      silencePauses: string
      fillerWords: string
    }
    objectionHandling: Array<{
      objection: string
      response: string
      effectiveness: string
      alternative: string
    }>
    discoveryAnalysis: {
      painsCovered: string[]
      painsMissed: string[]
      impactQuantified: boolean
      stakeholdersMapped: boolean
    }
    recommendations: Array<{
      focus: string
      why: string
      howToPractice: string
      resources: string[]
    }>
    practiceScenarios: Array<{
      scenario: string
      objective: string
      setup: string
    }>
  }
}

function getRatingColor(rating: string): string {
  const colors: Record<string, string> = {
    excellent: 'bg-green-100 text-green-900 border-green-300',
    good: 'bg-blue-100 text-blue-900 border-blue-300',
    needs_improvement: 'bg-yellow-100 text-yellow-900 border-yellow-300',
    poor: 'bg-red-100 text-red-900 border-red-300',
  }
  return colors[rating?.toLowerCase()] || 'bg-gray-100 text-gray-900'
}

function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-green-100 text-green-800',
  }
  return colors[priority?.toLowerCase()] || 'bg-gray-100 text-gray-800'
}

function getEffectivenessColor(effectiveness: string): string {
  const colors: Record<string, string> = {
    effective: 'bg-green-100 text-green-800',
    partial: 'bg-yellow-100 text-yellow-800',
    ineffective: 'bg-red-100 text-red-800',
  }
  return colors[effectiveness?.toLowerCase()] || 'bg-gray-100 text-gray-800'
}

export function CoachingFormatter({ data }: CoachingFormatterProps) {
  const durationMins = Math.floor(data.callOverview.duration)

  return (
    <div className="space-y-6">
      {/* Call Overview */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            Call Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase mb-1">Type</div>
              <Badge variant="secondary" className="capitalize">{data.callOverview.type}</Badge>
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase mb-1">Duration</div>
              <div className="font-medium text-sm">{durationMins} minutes</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase mb-1">Rating</div>
              <Badge className={`capitalize ${getRatingColor(data.callOverview.overallRating)}`}>
                {data.callOverview.overallRating}
              </Badge>
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase mb-1">Participants</div>
              <div className="text-sm font-medium">{data.callOverview.participants.length}</div>
            </div>
          </div>
          {data.callOverview.participants.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase mb-2">Attendees</div>
              <div className="flex flex-wrap gap-1">
                {data.callOverview.participants.map((p, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{p}</Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
              <div key={i} className="border rounded p-3 space-y-2">
                <div className="font-medium text-sm">{strength.area}</div>
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">Evidence: </span>
                  {strength.evidence}
                </div>
                <div className="text-sm text-green-600">
                  <span className="font-medium">Impact: </span>
                  {strength.impact}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Areas for Improvement */}
      {data.improvements.length > 0 && (
        <Card className="border-yellow-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-600">
              <AlertCircle className="h-5 w-5" />
              Areas for Improvement ({data.improvements.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.improvements.map((improvement, i) => (
              <div key={i} className="border rounded p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-sm">{improvement.area}</div>
                  <Badge className={getPriorityColor(improvement.priority)}>
                    {improvement.priority}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">Observation: </span>
                  {improvement.observation}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Suggestion: </span>
                  {improvement.suggestion}
                </div>
                <div className="text-xs p-2 bg-slate-50 rounded border border-slate-200 italic">
                  {improvement.example}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Call Metrics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Talk Ratio */}
          <div>
            <div className="text-xs text-muted-foreground font-medium uppercase mb-2">Talk Ratio</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 border rounded">
                <div className="text-sm font-medium mb-1">Rep Talk Time</div>
                <div className="text-2xl font-bold text-primary">{data.metrics.talkRatio.rep}%</div>
              </div>
              <div className="p-3 border rounded">
                <div className="text-sm font-medium mb-1">Customer Talk Time</div>
                <div className="text-2xl font-bold text-green-600">{data.metrics.talkRatio.customer}%</div>
              </div>
            </div>
            {data.metrics.talkRatio.recommendation && (
              <div className="text-sm text-muted-foreground mt-2 italic">
                {data.metrics.talkRatio.recommendation}
              </div>
            )}
          </div>

          {/* Questions Asked */}
          <div>
            <div className="text-xs text-muted-foreground font-medium uppercase mb-2">Questions Asked</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-2 border rounded text-center">
                <div className="text-xs text-muted-foreground mb-1">Total</div>
                <div className="text-xl font-bold">{data.metrics.questionsAsked.total}</div>
              </div>
              <div className="p-2 border rounded text-center">
                <div className="text-xs text-muted-foreground mb-1">Open</div>
                <div className="text-xl font-bold text-blue-600">{data.metrics.questionsAsked.open}</div>
              </div>
              <div className="p-2 border rounded text-center">
                <div className="text-xs text-muted-foreground mb-1">Closed</div>
                <div className="text-xl font-bold text-green-600">{data.metrics.questionsAsked.closed}</div>
              </div>
              <div className="p-2 border rounded text-center">
                <div className="text-xs text-muted-foreground mb-1">Follow-up</div>
                <div className="text-xl font-bold text-purple-600">{data.metrics.questionsAsked.followUp}</div>
              </div>
            </div>
            {data.metrics.questionsAsked.recommendation && (
              <div className="text-sm text-muted-foreground mt-2 italic">
                {data.metrics.questionsAsked.recommendation}
              </div>
            )}
          </div>

          {/* Vocal Patterns */}
          <div className="grid grid-cols-2 gap-3">
            {data.metrics.silencePauses && (
              <div className="p-3 border rounded">
                <div className="text-xs text-muted-foreground font-medium uppercase mb-1">Silence & Pauses</div>
                <div className="text-sm">{data.metrics.silencePauses}</div>
              </div>
            )}
            {data.metrics.fillerWords && (
              <div className="p-3 border rounded">
                <div className="text-xs text-muted-foreground font-medium uppercase mb-1">Filler Words</div>
                <div className="text-sm">{data.metrics.fillerWords}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Objection Handling */}
      {data.objectionHandling.length > 0 && (
        <Card className="border-purple-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-600">
              <MessageSquare className="h-5 w-5" />
              Objection Handling ({data.objectionHandling.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.objectionHandling.map((obj, i) => (
              <div key={i} className="border rounded p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-sm">{obj.objection}</div>
                  <Badge className={getEffectivenessColor(obj.effectiveness)}>
                    {obj.effectiveness}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">Response: </span>
                  {obj.response}
                </div>
                {obj.alternative && (
                  <div className="text-sm p-2 bg-blue-50 rounded border border-blue-200">
                    <span className="font-medium">Alternative approach: </span>
                    {obj.alternative}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Discovery Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Discovery Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 border rounded">
              <div className="flex items-center gap-2 mb-1">
                <div className="text-sm font-medium">Impact Quantified</div>
                {data.discoveryAnalysis.impactQuantified ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {data.discoveryAnalysis.impactQuantified ? 'Yes' : 'Not yet'}
              </div>
            </div>
            <div className="p-3 border rounded">
              <div className="flex items-center gap-2 mb-1">
                <div className="text-sm font-medium">Stakeholders Mapped</div>
                {data.discoveryAnalysis.stakeholdersMapped ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {data.discoveryAnalysis.stakeholdersMapped ? 'Yes' : 'Not yet'}
              </div>
            </div>
          </div>

          {data.discoveryAnalysis.painsCovered.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase mb-2">Pains Covered</div>
              <div className="space-y-1">
                {data.discoveryAnalysis.painsCovered.map((pain, i) => (
                  <div key={i} className="text-sm flex items-start gap-2 p-2 bg-green-50 rounded">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span>{pain}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.discoveryAnalysis.painsMissed.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase mb-2">Pains Missed</div>
              <div className="space-y-1">
                {data.discoveryAnalysis.painsMissed.map((pain, i) => (
                  <div key={i} className="text-sm flex items-start gap-2 p-2 bg-yellow-50 rounded">
                    <span className="text-yellow-600 mt-0.5">→</span>
                    <span>{pain}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recommendations */}
      {data.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Development Recommendations ({data.recommendations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recommendations.map((rec, i) => (
              <div key={i} className="border rounded p-3 space-y-2">
                <div className="font-medium text-sm">{rec.focus}</div>
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">Why: </span>
                  {rec.why}
                </div>
                <div className="text-sm">
                  <span className="font-medium">How to practice: </span>
                  {rec.howToPractice}
                </div>
                {rec.resources.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {rec.resources.map((resource, j) => (
                      <Badge key={j} variant="outline" className="text-xs">{resource}</Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Practice Scenarios */}
      {data.practiceScenarios.length > 0 && (
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-600">
              <Target className="h-5 w-5" />
              Practice Scenarios ({data.practiceScenarios.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.practiceScenarios.map((scenario, i) => (
              <div key={i} className="border rounded p-3 space-y-2 bg-blue-50">
                <div className="font-medium text-sm">{scenario.scenario}</div>
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">Objective: </span>
                  {scenario.objective}
                </div>
                <div className="text-sm p-2 bg-white rounded border border-blue-200">
                  <span className="font-medium">Setup: </span>
                  {scenario.setup}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
