'use client'

import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Database, PhoneCall, FileText, AlertCircle, Loader2 } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'

interface AgentButtonProps {
  name: string
  label: string
  description?: string
  loading: boolean
  disabled: boolean
  onClick: () => void
  variant?: 'default' | 'outline'
  requires?: {
    salesforce?: boolean
    gong?: boolean
    notion?: boolean
  }
  capabilities?: {
    salesforce: boolean
    gong: boolean
    notion: boolean
  }
}

export function AgentButton({
  name,
  label,
  description,
  loading,
  disabled,
  onClick,
  variant = 'default',
  requires = {},
  capabilities = { salesforce: false, gong: false, notion: false }
}: AgentButtonProps) {
  const missingRequirements = []
  if (requires.salesforce && !capabilities.salesforce) missingRequirements.push('Salesforce')
  if (requires.gong && !capabilities.gong) missingRequirements.push('Gong')
  if (requires.notion && !capabilities.notion) missingRequirements.push('Notion')
  
  const hasMissingRequirements = missingRequirements.length > 0
  const requiresAny = Object.values(requires).some(Boolean)

  const buttonContent = (
    <div className="relative group">
      <Button
        className="w-full"
        variant={variant}
        onClick={onClick}
        disabled={disabled || loading || hasMissingRequirements}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Running...
          </>
        ) : label}
      </Button>
      
      {requiresAny && (
        <div className="flex gap-1 mt-1 justify-center">
          {requires.salesforce && (
            <Database className={`h-3 w-3 ${capabilities.salesforce ? 'text-green-500' : 'text-muted-foreground'}`} />
          )}
          {requires.gong && (
            <PhoneCall className={`h-3 w-3 ${capabilities.gong ? 'text-green-500' : 'text-muted-foreground'}`} />
          )}
          {requires.notion && (
            <FileText className={`h-3 w-3 ${capabilities.notion ? 'text-green-500' : 'text-muted-foreground'}`} />
          )}
        </div>
      )}
      
      {hasMissingRequirements && (
        <div className="absolute -top-2 -right-2 z-10">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div className="bg-yellow-500 text-white rounded-full p-1">
                  <AlertCircle className="h-3 w-3" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Missing: {missingRequirements.join(', ')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
    </div>
  )
  
  if (description) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {buttonContent}
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-sm max-w-xs">{description}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }
  
  return buttonContent
}
