'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'
import { 
  ChevronDown, 
  ChevronRight, 
  Copy, 
  Check, 
  Clock, 
  Cpu, 
  Download,
  ExternalLink,
  FileJson,
  FileText,
  Sparkles
} from 'lucide-react'
import type { LifecycleStageId, AgentId } from '@/types/agent'

interface ArtifactMetadata {
  agentId: AgentId | string
  stage?: LifecycleStageId
  executionTimeMs?: number
  model?: string
  tokensUsed?: {
    input: number
    output: number
  }
  timestamp: string
  version?: number
}

interface ArtifactCardProps {
  title: string
  description?: string
  content: string | object
  metadata?: ArtifactMetadata
  defaultExpanded?: boolean
  showCopyButton?: boolean
  showDownloadButton?: boolean
  onExternalLink?: () => void
  className?: string
  children?: React.ReactNode
}

const getAgentLabel = (agentId: string): string => {
  return agentId
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

const getStageBadgeColor = (stage: LifecycleStageId): string => {
  const colors: Record<string, string> = {
    prospecting: 'bg-blue-100 text-blue-800',
    qualification: 'bg-purple-100 text-purple-800',
    solution_mapping: 'bg-indigo-100 text-indigo-800',
    validation: 'bg-green-100 text-green-800',
    handoff_close: 'bg-orange-100 text-orange-800',
    post_mortem: 'bg-gray-100 text-gray-800',
    global: 'bg-slate-100 text-slate-800',
  }
  return colors[stage] || 'bg-gray-100 text-gray-800'
}

const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  
  return date.toLocaleDateString()
}

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function ArtifactCard({
  title,
  description,
  content,
  metadata,
  defaultExpanded = true,
  showCopyButton = true,
  showDownloadButton = false,
  onExternalLink,
  className = '',
  children,
}: ArtifactCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [copied, setCopied] = useState(false)

  const contentString = typeof content === 'string' 
    ? content 
    : JSON.stringify(content, null, 2)
  
  const isJson = typeof content === 'object' || 
    (typeof content === 'string' && content.trim().startsWith('{'))

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(contentString)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleDownload = () => {
    const blob = new Blob([contentString], { type: isJson ? 'application/json' : 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${metadata?.agentId || 'artifact'}-${new Date().toISOString().slice(0, 10)}.${isJson ? 'json' : 'txt'}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <button 
              className="flex items-center gap-2 text-left w-full"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <CardTitle className="text-lg truncate">{title}</CardTitle>
            </button>
            {description && (
              <CardDescription className="mt-1 ml-6">{description}</CardDescription>
            )}
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            {metadata?.stage && (
              <Badge variant="outline" className={`text-xs ${getStageBadgeColor(metadata.stage)}`}>
                {metadata.stage.replace('_', ' ')}
              </Badge>
            )}
            
            {showCopyButton && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopy}>
                      {copied ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{copied ? 'Copied!' : 'Copy to clipboard'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            {showDownloadButton && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDownload}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Download</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            {onExternalLink && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onExternalLink}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Open in new tab</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
        
        {/* Metadata row */}
        {metadata && (
          <div className="flex flex-wrap gap-3 mt-2 ml-6 text-xs text-muted-foreground">
            {metadata.agentId && (
              <div className="flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                <span>{getAgentLabel(metadata.agentId)}</span>
              </div>
            )}
            {metadata.timestamp && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{formatTimestamp(metadata.timestamp)}</span>
              </div>
            )}
            {metadata.executionTimeMs && (
              <div className="flex items-center gap-1">
                <Cpu className="h-3 w-3" />
                <span>{formatDuration(metadata.executionTimeMs)}</span>
              </div>
            )}
            {metadata.model && (
              <div className="flex items-center gap-1">
                {isJson ? <FileJson className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                <span>{metadata.model}</span>
              </div>
            )}
            {metadata.tokensUsed && (
              <span>
                {metadata.tokensUsed.input + metadata.tokensUsed.output} tokens
              </span>
            )}
            {metadata.version && (
              <span>v{metadata.version}</span>
            )}
          </div>
        )}
      </CardHeader>
      
      {expanded && (
        <CardContent>
          {children ? (
            children
          ) : (
            <pre className="text-sm bg-muted p-4 rounded-lg overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto">
              {contentString}
            </pre>
          )}
        </CardContent>
      )}
    </Card>
  )
}

// Convenience component for success/error states
interface ArtifactStatusProps {
  success: boolean
  error?: string
  className?: string
}

export function ArtifactStatus({ success, error, className = '' }: ArtifactStatusProps) {
  if (success) {
    return (
      <div className={`flex items-center gap-2 text-green-600 ${className}`}>
        <Check className="h-4 w-4" />
        <span className="text-sm font-medium">Success</span>
      </div>
    )
  }
  
  return (
    <div className={`flex items-center gap-2 text-red-600 ${className}`}>
      <span className="text-sm font-medium">Error</span>
      {error && <span className="text-sm text-muted-foreground">: {error}</span>}
    </div>
  )
}

// Wrapper for rendering structured agent outputs
interface StructuredArtifactProps {
  title: string
  agentId: string
  data: Record<string, any>
  metadata?: ArtifactMetadata
  renderSection?: (key: string, value: any) => React.ReactNode
}

export function StructuredArtifact({
  title,
  agentId,
  data,
  metadata,
  renderSection,
}: StructuredArtifactProps) {
  const defaultRenderer = (key: string, value: any) => {
    if (value === null || value === undefined) return null
    
    if (Array.isArray(value)) {
      if (value.length === 0) return null
      return (
        <div key={key} className="space-y-2">
          <h4 className="font-medium text-sm capitalize">{key.replace(/_/g, ' ')}</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
            {value.map((item, i) => (
              <li key={i}>{typeof item === 'object' ? JSON.stringify(item) : String(item)}</li>
            ))}
          </ul>
        </div>
      )
    }
    
    if (typeof value === 'object') {
      return (
        <div key={key} className="space-y-2">
          <h4 className="font-medium text-sm capitalize">{key.replace(/_/g, ' ')}</h4>
          <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
            {JSON.stringify(value, null, 2)}
          </pre>
        </div>
      )
    }
    
    return (
      <div key={key} className="space-y-1">
        <h4 className="font-medium text-sm capitalize">{key.replace(/_/g, ' ')}</h4>
        <p className="text-sm text-muted-foreground">{String(value)}</p>
      </div>
    )
  }

  return (
    <ArtifactCard
      title={title}
      metadata={metadata}
      content={data}
      showCopyButton
      showDownloadButton
    >
      <div className="space-y-4">
        {Object.entries(data).map(([key, value]) => 
          renderSection ? renderSection(key, value) : defaultRenderer(key, value)
        )}
      </div>
    </ArtifactCard>
  )
}
