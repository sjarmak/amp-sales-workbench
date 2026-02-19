'use client'

import { cn } from '@/lib/utils'
import { LIFECYCLE_STAGES, getStageColorClass, getStageBorderClass } from '@/lib/lifecycle'
import type { LifecycleStageId } from '@/types/agent'
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react'

interface LifecycleStageTabsProps {
  currentStage: LifecycleStageId
  activeStage: LifecycleStageId
  onStageSelect: (stage: LifecycleStageId) => void
}

export function LifecycleStageTabs({ 
  currentStage, 
  activeStage, 
  onStageSelect 
}: LifecycleStageTabsProps) {
  
  // Find index of current stage to determine completed stages
  const currentStageIndex = LIFECYCLE_STAGES.findIndex(s => s.id === currentStage)

  return (
    <div className="space-y-1 py-2">
      {LIFECYCLE_STAGES.map((stage, index) => {
        const isActive = activeStage === stage.id
        const isCompleted = index < currentStageIndex
        const isCurrent = index === currentStageIndex
        const isFuture = index > currentStageIndex

        // Determine styles based on state
        const colorClass = getStageColorClass(stage.id).replace('bg-', 'text-')
        const borderClass = getStageBorderClass(stage.id)
        
        return (
          <button
            key={stage.id}
            onClick={() => onStageSelect(stage.id)}
            className={cn(
              "w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-3 relative group",
              isActive 
                ? "bg-accent text-accent-foreground" 
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
          >
            {/* Status Icon */}
            <div className="flex-shrink-0">
              {isCompleted ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : isCurrent ? (
                <div className={cn("h-4 w-4 rounded-full border-2 flex items-center justify-center", borderClass.replace('border-', 'border-'))}>
                  <div className={cn("h-2 w-2 rounded-full animate-pulse", colorClass.replace('text-', 'bg-'))} />
                </div>
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground/30" />
              )}
            </div>

            {/* Label */}
            <div className="flex-1 truncate">
              {stage.label}
            </div>

            {/* Active Indicator */}
            {isActive && (
              <ArrowRight className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
            
            {/* Active Border Line */}
            {isActive && (
              <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l-md", colorClass.replace('text-', 'bg-'))} />
            )}
          </button>
        )
      })}
    </div>
  )
}
