'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Textarea } from './ui/textarea'
import { Input } from './ui/input'
import { Separator } from './ui/separator'
import { Copy, Send, ExternalLink, Clock, Users, Calendar } from 'lucide-react'

const API_URL = 'http://localhost:3001/api'

interface CallMetadata {
  title: string
  date: string
  duration?: number
  participants: string[]
  url?: string
}

interface Task {
  title: string
  description: string
  dueDate: string
  owner?: string
  type: 'follow-up' | 'internal' | 'customer-action'
  priority: 'high' | 'medium' | 'low'
}

interface CallAnalysis {
  nextSteps: string[]
  blockers: string[]
  stageProgressionSignals?: {
    currentStage?: string
    suggestedStage?: string
    reasoning?: string
  }
  successCriteriaMentioned: string[]
  featureRequests: string[]
  stakeholderSentiment: {
    overall: 'positive' | 'neutral' | 'negative'
    byStakeholder?: Record<string, string>
  }
  suggestedCloseDate?: {
    date: string
    reasoning: string
    confidence: 'high' | 'medium' | 'low'
  }
}

interface FollowUpEmail {
  subject: string
  body: string
  to: string[]
  cc?: string[]
}

interface PostCallUpdate {
  accountKey: { name: string }
  callId: string
  callMetadata: CallMetadata
  crmPatch: {
    yaml: string
    proposal: any
  }
  tasks: Task[]
  followUpEmail: FollowUpEmail
  analysis: CallAnalysis
  generatedAt: string
}

