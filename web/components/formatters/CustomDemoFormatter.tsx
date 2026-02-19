'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import {
  Play,
  Clock,
  Users,
  Target,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
} from 'lucide-react'
import { useState } from 'react'

interface DemoSegment {
  title: string
  duration: string
  objectives: string[]
  script?: string
  talking_points?: string[]
  visuals?: string[]
  interaction?: string
  transition?: string
}

interface CustomDemoFormatterProps {
  data: {
    overview?: string
    targetAudience?: string[]
    keyMessages?: string[]
    demoLength?: string
    segments?: DemoSegment[]
    successCriteria?: string[]
    risks?: Array<{ risk: string; mitigation: string }>
    talkingPoints?: string[]
    competitiveAdvantages?: string[]
    [key: string]: any
  }
}

export function CustomDemoFormatter({ data }: CustomDemoFormatterProps) {
  const [expandedSegment, setExpandedSegment] = useState<number | null>(0)

  return (
    <div className="space-y-6">
      {/* Overview */}
      {data.overview && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              Demo Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{data.overview}</p>
            {data.demoLength && (
              <div className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Total Duration: {data.demoLength}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Target Audience */}
      {data.targetAudience && data.targetAudience.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="h-5 w-5" />
              Target Audience
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.targetAudience.map((audience, i) => (
                <Badge key={i} variant="secondary">
                  {audience}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Messages */}
      {data.keyMessages && data.keyMessages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Lightbulb className="h-5 w-5" />
              Key Messages
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.keyMessages.map((msg, i) => (
              <div key={i} className="flex gap-2">
                <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold">{i + 1}</span>
                </div>
                <p className="text-sm">{msg}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Demo Segments */}
      {data.segments && data.segments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              Demo Script ({data.segments.length} segments)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.segments.map((segment, i) => (
              <div key={i} className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedSegment(expandedSegment === i ? null : i)}
                  className="w-full p-3 text-left hover:bg-muted/50 transition-colors flex items-center justify-between group"
                >
                  <div>
                    <div className="font-medium text-sm group-hover:text-primary transition-colors">
                      {i + 1}. {segment.title}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {segment.duration}
                      </span>
                      {segment.objectives && (
                        <span>{segment.objectives.length} objectives</span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {expandedSegment === i ? '−' : '+'}
                  </div>
                </button>

                {expandedSegment === i && (
                  <div className="bg-muted/30 p-4 border-t space-y-3">
                    {/* Objectives */}
                    {segment.objectives && segment.objectives.length > 0 && (
                      <div>
                        <h5 className="text-xs font-medium uppercase tracking-wide mb-2">Objectives</h5>
                        <ul className="space-y-1">
                          {segment.objectives.map((obj, j) => (
                            <li key={j} className="text-sm text-muted-foreground flex gap-2">
                              <span className="text-primary">•</span>
                              {obj}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Script */}
                    {segment.script && (
                      <div className="bg-foreground/5 p-2 rounded">
                        <h5 className="text-xs font-medium uppercase tracking-wide mb-2">Script</h5>
                        <p className="text-sm whitespace-pre-wrap">{segment.script}</p>
                      </div>
                    )}

                    {/* Talking Points */}
                    {segment.talking_points && segment.talking_points.length > 0 && (
                      <div>
                        <h5 className="text-xs font-medium uppercase tracking-wide mb-2">Talking Points</h5>
                        <ul className="space-y-1">
                          {segment.talking_points.map((point, j) => (
                            <li key={j} className="text-sm text-muted-foreground flex gap-2">
                              <span className="text-primary">✓</span>
                              {point}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Visuals */}
                    {segment.visuals && segment.visuals.length > 0 && (
                      <div>
                        <h5 className="text-xs font-medium uppercase tracking-wide mb-2">Visuals to Show</h5>
                        <ul className="space-y-1">
                          {segment.visuals.map((visual, j) => (
                            <li key={j} className="text-sm text-muted-foreground flex gap-2">
                              <span className="text-primary">▶</span>
                              {visual}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Interaction */}
                    {segment.interaction && (
                      <div>
                        <h5 className="text-xs font-medium uppercase tracking-wide mb-2">Customer Interaction</h5>
                        <p className="text-sm text-muted-foreground">{segment.interaction}</p>
                      </div>
                    )}

                    {/* Transition */}
                    {segment.transition && (
                      <div className="border-t pt-2">
                        <h5 className="text-xs font-medium uppercase tracking-wide mb-1">Transition</h5>
                        <p className="text-sm italic text-muted-foreground">"{segment.transition}"</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Competitive Advantages */}
      {data.competitiveAdvantages && data.competitiveAdvantages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Competitive Advantages to Highlight</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.competitiveAdvantages.map((adv, i) => (
              <div key={i} className="p-2 border rounded bg-green-50 text-sm">
                {adv}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Talking Points */}
      {data.talkingPoints && data.talkingPoints.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Key Talking Points</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.talkingPoints.map((point, i) => (
                <li key={i} className="text-sm flex gap-2">
                  <span className="text-primary font-bold">•</span>
                  {point}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Success Criteria */}
      {data.successCriteria && data.successCriteria.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-5 w-5" />
              Success Criteria
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.successCriteria.map((criteria, i) => (
              <div key={i} className="p-2 border rounded text-sm flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                {criteria}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Risks */}
      {data.risks && data.risks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600 text-sm">
              <AlertTriangle className="h-5 w-5" />
              Potential Risks & Mitigations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.risks.map((r, i) => (
              <div key={i} className="border border-red-200 rounded p-3">
                <div className="font-medium text-sm text-red-900">{r.risk}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  <span className="font-medium">Mitigation:</span> {r.mitigation}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
