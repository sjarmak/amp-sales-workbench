'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import {
  AlertTriangle,
  CheckCircle2,
  Target,
  Users,
  Clock,
  FileText,
  Zap,
  MessageSquare,
  Calendar,
} from 'lucide-react'

interface PostCallUpdateFormatterProps {
  data: {
    summary?: {
      callType?: string
      duration?: string
      attendees?: string[]
      headline?: string
    }
    keyTakeaways?: Array<{
      takeaway: string
      importance: 'high' | 'medium' | 'low'
      category: 'pain' | 'requirement' | 'objection' | 'positive_signal' | 'next_step'
    }>
    newInformation?: {
      painPoints?: string[]
      requirements?: string[]
      stakeholders?: string[]
      timeline?: string
      budget?: string
      competition?: string
    }
    actionItems?: Array<{
      action: string
      owner: 'us' | 'customer'
      assignee?: string
      dueDate?: string
      priority: 'high' | 'medium' | 'low'
      notes?: string
    }>
    crmUpdates?: {
      opportunity?: Record<string, any>
      contacts?: Array<{
        name: string
        updates: Record<string, string>
      }>
    }
    followUp?: {
      date: string
      type: 'email' | 'call' | 'meeting'
      purpose: string
      preparation?: string[]
    }
    risks?: string[]
    coachingNotes?: string[]
  }
}

function getImportanceColor(importance: string): string {
  const colors: Record<string, string> = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-green-100 text-green-800',
  }
  return colors[importance?.toLowerCase()] || 'bg-gray-100 text-gray-800'
}

function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-green-100 text-green-800',
  }
  return colors[priority?.toLowerCase()] || 'bg-gray-100 text-gray-800'
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    pain: 'bg-red-50 text-red-700 border-red-200',
    requirement: 'bg-blue-50 text-blue-700 border-blue-200',
    objection: 'bg-orange-50 text-orange-700 border-orange-200',
    positive_signal: 'bg-green-50 text-green-700 border-green-200',
    next_step: 'bg-purple-50 text-purple-700 border-purple-200',
  }
  return colors[category?.toLowerCase()] || 'bg-gray-50 text-gray-700 border-gray-200'
}

function getCategoryIcon(category: string) {
  switch (category?.toLowerCase()) {
    case 'pain':
      return <AlertTriangle className="h-4 w-4" />
    case 'requirement':
      return <Target className="h-4 w-4" />
    case 'objection':
      return <MessageSquare className="h-4 w-4" />
    case 'positive_signal':
      return <CheckCircle2 className="h-4 w-4" />
    case 'next_step':
      return <Clock className="h-4 w-4" />
    default:
      return null
  }
}

function getCallTypeLabel(callType: string): string {
  const labels: Record<string, string> = {
    discovery: 'Discovery Call',
    demo: 'Demo',
    technical: 'Technical Discussion',
    negotiation: 'Negotiation',
    check_in: 'Check-in',
  }
  return labels[callType?.toLowerCase()] || callType || 'Call'
}

