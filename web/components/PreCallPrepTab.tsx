'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'

const API_URL = 'http://localhost:3001/api'

interface WhosWho {
  name: string
  role?: string
  title?: string
  decisionPower?: 'high' | 'medium' | 'low' | 'unknown'
  orgChartHints?: string
  recentInteractions?: string
}

interface DemoFocus {
  feature: string
  reason: string
  painPoints?: string[]
}

interface CompetitiveIntel {
  competitor: string
  mentions: string[]
  sentiment?: string
  context?: string
}

interface CustomIdea {
  idea: string
  reasoning: string
  evidence: string[]
}

interface KeyQuestions {
  meddic: {
    metrics?: string[]
    economicBuyer?: string[]
    decisionCriteria?: string[]
    decisionProcess?: string[]
    identifyPain?: string[]
    champion?: string[]
  }
  blockers?: string[]
  successCriteria?: string[]
}

interface PreCallBrief {
  accountKey: { name: string }
  meetingDate?: string
  generatedAt: string
  sections: {
    whosWho: WhosWho[]
    recentActivity: {
      lastCallsSummary?: string
      emailTopics?: string[]
      tasksCompleted?: string[]
      lastInteractionDate?: string
    }
    predictedAgenda: string[]
    keyQuestions: KeyQuestions
    demoFocusAreas: DemoFocus[]
    competitiveLandscape: CompetitiveIntel[]
    customIdeas: CustomIdea[]
  }
  dataAvailability: {
    hasSnapshot: boolean
    hasGongCalls: boolean
    hasNotionPages: boolean
    gongCallCount?: number
    notionPageCount?: number
    snapshotAge?: string
  }
}

export function PreCallPrepTab({ accountSlug }: { accountSlug?: string }) {
  const [brief, setBrief] = useState<PreCallBrief | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!accountSlug) return

    setLoading(true)
    fetch(`${API_URL}/accounts/${accountSlug}/briefs`)
      .then((res) => res.json())
      .then((data) => setBrief(data))
      .finally(() => setLoading(false))
  }, [accountSlug])

  if (loading) {
    return <Card><CardContent className="py-8">Loading pre-call brief...</CardContent></Card>
  }

  if (!brief) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pre-Call Prep</CardTitle>
          <CardDescription>No brief available. Click "Pre-Call Brief" in Quick Actions to generate one.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const getPowerBadgeVariant = (power?: string) => {
    if (power === 'high') return 'default'
    if (power === 'medium') return 'secondary'
    return 'outline'
  }

  return (
    <div className="space-y-6">
      {/* Who's Who */}
      <Card>
        <CardHeader>
          <CardTitle>Who's Who</CardTitle>
          <CardDescription>Key stakeholders and decision makers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {brief.sections.whosWho.map((person, i) => (
              <div key={i} className="border-b pb-4 last:border-0">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold">{person.name}</h4>
                    <p className="text-sm text-muted-foreground">{person.title}</p>
                  </div>
                  <Badge variant={getPowerBadgeVariant(person.decisionPower)}>
                    {person.decisionPower || 'unknown'}
                  </Badge>
                </div>
                {person.role && (
                  <p className="text-sm font-medium text-blue-600 mb-1">{person.role}</p>
                )}
                {person.orgChartHints && (
                  <p className="text-sm text-muted-foreground mb-1">{person.orgChartHints}</p>
                )}
                {person.recentInteractions && (
                  <p className="text-sm text-muted-foreground italic">{person.recentInteractions}</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {brief.sections.recentActivity.lastCallsSummary && (
            <div>
              <h5 className="font-medium mb-1">Recent Calls</h5>
              <p className="text-sm text-muted-foreground">{brief.sections.recentActivity.lastCallsSummary}</p>
            </div>
          )}
          {brief.sections.recentActivity.tasksCompleted && brief.sections.recentActivity.tasksCompleted.length > 0 && (
            <div>
              <h5 className="font-medium mb-1">Tasks Completed</h5>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                {brief.sections.recentActivity.tasksCompleted.map((task, i) => (
                  <li key={i}>{task}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Predicted Agenda */}
      <Card>
        <CardHeader>
          <CardTitle>Predicted Agenda</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2">
            {brief.sections.predictedAgenda.map((item, i) => (
              <li key={i} className="text-sm">{item}</li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Key Questions (MEDDIC) */}
      <Card>
        <CardHeader>
          <CardTitle>Key Questions (MEDDIC)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {brief.sections.keyQuestions.meddic.metrics && brief.sections.keyQuestions.meddic.metrics.length > 0 && (
            <div>
              <h5 className="font-semibold mb-2">Metrics</h5>
              <ul className="list-disc list-inside text-sm space-y-1">
                {brief.sections.keyQuestions.meddic.metrics.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}
          {brief.sections.keyQuestions.meddic.economicBuyer && brief.sections.keyQuestions.meddic.economicBuyer.length > 0 && (
            <div>
              <h5 className="font-semibold mb-2">Economic Buyer</h5>
              <ul className="list-disc list-inside text-sm space-y-1">
                {brief.sections.keyQuestions.meddic.economicBuyer.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}
          {brief.sections.keyQuestions.meddic.decisionCriteria && brief.sections.keyQuestions.meddic.decisionCriteria.length > 0 && (
            <div>
              <h5 className="font-semibold mb-2">Decision Criteria</h5>
              <ul className="list-disc list-inside text-sm space-y-1">
                {brief.sections.keyQuestions.meddic.decisionCriteria.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}
          {brief.sections.keyQuestions.meddic.identifyPain && brief.sections.keyQuestions.meddic.identifyPain.length > 0 && (
            <div>
              <h5 className="font-semibold mb-2">Identify Pain</h5>
              <ul className="list-disc list-inside text-sm space-y-1">
                {brief.sections.keyQuestions.meddic.identifyPain.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}
          {brief.sections.keyQuestions.meddic.champion && brief.sections.keyQuestions.meddic.champion.length > 0 && (
            <div>
              <h5 className="font-semibold mb-2">Champion</h5>
              <ul className="list-disc list-inside text-sm space-y-1">
                {brief.sections.keyQuestions.meddic.champion.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Demo Focus Areas */}
      {brief.sections.demoFocusAreas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Demo Focus Areas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {brief.sections.demoFocusAreas.map((demo, i) => (
                <div key={i} className="border-b pb-4 last:border-0">
                  <h5 className="font-semibold mb-1">{demo.feature}</h5>
                  <p className="text-sm text-muted-foreground mb-2">{demo.reason}</p>
                  {demo.painPoints && demo.painPoints.length > 0 && (
                    <ul className="list-disc list-inside text-sm text-muted-foreground">
                      {demo.painPoints.map((pain, j) => (
                        <li key={j}>{pain}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Custom Ideas */}
      {brief.sections.customIdeas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Custom Ideas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {brief.sections.customIdeas.map((idea, i) => (
                <div key={i} className="border-b pb-4 last:border-0">
                  <h5 className="font-semibold mb-1">{idea.idea}</h5>
                  <p className="text-sm text-muted-foreground mb-2">{idea.reasoning}</p>
                  {idea.evidence.length > 0 && (
                    <div>
                      <p className="text-xs font-medium mb-1">Evidence:</p>
                      <ul className="list-disc list-inside text-xs text-muted-foreground">
                        {idea.evidence.map((ev, j) => (
                          <li key={j}>{ev}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
