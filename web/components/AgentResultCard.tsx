'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { AddToNotionButton } from './AddToNotionButton'

interface AgentResultCardProps {
  accountSlug?: string
  accountName?: string
  title: string
  description?: string
  children: React.ReactNode
  showNotionButton?: boolean
}

export function AgentResultCard({
  accountSlug,
  accountName,
  title,
  description,
  children,
  showNotionButton = false
}: AgentResultCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {showNotionButton && accountSlug && accountName && (
            <AddToNotionButton
              accountSlug={accountSlug}
              accountName={accountName}
              variant="outline"
              size="sm"
            />
          )}
        </div>
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  )
}