export function PostCallUpdateFormatter({ data }: PostCallUpdateFormatterProps) {
  return (
    <div className="space-y-6">
      {/* Call Summary */}
      {data.summary && (
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Call Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              {data.summary.callType && (
                <div>
                  <div className="text-xs text-muted-foreground font-medium uppercase mb-1">Type</div>
                  <Badge variant="secondary">{getCallTypeLabel(data.summary.callType)}</Badge>
                </div>
              )}
              {data.summary.duration && (
                <div>
                  <div className="text-xs text-muted-foreground font-medium uppercase mb-1">Duration</div>
                  <div className="font-medium">{data.summary.duration}</div>
                </div>
              )}
            </div>
            {data.summary.attendees && data.summary.attendees.length > 0 && (
              <div>
                <div className="text-xs text-muted-foreground font-medium uppercase mb-2">Attendees</div>
                <div className="flex flex-wrap gap-2">
                  {data.summary.attendees.map((attendee, i) => (
                    <Badge key={i} variant="outline">{attendee}</Badge>
                  ))}
                </div>
              </div>
            )}
            {data.summary.headline && (
              <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
                <div className="text-sm font-medium text-blue-900">{data.summary.headline}</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Key Takeaways */}
      {data.keyTakeaways && data.keyTakeaways.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Key Takeaways
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.keyTakeaways.map((item, i) => (
              <div
                key={i}
                className={`p-3 rounded border border-l-4 ${getCategoryColor(item.category)}`}
              >
                <div className="flex items-start gap-2 mb-1">
                  <div className="flex-shrink-0 mt-0.5 text-muted-foreground">
                    {getCategoryIcon(item.category)}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{item.takeaway}</div>
                  </div>
                  <Badge className={getImportanceColor(item.importance)} variant="secondary">
                    {item.importance}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* New Information */}
      {data.newInformation && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              New Information Discovered
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.newInformation.painPoints && data.newInformation.painPoints.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  Pain Points
                </h4>
                <div className="space-y-1">
                  {data.newInformation.painPoints.map((point, i) => (
                    <div key={i} className="text-sm p-2 bg-red-50 rounded border border-red-200">
                      {point}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.newInformation.requirements && data.newInformation.requirements.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-600" />
                  Requirements
                </h4>
                <div className="space-y-1">
                  {data.newInformation.requirements.map((req, i) => (
                    <div key={i} className="text-sm p-2 bg-blue-50 rounded border border-blue-200">
                      {req}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.newInformation.stakeholders && data.newInformation.stakeholders.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-600" />
                  New Stakeholders
                </h4>
                <div className="space-y-1">
                  {data.newInformation.stakeholders.map((stakeholder, i) => (
                    <div key={i} className="text-sm p-2 bg-purple-50 rounded border border-purple-200">
                      {stakeholder}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 text-sm mt-4">
              {data.newInformation.timeline && (
                <div className="p-2 bg-muted rounded">
                  <div className="font-medium mb-1">Timeline</div>
                  <div className="text-muted-foreground">{data.newInformation.timeline}</div>
                </div>
              )}
              {data.newInformation.budget && (
                <div className="p-2 bg-muted rounded">
                  <div className="font-medium mb-1">Budget</div>
                  <div className="text-muted-foreground">{data.newInformation.budget}</div>
                </div>
              )}
              {data.newInformation.competition && (
                <div className="p-2 bg-muted rounded">
                  <div className="font-medium mb-1">Competition</div>
                  <div className="text-muted-foreground">{data.newInformation.competition}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Items */}
      {data.actionItems && data.actionItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Action Items ({data.actionItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.actionItems.map((item, i) => (
              <div key={i} className="p-3 border rounded hover:bg-muted/30 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{item.action}</div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                      <Badge className={getPriorityColor(item.priority)} variant="secondary">
                        {item.priority} priority
                      </Badge>
                      <Badge variant="outline">
                        {item.owner === 'us' ? 'Our Team' : 'Customer'}
                      </Badge>
                      {item.assignee && <Badge variant="secondary">{item.assignee}</Badge>}
                      {item.dueDate && <span>Due: {item.dueDate}</span>}
                    </div>
                    {item.notes && <div className="text-xs text-muted-foreground mt-2 italic">{item.notes}</div>}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* CRM Updates */}
      {data.crmUpdates && (data.crmUpdates.opportunity || data.crmUpdates.contacts) && (
        <Card className="bg-amber-50 border-amber-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <Target className="h-5 w-5" />
              Proposed CRM Updates
            </CardTitle>
            <CardDescription className="text-amber-700">
              These updates are ready to be applied to Salesforce
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.crmUpdates.opportunity && Object.keys(data.crmUpdates.opportunity).length > 0 && (
              <div className="border rounded p-3 bg-white">
                <h4 className="font-medium text-sm mb-2">Opportunity Updates</h4>
                <div className="space-y-1 text-sm">
                  {Object.entries(data.crmUpdates.opportunity).map(([field, value]) => (
                    <div key={field} className="flex justify-between">
                      <span className="text-muted-foreground font-medium">{field}:</span>
                      <span className="font-mono">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.crmUpdates.contacts && data.crmUpdates.contacts.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Contact Updates</h4>
                {data.crmUpdates.contacts.map((contact, i) => (
                  <div key={i} className="border rounded p-3 bg-white">
                    <div className="font-medium text-sm mb-2">{contact.name}</div>
                    <div className="space-y-1 text-sm">
                      {Object.entries(contact.updates).map(([field, value]) => (
                        <div key={field} className="flex justify-between">
                          <span className="text-muted-foreground font-medium">{field}:</span>
                          <span className="font-mono">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Follow-Up */}
      {data.followUp && (
        <Card className="border-l-4 border-l-green-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Recommended Follow-Up
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs text-muted-foreground font-medium uppercase mb-1">Date</div>
                <div className="font-medium">{data.followUp.date}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground font-medium uppercase mb-1">Type</div>
                <Badge variant="secondary" className="capitalize">{data.followUp.type}</Badge>
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase mb-2">Purpose</div>
              <p className="text-sm">{data.followUp.purpose}</p>
            </div>
            {data.followUp.preparation && data.followUp.preparation.length > 0 && (
              <div>
                <div className="text-xs text-muted-foreground font-medium uppercase mb-2">Preparation</div>
                <ul className="text-sm space-y-1">
                  {data.followUp.preparation.map((item, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="text-green-600">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Risks */}
      {data.risks && data.risks.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Identified Risks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.risks.map((risk, i) => (
                <div key={i} className="text-sm p-2 bg-red-50 border border-red-200 rounded">
                  {risk}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Coaching Notes */}
      {data.coachingNotes && data.coachingNotes.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-base">Coaching Feedback</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.coachingNotes.map((note, i) => (
                <div key={i} className="text-sm p-2 bg-white rounded border border-blue-100">
                  {note}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
