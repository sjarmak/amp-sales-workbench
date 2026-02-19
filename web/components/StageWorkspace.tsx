'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LIFECYCLE_STAGES } from '@/lib/lifecycle'
import type { LifecycleStageId } from '@/types/agent'
import { AgentButton } from './AgentButton'

interface StageWorkspaceProps {
  accountSlug: string
  stageId: LifecycleStageId
  capabilities: any
  onRunAgent: (agentId: string) => void
  loadingAgent: string | null
}

export function StageWorkspace({ 
  accountSlug, 
  stageId, 
  capabilities,
  onRunAgent,
  loadingAgent
}: StageWorkspaceProps) {
  
  const stage = LIFECYCLE_STAGES.find(s => s.id === stageId)
  
  if (!stage) return null

  return (
    <div className="space-y-6 h-full overflow-y-auto p-1">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">{stage.label}</h2>
        <p className="text-muted-foreground">
          {stage.description}
        </p>
      </div>

      <div className="grid gap-6">
        {/* Quick Actions for this stage */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
            <CardDescription>Recommended agents for this stage</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stage.quickActions.map(agentId => (
              <AgentButton
                key={agentId}
                name={agentId}
                label={agentId.split('_').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')}
                description={`Run ${agentId.replace('_', ' ')} agent`}
                loading={loadingAgent === agentId}
                disabled={!!loadingAgent}
                onClick={() => onRunAgent(agentId)}
                variant="outline"
                requires={{}}
                capabilities={capabilities}
                dataAvailable={{}} // TODO: Pass actual availability
              />
            ))}
          </CardContent>
        </Card>

        {/* Artifacts Section (Placeholder) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Stage Artifacts</CardTitle>
            <CardDescription>Documents and data generated in this stage</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground italic text-center py-8">
              No artifacts generated yet for {stage.label}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
