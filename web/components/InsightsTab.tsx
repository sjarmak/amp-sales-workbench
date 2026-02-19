'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { FileText, TrendingUp, AlertTriangle, RefreshCw, Download, Target } from 'lucide-react'

const API_URL = 'http://localhost:3001/api'

interface ExecutiveSummary {
  accountKey: { name: string; domain?: string; salesforceId?: string }
  problemStatement: string
  solutionFit: string
  successMetrics: string[]
  socialProof: string[]
  nextSteps: string[]
  generatedAt: string
}

interface RiskFactor {
  factor: string
  severity: 'high' | 'medium' | 'low'
  mitigation: string
}

interface DealReview {
  accountKey: { name: string; domain?: string; salesforceId?: string }
  dealHealthScore: number
  status: string
  strategy: string
  riskFactors: RiskFactor[]
  pathToClose: string
  coachingTips: string[]
  generatedAt: string
}

interface ClosedLostAnalysis {
  accountKey: { name: string; domain?: string; salesforceId?: string }
  lossReason: string
  competitorWon?: string
  rootCauses: string[]
  lessonsLearned: string[]
  followUpOpportunities: string[]
  generatedAt: string
}

interface QualificationCriterion {
  criterion: string
  score: number
  evidence: string[]
  gaps: string[]
}

interface QualificationReport {
  accountKey: { name: string; domain?: string; salesforceId?: string }
  methodology: string
  overallScore: number
  criteria: QualificationCriterion[]
  recommendation: string
  generatedAt: string
}

interface InsightsTabProps {
  accountSlug: string
  accountName: string
}

