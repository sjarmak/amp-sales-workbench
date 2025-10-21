'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Database, PhoneCall, FileText, Loader2, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'

const API_URL = 'http://localhost:3001/api'

interface DataSourcesTabProps {
  accountSlug: string | undefined
}

export function DataSourcesTab({ accountSlug }: DataSourcesTabProps) {
  const [salesforceData, setSalesforceData] = useState<any>(null)
  const [gongData, setGongData] = useState<any>(null)
  const [notionData, setNotionData] = useState<any>(null)
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [expandedTranscripts, setExpandedTranscripts] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (accountSlug) {
      loadAllSources()
    }
  }, [accountSlug])

  const loadAllSources = () => {
    loadSource('salesforce', setSalesforceData)
    loadSource('gong', setGongData)
    loadSource('notion', setNotionData)
  }

  const loadSource = async (source: string, setter: (data: any) => void) => {
    if (!accountSlug) return
    
    setLoading(prev => ({ ...prev, [source]: true }))
    try {
      console.log(`[DataSourcesTab] Loading ${source} for account: ${accountSlug}`)
      const res = await fetch(`${API_URL}/accounts/${accountSlug}/sources/${source}`)
      console.log(`[DataSourcesTab] ${source} response status:`, res.status)
      if (res.ok) {
        const data = await res.json()
        console.log(`[DataSourcesTab] ${source} data:`, { 
          callsCount: data.callsCount, 
          summariesCount: data.summaries?.length,
          firstCall: data.calls?.[0],
          firstSummary: data.summaries?.[0] ? {
            callId: data.summaries[0].callId,
            hasTranscript: !!data.summaries[0].transcript,
            hasTopics: !!data.summaries[0].topics,
            topics: data.summaries[0].topics
          } : null
        })
        setter(data)
      } else {
        console.error(`[DataSourcesTab] ${source} failed:`, res.status)
        setter({ error: 'Data not available' })
      }
    } catch (error) {
      console.error(`[DataSourcesTab] ${source} error:`, error)
      setter({ error: String(error) })
    } finally {
      setLoading(prev => ({ ...prev, [source]: false }))
    }
  }

  const renderSalesforceData = () => {
    if (loading.salesforce) return <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
    if (!salesforceData) return <div className="text-muted-foreground">No data available</div>
    if (salesforceData.error) return <div className="text-destructive">{salesforceData.error}</div>

    return (
      <div className="space-y-4">
        {salesforceData.account && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div><span className="font-medium">Name:</span> {salesforceData.account.name}</div>
              <div><span className="font-medium">ID:</span> {salesforceData.account.id}</div>
              {salesforceData.account.industry && (
                <div><span className="font-medium">Industry:</span> {salesforceData.account.industry}</div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contacts ({salesforceData.contactsCount || 0})</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Opportunities ({salesforceData.opportunitiesCount || 0})</CardTitle>
          </CardHeader>
          {salesforceData.opportunities && salesforceData.opportunities.length > 0 && (
            <CardContent>
              <div className="space-y-3">
                {salesforceData.opportunities.map((opp: any, idx: number) => (
                  <div key={idx} className="border-l-2 border-primary pl-3 space-y-1">
                    <div className="font-medium">{opp.name}</div>
                    <div className="text-sm text-muted-foreground">Stage: {opp.stage}</div>
                    {opp.amount && <div className="text-sm text-muted-foreground">Amount: ${opp.amount.toLocaleString()}</div>}
                    {opp.closeDate && <div className="text-sm text-muted-foreground">Close Date: {opp.closeDate}</div>}
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    )
  }

  const toggleTranscript = (callId: string) => {
    setExpandedTranscripts(prev => {
      const next = new Set(prev)
      if (next.has(callId)) {
        next.delete(callId)
      } else {
        next.add(callId)
      }
      return next
    })
  }

  const renderGongData = () => {
    if (loading.gong) return <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
    if (!gongData) return <div className="text-muted-foreground">No data available</div>
    if (gongData.error) return <div className="text-destructive">{gongData.error}</div>

    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Calls ({gongData.callsCount || 0})</CardTitle>
            <CardDescription>Recent calls with transcripts</CardDescription>
          </CardHeader>
          {gongData.calls && gongData.calls.length > 0 && (
            <CardContent>
              <div className="space-y-4">
                {gongData.calls.map((call: any, idx: number) => {
                  const summary = gongData.summaries?.find((s: any) => s.callId === call.id)
                  const isExpanded = expandedTranscripts.has(call.id)
                  
                  return (
                    <Card key={idx} className="border-l-2 border-primary">
                      <CardContent className="pt-4 space-y-3">
                        {/* Title and Call Link */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-medium text-base">{call.title}</div>
                          {call.url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2"
                              onClick={() => window.open(call.url, '_blank')}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          )}
                        </div>

                        {/* Date and Duration */}
                        <div className="text-sm text-muted-foreground">
                          {new Date(call.started).toLocaleDateString()} • {Math.floor(call.duration / 60)} min
                        </div>

                        {/* Participants */}
                        {call.participants && call.participants.length > 0 && (
                          <div className="text-sm text-muted-foreground">
                            <span className="font-medium">Participants:</span> {call.participants.slice(0, 3).join(', ')}
                            {call.participants.length > 3 && ` +${call.participants.length - 3} more`}
                          </div>
                        )}
                        
                        {/* Show data if transcript OR any metadata exists */}
                        {(summary?.transcript || summary?.topics?.length > 0 || summary?.summary || summary?.actionItems?.length > 0 || summary?.nextSteps?.length > 0) && (
                          <div className="space-y-3 pt-2 border-t">
                            {/* Topics */}
                            {summary?.topics && summary.topics.length > 0 && (
                              <div>
                                <span className="text-sm font-medium">Topics:</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {summary.topics.map((topic: string, i: number) => (
                                    <Badge key={i} variant="secondary" className="text-xs">{topic}</Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Summary */}
                            {summary?.summary && (
                              <div className="text-sm">
                                <span className="font-medium">Summary:</span>
                                <p className="mt-1 text-muted-foreground">{summary.summary}</p>
                              </div>
                            )}

                            {/* Action Items */}
                            {summary?.actionItems && summary.actionItems.length > 0 && (
                              <div className="text-sm">
                                <span className="font-medium">Action Items:</span>
                                <ul className="list-disc list-inside mt-1 space-y-0.5">
                                  {summary.actionItems.map((item: string, i: number) => (
                                    <li key={i} className="text-muted-foreground">{item}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Next Steps */}
                            {summary?.nextSteps && summary.nextSteps.length > 0 && (
                              <div className="text-sm">
                                <span className="font-medium">Next Steps:</span>
                                <ul className="list-disc list-inside mt-1 space-y-0.5">
                                  {summary.nextSteps.map((step: string, i: number) => (
                                    <li key={i} className="text-muted-foreground">{step}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Expandable Transcript */}
                            {summary?.transcript && (
                              <div className="pt-2 border-t">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2 -ml-2"
                                  onClick={() => toggleTranscript(call.id)}
                                >
                                  {isExpanded ? (
                                    <><ChevronUp className="h-4 w-4 mr-1" /> Hide Transcript</>
                                  ) : (
                                    <><ChevronDown className="h-4 w-4 mr-1" /> View Transcript</>
                                  )}
                                </Button>
                                
                                {isExpanded && (
                                  <div className="mt-2 p-3 bg-muted rounded-md max-h-96 overflow-y-auto">
                                    <pre className="text-xs whitespace-pre-wrap font-mono text-muted-foreground">
                                      {summary.transcript}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    )
  }

  const renderNotionData = () => {
    if (loading.notion) return <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
    if (!notionData) return <div className="text-muted-foreground">No data available</div>
    if (notionData.error) return <div className="text-destructive">{notionData.error}</div>

    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pages ({notionData.pagesCount || 0})</CardTitle>
            <CardDescription>Knowledge pages from Notion</CardDescription>
          </CardHeader>
          {notionData.pages && notionData.pages.length > 0 && (
            <CardContent>
              <div className="space-y-3">
                {notionData.pages.map((page: any, idx: number) => (
                  <div key={idx} className="border-l-2 border-primary pl-3 space-y-1">
                    <div className="font-medium">{page.title}</div>
                    {page.lastEdited && (
                      <div className="text-sm text-muted-foreground">
                        Last edited: {new Date(page.lastEdited).toLocaleDateString()}
                      </div>
                    )}
                    {page.url && (
                      <a 
                        href={page.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        Open in Notion
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    )
  }

  if (!accountSlug) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Select an account to view data sources
        </CardContent>
      </Card>
    )
  }

  return (
    <Tabs defaultValue="salesforce" className="w-full">
      <TabsList>
        <TabsTrigger value="salesforce" className="flex items-center gap-2">
          <Database className="h-4 w-4" />
          Salesforce
        </TabsTrigger>
        <TabsTrigger value="gong" className="flex items-center gap-2">
          <PhoneCall className="h-4 w-4" />
          Gong
        </TabsTrigger>
        <TabsTrigger value="notion" className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Notion
        </TabsTrigger>
      </TabsList>

      <TabsContent value="salesforce" className="mt-4">
        {renderSalesforceData()}
      </TabsContent>

      <TabsContent value="gong" className="mt-4">
        {renderGongData()}
      </TabsContent>

      <TabsContent value="notion" className="mt-4">
        {renderNotionData()}
      </TabsContent>
    </Tabs>
  )
}
