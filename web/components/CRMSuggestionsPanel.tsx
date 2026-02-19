'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'
import { 
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Database,
  Edit3,
  Loader2,
  RefreshCw,
  X
} from 'lucide-react'

const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    return `http://${window.location.hostname}:3001/api`
  }
  return 'http://localhost:3001/api'
}

interface CRMSuggestion {
  id: string
  objectType: 'Account' | 'Contact' | 'Opportunity'
  objectName: string
  field: string
  currentValue: any
  suggestedValue: any
  confidence: 'high' | 'medium' | 'low'
  reason: string
  source: string[]
}

interface CRMSuggestionsPanelProps {
  accountSlug: string
  className?: string
  maxSuggestions?: number
  onViewAll?: () => void
}

export function CRMSuggestionsPanel({
  accountSlug,
  className = '',
  maxSuggestions = 5,
  onViewAll,
}: CRMSuggestionsPanelProps) {
  const API_URL = getApiUrl()
  const [suggestions, setSuggestions] = useState<CRMSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    loadSuggestions()
  }, [accountSlug])

  const loadSuggestions = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/accounts/${accountSlug}/crm/suggestions`)
      if (res.ok) {
        const data = await res.json()
        setSuggestions(data.suggestions || [])
      }
    } catch (error) {
      console.error('Failed to load suggestions:', error)
    } finally {
      setLoading(false)
    }
  }

  const applySuggestion = async (suggestion: CRMSuggestion) => {
    setApplying(suggestion.id)
    try {
      const res = await fetch(`${API_URL}/accounts/${accountSlug}/crm/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          patches: [{
            objectType: suggestion.objectType,
            objectName: suggestion.objectName,
            field: suggestion.field,
            before: suggestion.currentValue,
            after: suggestion.suggestedValue,
          }]
        }),
      })
      
      if (res.ok) {
        setSuggestions(prev => prev.filter(s => s.id !== suggestion.id))
      }
    } catch (error) {
      console.error('Failed to apply suggestion:', error)
    } finally {
      setApplying(null)
    }
  }

  const dismissSuggestion = (id: string) => {
    setDismissed(prev => new Set(prev).add(id))
  }

  const getConfidenceColor = (confidence: string) => {
    const colors = {
      high: 'text-green-600',
      medium: 'text-amber-600',
      low: 'text-orange-600',
    }
    return colors[confidence as keyof typeof colors] || 'text-gray-600'
  }

  const getConfidenceBadgeClass = (confidence: string) => {
    const colors = {
      high: 'bg-green-100 text-green-800 border-green-200',
      medium: 'bg-amber-100 text-amber-800 border-amber-200',
      low: 'bg-orange-100 text-orange-800 border-orange-200',
    }
    return colors[confidence as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const formatValue = (value: any) => {
    if (value === null || value === undefined || value === '') {
      return <span className="text-muted-foreground italic">empty</span>
    }
    if (typeof value === 'string' && value.length > 30) {
      return value.slice(0, 30) + '...'
    }
    return String(value)
  }

  const visibleSuggestions = suggestions
    .filter(s => !dismissed.has(s.id))
    .slice(0, maxSuggestions)

  const hasMore = suggestions.filter(s => !dismissed.has(s.id)).length > maxSuggestions

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Database className="h-4 w-4" />
            CRM Updates
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (visibleSuggestions.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Database className="h-4 w-4" />
            CRM Updates
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-6">
          <div className="flex flex-col items-center gap-2">
            <Check className="h-8 w-8 text-green-500" />
            <p className="text-sm text-muted-foreground">CRM is up to date</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Database className="h-4 w-4" />
            CRM Updates
            <Badge variant="outline" className="ml-1 text-xs">
              {suggestions.filter(s => !dismissed.has(s.id)).length}
            </Badge>
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6"
                  onClick={loadSuggestions}
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Refresh suggestions</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {visibleSuggestions.map((suggestion) => (
          <div
            key={suggestion.id}
            className="border rounded-lg p-3 text-sm space-y-2 bg-muted/30"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {suggestion.objectType}
                </Badge>
                <span className="font-medium truncate max-w-[120px]">
                  {suggestion.objectName}
                </span>
              </div>
              <Badge 
                variant="outline" 
                className={`text-xs ${getConfidenceBadgeClass(suggestion.confidence)}`}
              >
                {suggestion.confidence}
              </Badge>
            </div>

            {/* Field & Values */}
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">
                <code className="bg-muted px-1 rounded">{suggestion.field}</code>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-red-600 line-through">
                  {formatValue(suggestion.currentValue)}
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="text-green-600 font-medium">
                  {formatValue(suggestion.suggestedValue)}
                </span>
              </div>
            </div>

            {/* Reason (expandable) */}
            <button
              onClick={() => setExpanded(expanded === suggestion.id ? null : suggestion.id)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {expanded === suggestion.id ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              Why?
            </button>
            
            {expanded === suggestion.id && (
              <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                {suggestion.reason}
                <div className="mt-1 text-[10px]">
                  Source: {suggestion.source.join(', ')}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => dismissSuggestion(suggestion.id)}
              >
                <X className="h-3 w-3 mr-1" />
                Dismiss
              </Button>
              <Button
                variant="default"
                size="sm"
                className="h-7 text-xs"
                onClick={() => applySuggestion(suggestion)}
                disabled={applying === suggestion.id}
              >
                {applying === suggestion.id ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Check className="h-3 w-3 mr-1" />
                )}
                Apply
              </Button>
            </div>
          </div>
        ))}

        {/* View All link */}
        {(hasMore || onViewAll) && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={onViewAll}
          >
            View all CRM updates
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

// Compact inline suggestion for embedding
interface InlineCRMSuggestionProps {
  suggestion: CRMSuggestion
  onApply: () => void
  onDismiss: () => void
  applying?: boolean
}

export function InlineCRMSuggestion({
  suggestion,
  onApply,
  onDismiss,
  applying = false,
}: InlineCRMSuggestionProps) {
  return (
    <div className="flex items-center justify-between p-2 bg-amber-50 border border-amber-200 rounded text-sm">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <span>
          Update <strong>{suggestion.field}</strong> to{' '}
          <code className="bg-amber-100 px-1 rounded text-xs">
            {String(suggestion.suggestedValue).slice(0, 20)}
          </code>
        </span>
      </div>
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onDismiss}>
          Skip
        </Button>
        <Button size="sm" className="h-6 text-xs" onClick={onApply} disabled={applying}>
          {applying ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Apply'}
        </Button>
      </div>
    </div>
  )
}
