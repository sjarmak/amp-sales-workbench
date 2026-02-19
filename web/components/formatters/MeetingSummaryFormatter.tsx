'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Target,
  Users,
  MessageSquare,
  CheckSquare,
  TrendingUp,
  Calendar,
  User
} from 'lucide-react'
import { useState } from 'react'

interface MeetingSummaryFormatterProps {
  data: {
    meetingInfo: {
      date: string
      duration: string
      type: string
      participants: Array<{ name: string; company: string; role: string }>
    }
    objectives: Array<{ objective: string; achieved: boolean; notes: string }>
    discussion: Array<{
      topic: string
      summary: string
      customerPosition: string
      ourResponse: string
      outcome: string
    }>
    keyQuotes: Array<{ quote: string; speaker: string; significance: string }>
    blockers: Array<{ blocker: string; owner: string; severity: string; proposedResolution: string }>
    decisions: Array<{ decision: string; rationale: string; owner: string }>
    nextSteps: Array<{ action: string; owner: string; dueDate: string; dependencies: string[] }>
    sentimentIndicators: {
      overall: string
      engagement: string
      concerns: string[]
      enthusiasm: string[]
    }
    followUpRequired: { date: string; type: string; agenda: string[] }
  }
}

function getMeetingTypeColor(type: string): string {
  const colors: Record<string, string> = {
    discovery: 'bg-blue-100 text-blue-800',
    demo: 'bg-purple-100 text-purple-800',
    technical: 'bg-green-100 text-green-800',
    negotiation: 'bg-orange-100 text-orange-800',
    kickoff: 'bg-indigo-100 text-indigo-800',
    check_in: 'bg-gray-100 text-gray-800',
  }
  return colors[type] || 'bg-gray-100 text-gray-800'
}

function getSentimentColor(sentiment: string): string {
  const colors: Record<string, string> = {
    positive: 'bg-green-100 text-green-800',
    neutral: 'bg-gray-100 text-gray-800',
    negative: 'bg-red-100 text-red-800',
    mixed: 'bg-yellow-100 text-yellow-800',
  }
  return colors[sentiment] || 'bg-gray-100 text-gray-800'
}

function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    high: 'bg-red-100 text-red-800 border-red-300',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    low: 'bg-green-100 text-green-800 border-green-300',
  }
  return colors[severity] || 'bg-gray-100 text-gray-800 border-gray-300'
}

