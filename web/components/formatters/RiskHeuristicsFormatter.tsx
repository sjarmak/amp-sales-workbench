'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import {
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Minus,
  Target,
  Eye,
  Lightbulb,
} from 'lucide-react'
import { useState } from 'react'

interface RiskHeuristicsFormatterProps {
  data: {
    riskScore?: {
      overall: number
      trend: 'increasing' | 'stable' | 'decreasing'
      category: 'low' | 'moderate' | 'elevated' | 'high' | 'critical'
    }
    risks?: Array<{
      type: string
      risk: string
      severity: 'critical' | 'high' | 'medium' | 'low'
      confidence: 'high' | 'medium' | 'low'
      evidence: Array<{ indicator: string; source: string; date?: string }>
      heuristic: string
      mitigation: { action: string; urgency: string; owner?: string }
    }>
    positiveSignals?: Array<{
      signal: string
      evidence: string
      strength: 'strong' | 'moderate' | 'weak'
    }>
    watchList?: Array<{
      item: string
      trigger: string
      checkDate?: string
    }>
    recommendations?: Array<{
      priority: number
      action: string
      rationale: string
      expectedOutcome: string
    }>
    dealHealthSummary?: string
  }
}

function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    critical: 'bg-red-200 text-red-900',
    high: 'bg-red-100 text-red-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-green-100 text-green-800',
  }
  return colors[severity?.toLowerCase()] || 'bg-gray-100 text-gray-800'
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    critical: 'bg-red-200 text-red-900 border-red-300',
    high: 'bg-red-100 text-red-800 border-red-200',
    elevated: 'bg-orange-100 text-orange-800 border-orange-200',
    moderate: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    low: 'bg-green-100 text-green-800 border-green-200',
  }
  return colors[category?.toLowerCase()] || 'bg-gray-100 text-gray-800 border-gray-200'
}

function getConfidenceColor(confidence: string): string {
  const colors: Record<string, string> = {
    high: 'bg-blue-100 text-blue-800',
    medium: 'bg-blue-50 text-blue-700',
    low: 'bg-gray-100 text-gray-700',
  }
  return colors[confidence?.toLowerCase()] || 'bg-gray-100 text-gray-800'
}

function getStrengthColor(strength: string): string {
  const colors: Record<string, string> = {
    strong: 'bg-green-100 text-green-800',
    moderate: 'bg-blue-100 text-blue-800',
    weak: 'bg-gray-100 text-gray-800',
  }
  return colors[strength?.toLowerCase()] || 'bg-gray-100 text-gray-800'
}

function getTrendIcon(trend: string) {
  switch (trend?.toLowerCase()) {
    case 'increasing':
      return <TrendingUp className="h-5 w-5 text-red-600" />
    case 'decreasing':
      return <TrendingDown className="h-5 w-5 text-green-600" />
    case 'stable':
    default:
      return <Minus className="h-5 w-5 text-yellow-600" />
  }
}