export function AfterCallTab({ accountSlug }: { accountSlug?: string }) {
  const [postCall, setPostCall] = useState<PostCallUpdate | null>(null)
  const [loading, setLoading] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [emailDraft, setEmailDraft] = useState({ subject: '', body: '', to: [] as string[] })

  useEffect(() => {
    if (!accountSlug) return

    // Load latest post-call update
    setLoading(true)
    fetch(`${API_URL}/accounts/${accountSlug}/postcall`)
      .then((res) => res.json())
      .then((data) => {
        setPostCall(data)
        if (data?.followUpEmail) {
          setEmailDraft({
            subject: data.followUpEmail.subject,
            body: data.followUpEmail.body,
            to: data.followUpEmail.to
          })
        }
      })
      .finally(() => setLoading(false))
  }, [accountSlug])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    alert('✅ Copied to clipboard')
  }

  const getSentimentBadge = (sentiment: string) => {
    if (sentiment === 'positive') return 'default'
    if (sentiment === 'neutral') return 'secondary'
    return 'destructive'
  }

  const getPriorityBadge = (priority: string) => {
    if (priority === 'high') return 'destructive'
    if (priority === 'medium') return 'default'
    return 'secondary'
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'Unknown'
    const minutes = Math.floor(seconds / 60)
    return `${minutes} min`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground">Loading post-call data...</p>
      </div>
    )
  }

  if (!postCall) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Post-Call Data</CardTitle>
          <CardDescription>
            Run the post-call agent after a call to generate summaries, action items, and email drafts.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Call Metadata Card */}
      <Card>
        <CardHeader>
          <CardTitle>Call Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-lg">{postCall.callMetadata.title}</h4>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{new Date(postCall.callMetadata.date).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{formatDuration(postCall.callMetadata.duration)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>{postCall.callMetadata.participants.length} participants</span>
              </div>
              {postCall.callMetadata.url && (
                <a
                  href={postCall.callMetadata.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-600 hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  View Recording
                </a>
              )}
            </div>
            {postCall.callMetadata.participants.length > 0 && (
              <div>
                <h5 className="font-medium text-sm mb-2">Participants</h5>
                <div className="flex flex-wrap gap-2">
                  {postCall.callMetadata.participants.map((p, i) => (
                    <Badge key={i} variant="outline">{p}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Post-Call Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Call Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="analysis" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="analysis">Analysis</TabsTrigger>
              <TabsTrigger value="actions">Actions</TabsTrigger>
              <TabsTrigger value="insights">Insights</TabsTrigger>
            </TabsList>

            <TabsContent value="analysis" className="space-y-4">
              {/* Sentiment */}
              <div>
                <h5 className="font-semibold mb-2">Customer Sentiment</h5>
                <Badge variant={getSentimentBadge(postCall.analysis.stakeholderSentiment.overall)}>
                  {postCall.analysis.stakeholderSentiment.overall}
                </Badge>
                {postCall.analysis.stakeholderSentiment.byStakeholder && (
                  <div className="mt-3 space-y-2">
                    {Object.entries(postCall.analysis.stakeholderSentiment.byStakeholder).map(([name, sentiment]) => (
                      <div key={name} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{name}</span>
                        <Badge variant="outline">{sentiment}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Next Steps */}
              {postCall.analysis.nextSteps.length > 0 && (
                <div>
                  <h5 className="font-semibold mb-2">Next Steps</h5>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {postCall.analysis.nextSteps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Blockers */}
              {postCall.analysis.blockers.length > 0 && (
                <div>
                  <h5 className="font-semibold mb-2 text-red-600">Blockers</h5>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {postCall.analysis.blockers.map((blocker, i) => (
                      <li key={i}>{blocker}</li>
                    ))}
                  </ul>
                </div>
              )}
            </TabsContent>

            <TabsContent value="actions" className="space-y-4">
              {/* Tasks */}
              {postCall.tasks.length > 0 ? (
                <div className="space-y-3">
                  {postCall.tasks.map((task, i) => (
                    <div key={i} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h5 className="font-semibold">{task.title}</h5>
                        <Badge variant={getPriorityBadge(task.priority)}>{task.priority}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                        {task.owner && <span>Owner: {task.owner}</span>}
                        <Badge variant="outline" className="text-xs">{task.type}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No action items identified.</p>
              )}
            </TabsContent>

            <TabsContent value="insights" className="space-y-4">
              {/* Success Criteria */}
              {postCall.analysis.successCriteriaMentioned.length > 0 && (
                <div>
                  <h5 className="font-semibold mb-2">Success Criteria Mentioned</h5>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {postCall.analysis.successCriteriaMentioned.map((criteria, i) => (
                      <li key={i}>{criteria}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Feature Requests */}
              {postCall.analysis.featureRequests.length > 0 && (
                <div>
                  <h5 className="font-semibold mb-2">Feature Requests</h5>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {postCall.analysis.featureRequests.map((feature, i) => (
                      <li key={i}>{feature}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Stage Progression */}
              {postCall.analysis.stageProgressionSignals && (
                <div>
                  <h5 className="font-semibold mb-2">Stage Progression</h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Current:</span>
                      <Badge variant="outline">{postCall.analysis.stageProgressionSignals.currentStage}</Badge>
                    </div>
                    {postCall.analysis.stageProgressionSignals.suggestedStage && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Suggested:</span>
                        <Badge variant="default">{postCall.analysis.stageProgressionSignals.suggestedStage}</Badge>
                      </div>
                    )}
                    {postCall.analysis.stageProgressionSignals.reasoning && (
                      <p className="text-muted-foreground italic">{postCall.analysis.stageProgressionSignals.reasoning}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Close Date */}
              {postCall.analysis.suggestedCloseDate && (
                <div>
                  <h5 className="font-semibold mb-2">Suggested Close Date</h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Date:</span>
                      <span className="font-medium">{new Date(postCall.analysis.suggestedCloseDate.date).toLocaleDateString()}</span>
                      <Badge variant="outline">{postCall.analysis.suggestedCloseDate.confidence} confidence</Badge>
                    </div>
                    <p className="text-muted-foreground italic">{postCall.analysis.suggestedCloseDate.reasoning}</p>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Follow-up Email */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Follow-up Email Draft</CardTitle>
              <CardDescription>Review and edit before sending</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditMode(!editMode)}
            >
              {editMode ? 'Preview' : 'Edit'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {editMode ? (
            <>
              <div>
                <label className="text-sm font-medium mb-1 block">To</label>
                <Input
                  value={emailDraft.to.join(', ')}
                  onChange={(e) => setEmailDraft({ ...emailDraft, to: e.target.value.split(',').map(s => s.trim()) })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Subject</label>
                <Input
                  value={emailDraft.subject}
                  onChange={(e) => setEmailDraft({ ...emailDraft, subject: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Body</label>
                <Textarea
                  value={emailDraft.body}
                  onChange={(e) => setEmailDraft({ ...emailDraft, body: e.target.value })}
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <span className="text-sm font-medium text-muted-foreground">To: </span>
                <span className="text-sm">{emailDraft.to.join(', ')}</span>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">Subject: </span>
                <span className="text-sm font-semibold">{emailDraft.subject}</span>
              </div>
              <Separator />
              <div className="whitespace-pre-wrap text-sm font-mono bg-muted p-4 rounded-lg">
                {emailDraft.body}
              </div>
            </>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(`To: ${emailDraft.to.join(', ')}\nSubject: ${emailDraft.subject}\n\n${emailDraft.body}`)}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </Button>
            <Button size="sm" disabled>
              <Send className="h-4 w-4 mr-2" />
              Send (Coming Soon)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Coaching Feedback */}
      <Card>
        <CardHeader>
          <CardTitle>Coaching Feedback</CardTitle>
          <CardDescription>AI-powered insights to improve your next call</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h5 className="font-semibold mb-2 text-green-600">What Went Well</h5>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Effectively uncovered key decision criteria and success metrics</li>
              <li>Built rapport with multiple stakeholders</li>
              <li>Captured clear next steps and action items</li>
            </ul>
          </div>

          <Separator />

          <div>
            <h5 className="font-semibold mb-2 text-orange-600">Areas for Improvement</h5>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Could have dug deeper into budget and timeline constraints</li>
              <li>Missed opportunity to identify potential champion</li>
              <li>Consider asking about competing solutions earlier in discovery</li>
            </ul>
          </div>

          <Separator />

          <div>
            <h5 className="font-semibold mb-2">Suggested Next Steps</h5>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Schedule follow-up with economic buyer to discuss ROI</li>
              <li>Share case study from similar customer in same industry</li>
              <li>Prepare technical deep-dive for engineering stakeholders</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* CRM Updates Preview */}
      {postCall.crmPatch && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>CRM Updates</CardTitle>
                <CardDescription>Proposed changes to Salesforce</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => copyToClipboard(postCall.crmPatch.yaml)}>
                <Copy className="h-4 w-4 mr-2" />
                Copy YAML
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto">
              {postCall.crmPatch.yaml}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
