'use client'

import { useState, useEffect, useRef } from 'react'
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
import { Database, PhoneCall, FileText, RefreshCw, Newspaper } from 'lucide-react'

const API_URL = 'http://localhost:3001/api'

interface SourceStatus {
  status: 'fresh' | 'stale' | 'missing'
  lastFetchedAt: string | null
  lastDataTimestamp?: string | null // When the data on source was last generated/updated
  nextRecommended: 'use-cache' | 'incremental' | 'full'
  staleReasons?: string[]
}

interface DataSourceBadgesProps {
  accountSlug: string
  capabilities: {
    salesforce: boolean
    gong: boolean
    notion: boolean
    amp: boolean
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
  const hasProbed = useRef<Record<string, boolean>>({})

  useEffect(() => {
    fetchSourceStatuses()
    
    // Probe remote sources on first load for this account
    if (!hasProbed.current[accountSlug]) {
      hasProbed.current[accountSlug] = true
      probeAndAutoRefresh()
    }
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

  const probeAndAutoRefresh = async () => {
    try {
      console.log(`[DataSourceBadges] Probing remote sources for ${accountSlug}...`)
      const res = await fetch(`${API_URL}/accounts/${accountSlug}/sources/probe`)
      if (!res.ok) {
        console.error('[DataSourceBadges] Probe failed:', res.statusText)
        return
      }
      
      const probeResults = await res.json()
      console.log('[DataSourceBadges] Probe results:', probeResults)
      
      // Guard against null/undefined response
      if (!probeResults || typeof probeResults !== 'object') {
        console.error('[DataSourceBadges] Invalid probe results:', probeResults)
        return
      }
      
      // Auto-refresh any stale sources
      const staleSources: string[] = []
      if (probeResults.salesforce?.staleOnSource) staleSources.push('salesforce')
      if (probeResults.gong?.staleOnSource) staleSources.push('gong')
      if (probeResults.notion?.staleOnSource) staleSources.push('notion')
      if (probeResults.amp?.staleOnSource) staleSources.push('amp')
      
      if (staleSources.length > 0) {
        console.log(`[DataSourceBadges] Auto-refreshing stale sources: ${staleSources.join(', ')}`)
        for (const source of staleSources) {
          await refreshSource(source, 'auto')
        }
      } else {
        console.log('[DataSourceBadges] All sources are fresh')
      }
    } catch (error) {
      console.error('[DataSourceBadges] Probe error:', error)
    }
  }

  const refreshSource = async (source: string, mode: 'auto' | 'incremental' | 'full') => {
    console.log(`[DataSourceBadges] Refreshing ${source} for account slug: ${accountSlug}, mode: ${mode}`)
    setRefreshing(prev => ({ ...prev, [source]: true }))
    setRefreshProgress(prev => ({ ...prev, [source]: 'Starting...' }))
    
    try {
      console.log(`[DataSourceBadges] Fetching ${API_URL}/accounts/${accountSlug}/sources/${source}/refresh`)
      const res = await fetch(`${API_URL}/accounts/${accountSlug}/sources/${source}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      })
      
      console.log(`[DataSourceBadges] Response status: ${res.status}`)
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }
      
      if (!res.body) {
        console.error('[DataSourceBadges] No response body')
        throw new Error('No response body')
      }
      
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      
      console.log(`[DataSourceBadges] Starting SSE stream read loop...`)
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          console.log(`[DataSourceBadges] SSE stream ended`)
          break
        }
        
        const chunk = decoder.decode(value)
        console.log(`[DataSourceBadges] Received chunk:`, chunk.substring(0, 200))
        const lines = chunk.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.substring(6).trim()
              if (!jsonStr) continue
              
              console.log(`[DataSourceBadges] Parsing JSON:`, jsonStr.substring(0, 100))
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
                  alert(`${source.charAt(0).toUpperCase() + source.slice(1)} MCP is not configured.\n\nTo use data source refresh, configure your MCP servers in Amp settings.`)
                }
              }
            } catch (e) {
              console.error('[DataSourceBadges] Failed to parse SSE data:', e, 'Line:', line)
            }
          }
        }
      }
      
      console.log(`[DataSourceBadges] Stream complete for ${source}`)
    } catch (error) {
      console.error(`[DataSourceBadges] Failed to refresh ${source}:`, error)
      setRefreshProgress(prev => ({ ...prev, [source]: `✗ Failed: ${error}` }))
      alert(`Failed to refresh ${source}: ${error}\n\nCheck browser console for details.`)
    } finally {
      console.log(`[DataSourceBadges] Cleanup: setting refreshing to false for ${source}`)
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

  const formatFullDate = (ts: string | null) => {
    if (!ts) return 'Never'
    const date = new Date(ts)
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const year = date.getFullYear()
    return `${month}/${day}/${year}`
  }

  const capitalizeSource = (source: string) => {
    if (source === 'salesforce') return 'Salesforce'
    if (source === 'gong') return 'Gong'
    if (source === 'notion') return 'Notion'
    if (source === 'amp') return 'Amp'
    if (source === 'all-sources') return 'All Sources'
    return source
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

  const openAllSourcesDetails = () => {
    setSelectedSource('all-sources')
    setLoading(true)
    
    // Fetch all available source data
    Promise.all([
      capabilities.salesforce ? fetch(`${API_URL}/accounts/${accountSlug}/sources/salesforce`).then(r => r.json()) : null,
      capabilities.gong ? fetch(`${API_URL}/accounts/${accountSlug}/sources/gong`).then(r => r.json()) : null,
      capabilities.notion ? fetch(`${API_URL}/accounts/${accountSlug}/sources/notion`).then(r => r.json()) : null,
      capabilities.amp ? fetch(`${API_URL}/accounts/${accountSlug}/sources/amp`).then(r => r.json()) : null,
    ]).then(([sf, gong, notion, amp]) => {
      setSourceData({ salesforce: sf, gong, notion, amp })
      setLoading(false)
    }).catch(() => {
      setSourceData({ error: 'Failed to load data' })
      setLoading(false)
    })
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
                title={`${status.status} - Last pulled: ${formatTimestamp(status.lastFetchedAt)}${
                  source === 'gong' && status.lastDataTimestamp 
                    ? ` | Latest call: ${formatTimestamp(status.lastDataTimestamp)}` 
                    : ''
                }`}
              />
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 w-6 p-0"
                  disabled={isRefreshing}
                  title={source === 'amp' ? 'Refresh Amp data' : 'Refresh data source (requires MCP configuration)'}
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
                {source !== 'amp' && (
                  <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                    Requires MCP setup
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            
            {refreshProgress[source] ? (
              <span className="text-xs text-gray-700 font-medium">
                {refreshProgress[source]}
              </span>
            ) : status && (
              <span className="text-xs text-muted-foreground">
                {source === 'gong' && status.lastDataTimestamp
                  ? formatTimestamp(status.lastDataTimestamp)
                  : formatTimestamp(status.lastFetchedAt)}
              </span>
            )}
          </>
        )}
      </div>
    )
  }

  const refreshAllSources = async (mode: 'incremental' | 'full') => {
    const sources = ['salesforce', 'gong', 'notion', 'amp'].filter(
      s => capabilities[s as keyof typeof capabilities]
    )
    
    for (const source of sources) {
      await refreshSource(source, mode)
    }
  }

  const isRefreshingAny = Object.values(refreshing).some(Boolean)

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
        {renderSourceBadge(
          'amp',
          <Newspaper className="h-3 w-3 mr-1" />,
          'Amp News',
          capabilities.amp
        )}
        
        {/* All Sources badge with refresh */}
        <div className="flex items-center gap-1">
          <Badge
            variant="default"
            className="cursor-pointer hover:opacity-80"
            onClick={openAllSourcesDetails}
          >
            All Sources
          </Badge>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 w-6 p-0"
                disabled={isRefreshingAny}
                title="Refresh all data sources (requires MCP configuration)"
              >
                <RefreshCw className={`h-3 w-3 ${isRefreshingAny ? 'animate-spin' : ''}`} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => refreshAllSources('incremental')}>
                Incremental Refresh
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => refreshAllSources('full')}>
                Full Refresh
              </DropdownMenuItem>
              <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                Requires MCP setup
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Dialog open={!!selectedSource} onOpenChange={() => setSelectedSource(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{capitalizeSource(selectedSource || '')} Data</DialogTitle>
            <DialogDescription>
              {selectedSource === 'all-sources' 
                ? 'Consolidated data from all sources for this account'
                : (sourceStatuses && selectedSource && sourceStatuses[selectedSource])
                  ? `Data pulled on ${formatFullDate(sourceStatuses[selectedSource]?.lastFetchedAt)} for this account`
                  : 'Data pulled for this account'
              }
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : sourceData?.error ? (
            <div className="py-8 text-center text-destructive">{sourceData.error}</div>
          ) : (
            <div className="space-y-4">
              {selectedSource === 'all-sources' && sourceData && (
                <>
                  {sourceData.salesforce && (
                    <div className="border rounded p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">Salesforce</h3>
                        <span className="text-xs text-muted-foreground">
                          {formatFullDate(sourceStatuses.salesforce?.lastFetchedAt)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Contacts</div>
                          <div className="text-xl font-bold">{sourceData.salesforce.contactsCount}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Opportunities</div>
                          <div className="text-xl font-bold">{sourceData.salesforce.opportunitiesCount}</div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {sourceData.gong && (
                    <div className="border rounded p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">Gong</h3>
                        <span className="text-xs text-muted-foreground">
                          {formatFullDate(sourceStatuses.gong?.lastFetchedAt)}
                        </span>
                      </div>
                      <div className="text-sm">
                        <div className="text-muted-foreground">Total Calls</div>
                        <div className="text-xl font-bold">{sourceData.gong.callsCount}</div>
                      </div>
                    </div>
                  )}
                  
                  {sourceData.notion && (
                    <div className="border rounded p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">Notion</h3>
                        <span className="text-xs text-muted-foreground">
                          {formatFullDate(sourceStatuses.notion?.lastFetchedAt)}
                        </span>
                      </div>
                      <div className="text-sm">
                        <div className="text-muted-foreground">Total Pages</div>
                        <div className="text-xl font-bold">{sourceData.notion.pagesCount}</div>
                      </div>
                    </div>
                  )}
                  
                  {sourceData.amp && (
                    <div className="border rounded p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">Amp News</h3>
                        <span className="text-xs text-muted-foreground">
                          {formatFullDate(sourceStatuses.amp?.lastFetchedAt)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Features</div>
                          <div className="text-xl font-bold">{sourceData.amp.featuresCount}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Sections</div>
                          <div className="text-xl font-bold">
                            {(sourceData.amp.summary?.stats?.newsHeadings || 0) + (sourceData.amp.summary?.stats?.manualHeadings || 0)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

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

              {selectedSource === 'amp' && sourceData && (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Pages</div>
                      <div className="text-2xl font-bold">{sourceData.pagesCount}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Sections</div>
                      <div className="text-2xl font-bold">
                        {(sourceData.summary?.stats?.newsHeadings || 0) + (sourceData.summary?.stats?.manualHeadings || 0)}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Features</div>
                      <div className="text-2xl font-bold">{sourceData.featuresCount}</div>
                    </div>
                  </div>

                  {sourceData.summary && (
                    <div className="space-y-3">
                      <h3 className="font-semibold">Content Summary</h3>
                      
                      {sourceData.summary.sections.news.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-blue-600">Amp News ({sourceData.summary.sections.news.length} sections)</h4>
                          <div className="border rounded overflow-hidden">
                            <table className="w-full text-xs">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-3 py-2 text-left font-medium">Section</th>
                                  <th className="px-3 py-2 text-left font-medium">Preview</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {sourceData.summary.sections.news.slice(0, 10).map((section: any, i: number) => (
                                  <tr key={i} className="hover:bg-gray-50">
                                    <td className="px-3 py-2 font-medium whitespace-nowrap">{section.heading}</td>
                                    <td className="px-3 py-2 text-muted-foreground">
                                      {section.content.substring(0, 100)}...
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {sourceData.summary.sections.manual.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-green-600">Amp Manual ({sourceData.summary.sections.manual.length} sections)</h4>
                          <div className="border rounded overflow-hidden">
                            <table className="w-full text-xs">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-3 py-2 text-left font-medium">Section</th>
                                  <th className="px-3 py-2 text-left font-medium">Preview</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {sourceData.summary.sections.manual.slice(0, 10).map((section: any, i: number) => (
                                  <tr key={i} className="hover:bg-gray-50">
                                    <td className="px-3 py-2 font-medium whitespace-nowrap">{section.heading}</td>
                                    <td className="px-3 py-2 text-muted-foreground">
                                      {section.content.substring(0, 100)}...
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {(sourceData.content?.news || sourceData.content?.manual) && (
                    <div className="space-y-3">
                      <h3 className="font-semibold">Full Content (for Amp Context)</h3>
                      <div className="text-xs text-muted-foreground">
                        This content is stored and available for Amp to use in analysis and document creation.
                      </div>

                      {sourceData.content.news && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-blue-600">Amp News</h4>
                          <div className="border rounded p-3 bg-gray-50 max-h-60 overflow-y-auto">
                            <pre className="text-xs whitespace-pre-wrap font-mono">
                              {sourceData.content.news}
                            </pre>
                          </div>
                        </div>
                      )}

                      {sourceData.content.manual && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-green-600">Amp Manual</h4>
                          <div className="border rounded p-3 bg-gray-50 max-h-60 overflow-y-auto">
                            <pre className="text-xs whitespace-pre-wrap font-mono">
                              {sourceData.content.manual}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {sourceData.pages && sourceData.pages.length > 0 && (
                  <div className="space-y-2 pt-3 border-t">
                  <h3 className="font-semibold text-sm">Source Pages</h3>
                  <div className="space-y-1">
                  {sourceData.pages.map((page: any) => (
                  <div key={page.key} className="flex items-center justify-between text-xs">
                  <a
                    href={page.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                  >
                    {page.key === 'news' ? 'Amp News' : 'Amp Manual'} →
                  </a>
                  {page.lastFetchedAt && (
                    <span className="text-muted-foreground">
                    {new Date(page.lastFetchedAt).toLocaleDateString()}
                  </span>
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