export function MeetingSummaryFormatter({ data }: MeetingSummaryFormatterProps) {
  const [expandedDiscussion, setExpandedDiscussion] = useState<number | null>(null)

  return (
    <div className="space-y-6">
      {/* Meeting Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">Meeting Summary</CardTitle>
              <CardDescription>
                {data.meetingInfo.date && `${data.meetingInfo.date}`}
                {data.meetingInfo.duration && ` • ${data.meetingInfo.duration}`}
              </CardDescription>
            </div>
            <Badge className={`${getMeetingTypeColor(data.meetingInfo.type)} capitalize`}>
              {data.meetingInfo.type.replace('_', ' ')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.meetingInfo.participants.length > 0 && (
            <div>
              <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Participants
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {data.meetingInfo.participants.map((p, i) => (
                  <div key={i} className="text-sm border rounded p-2">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.role} {p.company !== 'sourcegraph' ? '(Customer)' : '(Sourcegraph)'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sentiment Indicators */}
      {data.sentimentIndicators && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Sentiment & Engagement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Overall Sentiment</span>
              <Badge className={`capitalize ${getSentimentColor(data.sentimentIndicators.overall)}`}>
                {data.sentimentIndicators.overall}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Engagement Level</span>
              <Badge variant="outline" className="capitalize">
                {data.sentimentIndicators.engagement}
              </Badge>
            </div>
            {data.sentimentIndicators.enthusiasm.length > 0 && (
              <div>
                <span className="text-sm font-medium block mb-2">Enthusiasm Topics</span>
                <div className="flex flex-wrap gap-1">
                  {data.sentimentIndicators.enthusiasm.map((e, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {e}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {data.sentimentIndicators.concerns.length > 0 && (
              <div>
                <span className="text-sm font-medium block mb-2 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  Expressed Concerns
                </span>
                <div className="flex flex-wrap gap-1">
                  {data.sentimentIndicators.concerns.map((c, i) => (
                    <Badge key={i} variant="destructive" className="text-xs">
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Objectives */}
      {data.objectives.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Meeting Objectives
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.objectives.map((obj, i) => (
              <div key={i} className="flex items-start gap-3 p-2 border rounded">
                <div className={`mt-0.5 ${obj.achieved ? 'text-green-600' : 'text-gray-400'}`}>
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className={`text-sm font-medium ${obj.achieved ? 'text-foreground' : 'text-muted-foreground line-through'}`}>
                    {obj.objective}
                  </div>
                  {obj.notes && <div className="text-xs text-muted-foreground mt-1">{obj.notes}</div>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Key Discussions */}
      {data.discussion.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Key Discussion Topics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.discussion.map((d, i) => (
              <div key={i} className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedDiscussion(expandedDiscussion === i ? null : i)}
                  className="w-full p-3 text-left hover:bg-muted/50 transition-colors flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium text-sm">{d.topic}</div>
                    <div className="text-xs text-muted-foreground mt-1">{d.summary.substring(0, 80)}...</div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {expandedDiscussion === i ? '−' : '+'}
                  </div>
                </button>
                {expandedDiscussion === i && (
                  <div className="bg-muted/30 p-3 border-t space-y-2 text-sm">
                    <div>
                      <span className="font-medium text-xs uppercase tracking-wide">Summary</span>
                      <p className="text-muted-foreground">{d.summary}</p>
                    </div>
                    <div>
                      <span className="font-medium text-xs uppercase tracking-wide">Customer Position</span>
                      <p className="text-muted-foreground">{d.customerPosition}</p>
                    </div>
                    <div>
                      <span className="font-medium text-xs uppercase tracking-wide">Our Response</span>
                      <p className="text-muted-foreground">{d.ourResponse}</p>
                    </div>
                    <div>
                      <span className="font-medium text-xs uppercase tracking-wide">Outcome</span>
                      <p className="text-muted-foreground">{d.outcome}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Key Quotes */}
      {data.keyQuotes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Key Quotes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.keyQuotes.map((q, i) => (
              <div key={i} className="bg-muted/40 p-3 rounded border-l-4 border-primary">
                <p className="text-sm italic mb-2">"{q.quote}"</p>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium">— {q.speaker}</span>
                  <span className="text-xs text-muted-foreground">{q.significance}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Blockers */}
      {data.blockers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Blockers & Issues
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.blockers.map((b, i) => (
              <div key={i} className={`border rounded p-3 ${getSeverityColor(b.severity)}`}>
                <div className="font-medium text-sm mb-1">{b.blocker}</div>
                <div className="text-xs space-y-1">
                  <div>
                    <span className="font-medium">Owner:</span> {b.owner}
                  </div>
                  <div>
                    <span className="font-medium">Proposed Resolution:</span> {b.proposedResolution}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Decisions */}
      {data.decisions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Decisions Made
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.decisions.map((d, i) => (
              <div key={i} className="border rounded p-3">
                <div className="font-medium text-sm mb-1">{d.decision}</div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>
                    <span className="font-medium">Rationale:</span> {d.rationale}
                  </div>
                  <div>
                    <span className="font-medium">Owner:</span> {d.owner}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Next Steps */}
      {data.nextSteps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              Next Steps & Action Items
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.nextSteps.map((step, i) => (
              <div key={i} className="border rounded p-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{step.action}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {step.owner}
                      </div>
                      {step.dueDate && (
                        <div className="flex items-center gap-1 mt-1">
                          <Calendar className="h-3 w-3" />
                          {step.dueDate}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {step.dependencies.length > 0 && (
                  <div className="mt-2 pt-2 border-t text-xs">
                    <span className="font-medium">Dependencies:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {step.dependencies.map((dep, j) => (
                        <Badge key={j} variant="outline" className="text-xs">
                          {dep}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Follow-up Recommendation */}
      {data.followUpRequired && data.followUpRequired.date && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <Clock className="h-5 w-5" />
              Recommended Follow-up
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <span className="text-sm font-medium">Type:</span>{' '}
              <span className="text-sm text-muted-foreground capitalize">{data.followUpRequired.type.replace('_', ' ')}</span>
            </div>
            <div>
              <span className="text-sm font-medium">Suggested Date:</span>{' '}
              <span className="text-sm text-muted-foreground">{data.followUpRequired.date}</span>
            </div>
            {data.followUpRequired.agenda.length > 0 && (
              <div>
                <span className="text-sm font-medium block mb-2">Suggested Agenda</span>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  {data.followUpRequired.agenda.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
