'use client'

import { useState } from 'react'
import { Button } from './ui/button'
import { FileText, Loader2, CheckCircle, ExternalLink } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'

const API_URL = 'http://localhost:3001/api'

interface AddToNotionButtonProps {
  accountSlug: string
  accountName: string
  variant?: 'default' | 'outline' | 'secondary'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
}

export function AddToNotionButton({
  accountSlug,
  accountName,
  variant = 'outline',
  size = 'default',
  className = ''
}: AddToNotionButtonProps) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [notionUrl, setNotionUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAddToNotion = async () => {
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch(`${API_URL}/accounts/${accountSlug}/notion/mirror`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountName }),
      })

      const result = await res.json()

      if (result.success) {
        setSuccess(true)
        setNotionUrl(result.notionPageUrl || null)
        
        // Reset success state after 5 seconds
        setTimeout(() => {
          setSuccess(false)
        }, 5000)
      } else {
        setError(result.error || 'Failed to add to Notion')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  if (success && notionUrl) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size={size}
              className={`${className} border-green-500 text-green-600 hover:bg-green-50`}
              onClick={() => window.open(notionUrl, '_blank')}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Added to Notion
              <ExternalLink className="ml-2 h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Click to open in Notion</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  if (error) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={variant}
              size={size}
              className={className}
              onClick={handleAddToNotion}
              disabled={loading}
            >
              <FileText className="mr-2 h-4 w-4" />
              Retry Add to Notion
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-red-500">{error}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size={size}
            className={className}
            onClick={handleAddToNotion}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Add to Notion
              </>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Save this brief to your Notion workspace</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