export function InsightsTab({ accountSlug, accountName }: InsightsTabProps) {
  const [execSummary, setExecSummary] = useState<ExecutiveSummary | null>(null)
  const [dealReview, setDealReview] = useState<DealReview | null>(null)
  const [closedLost, setClosedLost] = useState<ClosedLostAnalysis | null>(null)
  const [qualification, setQualification] = useState<QualificationReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('exec-summary')

  useEffect(() => {
    loadInsights()
  }, [accountSlug])

  const loadInsights = async () => {
    setLoading(true)
    try {
      const [execRes, dealRes, closedRes, qualRes] = await Promise.allSettled([
        fetch(`${API_URL}/accounts/${accountSlug}/insights/exec-summary`),
        fetch(`${API_URL}/accounts/${accountSlug}/insights/deal-review`),
        fetch(`${API_URL}/accounts/${accountSlug}/insights/closed-lost`),
        fetch(`${API_URL}/accounts/${accountSlug}/insights/qualification`)
      ])

      if (execRes.status === 'fulfilled' && execRes.value.ok) {
        setExecSummary(await execRes.value.json())
      }
      if (dealRes.status === 'fulfilled' && dealRes.value.ok) {
        setDealReview(await dealRes.value.json())
      }
      if (closedRes.status === 'fulfilled' && closedRes.value.ok) {
        setClosedLost(await closedRes.value.json())
      }
      if (qualRes.status === 'fulfilled' && qualRes.value.ok) {
        setQualification(await qualRes.value.json())
      }
    } catch (error) {
      console.error('Failed to load insights:', error)
    } finally {
      setLoading(false)
    }
  }

  const regenerateInsight = async (type: string) => {
    setLoading(true)
    try {
      const agentMap: Record<string, string> = {
        'exec-summary': 'exec-summary',
        'deal-review': 'deal-review',
        'qualification': 'qualification',
        'closed-lost': 'closedlost'
      }
      
      const response = await fetch(`${API_URL}/agents/${agentMap[type]}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountName })
      })

      if (response.ok) {
        await loadInsights()
      }
    } catch (error) {
      console.error(`Failed to regenerate ${type}:`, error)
    } finally {
      setLoading(false)
    }
  }

  const exportToMarkdown = (type: string, data: any) => {
    let markdown = ''
    
    switch(type) {
      case 'exec-summary':
        markdown = formatExecSummaryMd(data)
        break
      case 'deal-review':
        markdown = formatDealReviewMd(data)
        break
      case 'closed-lost':
        markdown = formatClosedLostMd(data)
        break
      case 'qualification':
        markdown = formatQualificationMd(data)
        break
    }

    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${accountSlug}-${type}-${new Date().toISOString().split('T')[0]}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="exec-summary">
            <FileText className="h-4 w-4 mr-2" />
            Executive Summary
          </TabsTrigger>
          <TabsTrigger value="deal-review">
            <TrendingUp className="h-4 w-4 mr-2" />
            Deal Review
          </TabsTrigger>
          <TabsTrigger value="qualification">
            <Target className="h-4 w-4 mr-2" />
            Qualification
          </TabsTrigger>
          <TabsTrigger value="closed-lost">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Closed Lost
          </TabsTrigger>
        </TabsList>

        <TabsContent value="exec-summary" className="space-y-4">
          <ExecutiveSummarySection 
            data={execSummary} 
            loading={loading}
            onRegenerate={() => regenerateInsight('exec-summary')}
            onExport={() => exportToMarkdown('exec-summary', execSummary)}
          />
        </TabsContent>

        <TabsContent value="deal-review" className="space-y-4">
          <DealReviewSection 
            data={dealReview}
            loading={loading}
            onRegenerate={() => regenerateInsight('deal-review')}
            onExport={() => exportToMarkdown('deal-review', dealReview)}
          />
        </TabsContent>

        <TabsContent value="qualification" className="space-y-4">
          <QualificationSection 
            data={qualification}
            loading={loading}
            onRegenerate={() => regenerateInsight('qualification')}
            onExport={() => exportToMarkdown('qualification', qualification)}
          />
        </TabsContent>

        <TabsContent value="closed-lost" className="space-y-4">
          <ClosedLostSection 
            data={closedLost}
            loading={loading}
            onRegenerate={() => regenerateInsight('closed-lost')}
            onExport={() => exportToMarkdown('closed-lost', closedLost)}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ExecutiveSummarySection({ data, loading, onRegenerate, onExport }: {
  data: ExecutiveSummary | null
  loading: boolean
  onRegenerate: () => void
  onExport: () => void
}) {
  if (loading && !data) {
    return <div className="text-center py-8 text-muted-foreground">Loading executive summary...</div>
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Executive Summary</CardTitle>
          <CardDescription>Generate a high-level account overview</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onRegenerate} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Generate Summary
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          Generated: {new Date(data.generatedAt).toLocaleString()}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={onRegenerate} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Regenerate
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Problem Statement</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{data.problemStatement}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Solution Fit</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{data.solutionFit}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Success Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {data.successMetrics.map((metric, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span className="text-sm">{metric}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Social Proof</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {data.socialProof.map((proof, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span className="text-sm">{proof}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Next Steps</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {data.nextSteps.map((step, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="font-semibold text-primary">{idx + 1}.</span>
                <span className="text-sm">{step}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  )
}

function DealReviewSection({ data, loading, onRegenerate, onExport }: {
  data: DealReview | null
  loading: boolean
  onRegenerate: () => void
  onExport: () => void
}) {
  if (loading && !data) {
    return <div className="text-center py-8 text-muted-foreground">Loading deal review...</div>
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Deal Review</CardTitle>
          <CardDescription>Analyze deal health and strategy</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onRegenerate} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Generate Review
          </Button>
        </CardContent>
      </Card>
    )
  }

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'bg-green-500'
    if (score >= 60) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      high: 'destructive',
      medium: 'secondary',
      low: 'default'
    }
    return variants[severity] || 'default'
  }

  return (
    <>
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          Generated: {new Date(data.generatedAt).toLocaleString()}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={onRegenerate} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Regenerate
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Deal Health Score</CardTitle>
          <CardDescription>{data.status}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="text-4xl font-bold">{data.dealHealthScore}/100</div>
            <div className="flex-1">
              <div className="h-4 bg-secondary rounded-full overflow-hidden">
                <div 
                  className={`h-full ${getHealthColor(data.dealHealthScore)} transition-all`}
                  style={{ width: `${data.dealHealthScore}%` }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Strategy</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{data.strategy}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Risk Factors</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.riskFactors.map((risk, idx) => (
            <div key={idx} className="border-l-2 border-primary pl-4 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant={getSeverityBadge(risk.severity)}>
                  {risk.severity}
                </Badge>
                <span className="font-medium text-sm">{risk.factor}</span>
              </div>
              <p className="text-sm text-muted-foreground">{risk.mitigation}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Path to Close</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{data.pathToClose}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Coaching Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {data.coachingTips.map((tip, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span className="text-sm">{tip}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  )
}

function QualificationSection({ data, loading, onRegenerate, onExport }: {
  data: QualificationReport | null
  loading: boolean
  onRegenerate: () => void
  onExport: () => void
}) {
  if (loading && !data) {
    return <div className="text-center py-8 text-muted-foreground">Loading qualification...</div>
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Qualification Analysis</CardTitle>
          <CardDescription>MEDDIC or BANT scoring</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onRegenerate} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Generate Analysis
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          Generated: {new Date(data.generatedAt).toLocaleString()}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={onRegenerate} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Regenerate
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{data.methodology} Score</CardTitle>
          <CardDescription>Overall qualification</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="text-4xl font-bold">{data.overallScore}/100</div>
            <div className="flex-1">
              <div className="h-4 bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all"
                  style={{ width: `${data.overallScore}%` }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {data.criteria.map((criterion, idx) => (
          <Card key={idx}>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-base">{criterion.criterion}</CardTitle>
                <Badge variant={criterion.score >= 80 ? 'default' : criterion.score >= 60 ? 'secondary' : 'destructive'}>
                  {criterion.score}/100
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all"
                    style={{ width: `${criterion.score}%` }}
                  />
                </div>
              </div>
              
              {criterion.evidence.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2">Evidence:</div>
                  <ul className="space-y-1">
                    {criterion.evidence.map((ev, evIdx) => (
                      <li key={evIdx} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-green-500">✓</span>
                        <span>{ev}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {criterion.gaps.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2">Gaps:</div>
                  <ul className="space-y-1">
                    {criterion.gaps.map((gap, gapIdx) => (
                      <li key={gapIdx} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-red-500">✗</span>
                        <span>{gap}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recommendation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{data.recommendation}</p>
        </CardContent>
      </Card>
    </>
  )
}

function ClosedLostSection({ data, loading, onRegenerate, onExport }: {
  data: ClosedLostAnalysis | null
  loading: boolean
  onRegenerate: () => void
  onExport: () => void
}) {
  if (loading && !data) {
    return <div className="text-center py-8 text-muted-foreground">Loading closed-lost analysis...</div>
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Closed Lost Analysis</CardTitle>
          <CardDescription>No closed-lost analysis available</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This section is only applicable for lost opportunities.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          Generated: {new Date(data.generatedAt).toLocaleString()}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={onRegenerate} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Regenerate
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Loss Reason</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{data.lossReason}</p>
          {data.competitorWon && (
            <div className="mt-4">
              <Badge variant="destructive">Lost to: {data.competitorWon}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Root Causes</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {data.rootCauses.map((cause, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-red-500">✗</span>
                <span className="text-sm">{cause}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lessons Learned</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {data.lessonsLearned.map((lesson, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span className="text-sm">{lesson}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Follow-up Opportunities</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {data.followUpOpportunities.map((opp, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-green-500">→</span>
                <span className="text-sm">{opp}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  )
}

function formatExecSummaryMd(data: ExecutiveSummary): string {
  return `# Executive Summary - ${data.accountKey.name}

Generated: ${new Date(data.generatedAt).toLocaleString()}

## Problem Statement
${data.problemStatement}

## Solution Fit
${data.solutionFit}

## Success Metrics
${data.successMetrics.map(m => `- ${m}`).join('\n')}

## Social Proof
${data.socialProof.map(p => `- ${p}`).join('\n')}

## Next Steps
${data.nextSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}
`
}

function formatDealReviewMd(data: DealReview): string {
  return `# Deal Review - ${data.accountKey.name}

Generated: ${new Date(data.generatedAt).toLocaleString()}

## Deal Health Score: ${data.dealHealthScore}/100
Status: ${data.status}

## Strategy
${data.strategy}

## Risk Factors
${data.riskFactors.map(r => `### ${r.factor} (${r.severity})\n${r.mitigation}`).join('\n\n')}

## Path to Close
${data.pathToClose}

## Coaching Tips
${data.coachingTips.map(t => `- ${t}`).join('\n')}
`
}

function formatQualificationMd(data: QualificationReport): string {
  return `# ${data.methodology} Qualification - ${data.accountKey.name}

Generated: ${new Date(data.generatedAt).toLocaleString()}

## Overall Score: ${data.overallScore}/100

## Criteria Breakdown
${data.criteria.map(c => `### ${c.criterion} (${c.score}/100)

**Evidence:**
${c.evidence.map(e => `- ✓ ${e}`).join('\n')}

**Gaps:**
${c.gaps.map(g => `- ✗ ${g}`).join('\n')}
`).join('\n')}

## Recommendation
${data.recommendation}
`
}

function formatClosedLostMd(data: ClosedLostAnalysis): string {
  return `# Closed Lost Analysis - ${data.accountKey.name}

Generated: ${new Date(data.generatedAt).toLocaleString()}

## Loss Reason
${data.lossReason}
${data.competitorWon ? `\nLost to: ${data.competitorWon}` : ''}

## Root Causes
${data.rootCauses.map(c => `- ${c}`).join('\n')}

## Lessons Learned
${data.lessonsLearned.map(l => `- ${l}`).join('\n')}

## Follow-up Opportunities
${data.followUpOpportunities.map(o => `- ${o}`).join('\n')}
`
}
