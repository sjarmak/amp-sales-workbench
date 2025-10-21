'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Badge } from './ui/badge'
import { Database, PhoneCall, FileText, Loader2 } from 'lucide-react'

const API_URL = 'http://localhost:3001/api'

interface DataSourcesTabProps {
  accountSlug: string | undefined
}

export function DataSourcesTab({ accountSlug }: DataSourcesTabProps) {
  const [salesforceData, setSalesforceData] = useState<any>(null)
  const [gongData, setGongData] = useState<any>(null)
  const [notionData, setNotionData] = useState<any>(null)
  const [loading, setLoading] = useState<Record<string, boolean>>({})

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
      const res = await fetch(`${API_URL}/accounts/${accountSlug}/sources/${source}`)
      if (res.ok) {
        const data = await res.json()
        setter(data)
      } else {
        setter({ error: 'Data not available' })
      }
    } catch (error) {
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

  const renderGongData = () => {
    if (loading.gong) return <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
    if (!gongData) return <div className="text-muted-foreground">No data available</div>
    if (gongData.error) return <div className="text-destructive">{gongData.error}</div>

    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Calls ({gongData.callsCount || 0})</CardTitle>
            <CardDescription>Recent calls from Gong</CardDescription>
          </CardHeader>
          {gongData.calls && gongData.calls.length > 0 && (
            <CardContent>
              <div className="space-y-3">
                {gongData.calls.map((call: any, idx: number) => (
                  <div key={idx} className="border-l-2 border-primary pl-3 space-y-1">
                    <div className="font-medium">{call.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(call.started).toLocaleDateString()} - {Math.floor(call.duration / 60)}min
                    </div>
                    {call.participants && call.participants.length > 0 && (
                      <div className="text-sm text-muted-foreground">
                        Participants: {call.participants.join(', ')}
                      </div>
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
