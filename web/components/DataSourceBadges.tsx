'use client'

import { useState, useEffect } from 'react'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { Database, PhoneCall, FileText, RefreshCw } from 'lucide-react'

const API_URL = 'http://localhost:3001/api'

interface SourceStatus {
  status: 'fresh' | 'stale' | 'missing'
  lastFetchedAt: string | null
  nextRecommended: 'use-cache' | 'incremental' | 'full'
  staleReasons?: string[]
}

interface DataSourceBadgesProps {
  accountSlug: string
  capabilities: {
    salesforce: boolean
    gong: boolean
    notion: boolean
  }
  refreshTrigger?: number
}

export function DataSourceBadges({ accountSlug, capabilities, refreshTrigger = 0 }: DataSourceBadgesProps) {
  const [selectedSource, setSelectedSource] = useState<string | null>(null)
  const [sourceData, setSourceData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [sourceStatuses, setSourceStatuses] = useState<Record<string, SourceStatus>>({})
  const [refreshing, setRefreshing] = useState<Record<string, boolean>>({})
  const [refreshProgress, setRefreshProgress] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchSourceStatuses()
  }, [accountSlug, refreshTrigger])

  const fetchSourceStatuses = async () => {
    try {
      const res = await fetch(`${API_URL}/accounts/${accountSlug}/sources`)
      const data = await res.json()
      setSourceStatuses(data)
    } catch (error) {
      console.error('Failed to fetch source statuses:', error)
    }
  }

  const refreshSource = async (source: string, mode: 'auto' | 'incremental' | 'full') => {
    console.log(`Refreshing ${source} for account slug: ${accountSlug}`)
    setRefreshing(prev => ({ ...prev, [source]: true }))
    setRefreshProgress(prev => ({ ...prev, [source]: 'Starting...' }))
    
    try {
      const res = await fetch(`${API_URL}/accounts/${accountSlug}/sources/${source}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      })
      
      if (!res.body) {
        console.error('No response body')
        return
      }
      
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.substring(6).trim()
              if (!jsonStr) continue
              
              const data = JSON.parse(jsonStr)
              
              if (data.type === 'progress') {
                setRefreshProgress(prev => ({ ...prev, [source]: data.message }))
              } else if (data.type === 'complete') {
                const dataPath = data.meta?.dataPath || `data/accounts/${accountSlug}/raw/`
                const summary = data.stats 
                  ? Object.entries(data.stats).map(([k,v]) => `${k}: ${v}`).join(', ')
                  : data.updated ? 'Updated' : 'No changes'
                setRefreshProgress(prev => ({ ...prev, [source]: `Complete. ${summary}. Stored in ${dataPath}` }))
                await fetchSourceStatuses()
                break
              } else if (data.type === 'error') {
                const errorMsg = data.details?.includes('MCP not available') 
                  ? 'MCP not configured'
                  : data.error
                setRefreshProgress(prev => ({ ...prev, [source]: `✗ ${errorMsg}` }))
                console.error(`Refresh error:`, data.error, data.details)
                
                // Show alert for MCP configuration issues
                if (data.details?.includes('MCP not available')) {
                  alert(`${source.charAt(0).toUpperCase() + source.slice(1)} MCP is not configured.\n\nTo use data source refresh, configure your MCP servers in Amp settings.\n\nAlternatively, use the "Full Refresh" button in the CRM section.`)
                }
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e, 'Line:', line)
            }
          }
        }
      }
    } catch (error) {
      console.error(`Failed to refresh ${source}:`, error)
      setRefreshProgress(prev => ({ ...prev, [source]: `Failed: ${error}` }))
    } finally {
      setRefreshing(prev => ({ ...prev, [source]: false }))
      setTimeout(() => {
        setRefreshProgress(prev => {
          const { [source]: _, ...rest } = prev
          return rest
        })
      }, 3000)
    }
  }

  const getStatusColor = (status: 'fresh' | 'stale' | 'missing') => {
    switch (status) {
      case 'fresh': return 'bg-green-500'
      case 'stale': return 'bg-yellow-500'
      case 'missing': return 'bg-gray-400'
    }
  }

  const formatTimestamp = (ts: string | null) => {
    if (!ts) return 'Never'
    const date = new Date(ts)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const openSourceDetails = async (source: string) => {
    if (!capabilities[source as keyof typeof capabilities]) return
    
    setSelectedSource(source)
    setLoading(true)
    
    try {
      const res = await fetch(`${API_URL}/accounts/${accountSlug}/sources/${source}`)
      const data = await res.json()
      setSourceData(data)
    } catch (error) {
      setSourceData({ error: 'Failed to load data' })
    } finally {
      setLoading(false)
    }
  }

  const renderSourceBadge = (
    source: string,
    icon: React.ReactNode,
    label: string,
    enabled: boolean
  ) => {
    const status = sourceStatuses?.[source]
    const isRefreshing = refreshing?.[source]

    return (
      <div className="flex items-center gap-1">
        <Badge
          variant={enabled ? 'default' : 'secondary'}
          className={enabled ? 'cursor-pointer hover:opacity-80' : ''}
          onClick={() => enabled && openSourceDetails(source)}
        >
          {icon}
          {label}
        </Badge>
        
        {enabled && (
          <>
            {status && (
              <div 
                className={`h-2 w-2 rounded-full ${getStatusColor(status.status)}`}
                title={`${status.status} - Last updated: ${formatTimestamp(status.lastFetchedAt)}`}
              />
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 w-6 p-0"
                  disabled={isRefreshing}
                  title="Refresh data source (requires MCP configuration)"
                >
                  <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => refreshSource(source, 'auto')}>
                  Auto {status?.nextRecommended !== 'use-cache' && '(Recommended)'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => refreshSource(source, 'incremental')}>
                  Incremental
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => refreshSource(source, 'full')}>
                  Full Refresh
                </DropdownMenuItem>
                <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                  Requires MCP setup
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {refreshProgress[source] ? (
              <span className="text-xs text-gray-700 font-medium">
                {refreshProgress[source]}
              </span>
            ) : status && (
              <span className="text-xs text-muted-foreground">
                {formatTimestamp(status.lastFetchedAt)}
              </span>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-wrap gap-3 items-center">
        {renderSourceBadge(
          'salesforce',
          <Database className="h-3 w-3 mr-1" />,
          'Salesforce',
          capabilities.salesforce
        )}
        {renderSourceBadge(
          'gong',
          <PhoneCall className="h-3 w-3 mr-1" />,
          'Gong',
          capabilities.gong
        )}
        {renderSourceBadge(
          'notion',
          <FileText className="h-3 w-3 mr-1" />,
          'Notion',
          capabilities.notion
        )}
      </div>

      <Dialog open={!!selectedSource} onOpenChange={() => setSelectedSource(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="capitalize">{selectedSource} Data</DialogTitle>
            <DialogDescription>
              Data pulled from {selectedSource} for this account
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : sourceData?.error ? (
            <div className="py-8 text-center text-destructive">{sourceData.error}</div>
          ) : (
            <div className="space-y-4">
              {selectedSource === 'salesforce' && sourceData && (
                <>
                  {sourceData.account && (
                    <div className="space-y-2">
                      <h3 className="font-semibold">Account</h3>
                      <div className="text-sm space-y-1 text-muted-foreground">
                        <div>Name: {sourceData.account.name}</div>
                        <div>ID: {sourceData.account.id}</div>
                        {sourceData.account.industry && <div>Industry: {sourceData.account.industry}</div>}
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Contacts</div>
                      <div className="text-2xl font-bold">{sourceData.contactsCount}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Opportunities</div>
                      <div className="text-2xl font-bold">{sourceData.opportunitiesCount}</div>
                    </div>
                  </div>

                  {sourceData.opportunities && sourceData.opportunities.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="font-semibold">Recent Opportunities</h3>
                      <div className="space-y-2">
                        {sourceData.opportunities.map((opp: any, i: number) => (
                          <div key={i} className="border rounded p-3 text-sm">
                            <div className="font-medium">{opp.name}</div>
                            <div className="text-muted-foreground mt-1">
                              Stage: {opp.stage} | Amount: ${opp.amount?.toLocaleString() || 'N/A'} | Close: {opp.closeDate}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {selectedSource === 'gong' && sourceData && (
                <>
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Total Calls</div>
                    <div className="text-2xl font-bold">{sourceData.callsCount}</div>
                  </div>

                  {sourceData.calls && sourceData.calls.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="font-semibold">Recent Calls</h3>
                      <div className="space-y-2">
                        {sourceData.calls.map((call: any) => (
                          <div key={call.id} className="border rounded p-3 text-sm">
                            <div className="font-medium">{call.title || 'Untitled Call'}</div>
                            <div className="text-muted-foreground mt-1">
                              {new Date(call.started).toLocaleDateString()} | {Math.round(call.duration / 60)} min
                            </div>
                            {call.participants.length > 0 && (
                              <div className="text-muted-foreground text-xs mt-1">
                                Participants: {call.participants.join(', ')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {selectedSource === 'notion' && sourceData && (
                <>
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Total Pages</div>
                    <div className="text-2xl font-bold">{sourceData.pagesCount}</div>
                  </div>

                  {sourceData.pages && sourceData.pages.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="font-semibold">Pages Found</h3>
                      <div className="space-y-2">
                        {sourceData.pages.map((page: any) => (
                          <div key={page.id} className="border rounded p-3 text-sm">
                            <div className="font-medium">{page.title}</div>
                            <div className="text-muted-foreground text-xs mt-1">
                              Last edited: {new Date(page.lastEdited).toLocaleDateString()}
                            </div>
                            {page.url && (
                              <a
                                href={page.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:underline text-xs mt-1 block"
                              >
                                Open in Notion →
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