export function RiskHeuristicsFormatter({ data }: RiskHeuristicsFormatterProps) {
  const [expandedRisk, setExpandedRisk] = useState<number | null>(null)

  return (
    <div className="space-y-6">
      {/* Risk Score Overview */}
      {data.riskScore && (
        <Card className={`border-l-4 ${data.riskScore.category === 'critical' ? 'border-l-red-600' : data.riskScore.category === 'high' ? 'border-l-red-500' : 'border-l-yellow-500'}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Risk Score & Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-muted-foreground font-medium uppercase mb-2">Overall Score</div>
                <div className="text-3xl font-bold">{data.riskScore.overall}</div>
                <div className="text-xs text-muted-foreground mt-1">/100</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground font-medium uppercase mb-2">Category</div>
                <Badge className={`capitalize ${getCategoryColor(data.riskScore.category)}`}>
                  {data.riskScore.category}
                </Badge>
              </div>
              <div>
                <div className="text-xs text-muted-foreground font-medium uppercase mb-2">Trend</div>
                <div className="flex items-center gap-2">
                  {getTrendIcon(data.riskScore.trend)}
                  <span className="capitalize text-sm">{data.riskScore.trend}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Deal Health Summary */}
      {data.dealHealthSummary && (
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-base">Deal Health Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-foreground">{data.dealHealthSummary}</p>
          </CardContent>
        </Card>
      )}

      {/* Identified Risks */}
      {data.risks && data.risks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Identified Risks ({data.risks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.risks.map((risk, i) => (
              <div key={i} className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedRisk(expandedRisk === i ? null : i)}
                  className={`w-full p-3 text-left hover:bg-muted/50 transition-colors flex items-start justify-between ${getSeverityColor(risk.severity)}`}
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm">{risk.risk}</div>
                    <div className="text-xs mt-1 flex items-center gap-2">
                      <Badge variant="outline" className="text-xs capitalize">{risk.type}</Badge>
                      <Badge className={`text-xs ${getConfidenceColor(risk.confidence)}`}>
                        {risk.confidence} confidence
                      </Badge>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground ml-2">
                    {expandedRisk === i ? '−' : '+'}
                  </div>
                </button>

                {expandedRisk === i && (
                  <div className="bg-muted/20 p-4 border-t space-y-3">
                    {/* Heuristic */}
                    <div>
                      <h5 className="text-xs font-medium uppercase tracking-wide mb-1 text-muted-foreground">Heuristic Applied</h5>
                      <p className="text-sm">{risk.heuristic}</p>
                    </div>

                    {/* Evidence */}
                    {risk.evidence && risk.evidence.length > 0 && (
                      <div>
                        <h5 className="text-xs font-medium uppercase tracking-wide mb-2 text-muted-foreground">Evidence</h5>
                        <div className="space-y-1">
                          {risk.evidence.map((e, j) => (
                            <div key={j} className="text-sm text-muted-foreground border-l-2 border-primary/30 pl-2">
                              <div className="font-medium">{e.indicator}</div>
                              <div className="text-xs">
                                Source: {e.source}
                                {e.date && ` • ${e.date}`}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Mitigation */}
                    {risk.mitigation && (
                      <div className="bg-green-50 p-2 rounded border border-green-200">
                        <h5 className="text-xs font-medium uppercase tracking-wide mb-1 text-green-900">Mitigation</h5>
                        <div className="text-sm text-green-900">{risk.mitigation.action}</div>
                        <div className="text-xs text-green-800 mt-1 flex justify-between">
                          <span className="capitalize">Urgency: {risk.mitigation.urgency.replace('_', ' ')}</span>
                          {risk.mitigation.owner && <span>Owner: {risk.mitigation.owner}</span>}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Positive Signals */}
      {data.positiveSignals && data.positiveSignals.length > 0 && (
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              Positive Signals ({data.positiveSignals.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.positiveSignals.map((signal, i) => (
              <div key={i} className="border rounded p-3 bg-green-50">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="font-medium text-sm">{signal.signal}</div>
                  <Badge className={`text-xs ${getStrengthColor(signal.strength)}`}>
                    {signal.strength}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">{signal.evidence}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Watch List */}
      {data.watchList && data.watchList.length > 0 && (
        <Card className="border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <Eye className="h-5 w-5" />
              Watch List ({data.watchList.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.watchList.map((watch, i) => (
              <div key={i} className="border rounded p-3 bg-orange-50">
                <div className="font-medium text-sm mb-1">{watch.item}</div>
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">Trigger:</span> {watch.trigger}
                </div>
                {watch.checkDate && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Check: {watch.checkDate}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {data.recommendations && data.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Recommended Actions ({data.recommendations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recommendations.map((rec, i) => (
              <div key={i} className="border rounded p-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                    {rec.priority}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{rec.action}</div>
                    <div className="text-xs text-muted-foreground mt-1 mb-1">{rec.rationale}</div>
                    <div className="text-xs text-green-700 font-medium">Expected: {rec.expectedOutcome}</div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
