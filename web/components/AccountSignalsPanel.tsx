'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'
import { ProductBadges } from './ProductFocusChips'
import { 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  Users, 
  Calendar, 
  DollarSign,
  Target,
  Shield,
  Clock,
  Building2,
  Phone,
  Mail,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Loader2
} from 'lucide-react'
import type { LifecycleStageId, ProductId } from '@/types/agent'

const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    return `http://${window.location.hostname}:3001/api`
  }
  return 'http://localhost:3001/api'
}

interface AccountSignals {
  account?: {
    name: string
    industry?: string
    employees?: number
    revenue?: number
    website?: string
  }
  opportunity?: {
    name: string
    stage: string
    amount?: number
    closeDate?: string
    probability?: number
  }
  contacts?: Array<{
    name: string
    title?: string
    role?: 'champion' | 'decision_maker' | 'influencer' | 'blocker' | 'user'
  }>
  recentCalls?: Array<{
    id: string
    title: string
    date: string
  }>
  dealHealth?: {
    score: number
    trend: 'up' | 'down' | 'stable'
    risks: string[]
  }
  meddic?: {
    metrics: number
    economicBuyer: boolean
    decisionCriteria: number
    decisionProcess: number
    identifyPain: number
    champion: boolean
    overall: number
  }
  products?: ProductId[]
  stage?: LifecycleStageId
}

interface AccountSignalsPanelProps {
  accountSlug: string
  className?: string
}

export function AccountSignalsPanel({ accountSlug, className = '' }: AccountSignalsPanelProps) {
  const API_URL = getApiUrl()
  const [signals, setSignals] = useState<AccountSignals | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchSignals = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const res = await fetch(`${API_URL}/accounts/${accountSlug}/signals`)
        if (!res.ok) {
          throw new Error('Failed to load signals')
        }
        const data = await res.json()
        setSignals(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        setSignals(null)
      } finally {
        setLoading(false)
      }
    }

    if (accountSlug) {
      fetchSignals()
    }
  }, [accountSlug, API_URL])

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-8 ${className}`}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !signals) {
    return (
      <div className={`text-center py-8 text-muted-foreground ${className}`}>
        <p className="text-sm">Unable to load account signals</p>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Account Summary */}
      {signals.account && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="font-medium">{signals.account.name}</div>
            {signals.account.industry && (
              <div className="text-muted-foreground">{signals.account.industry}</div>
            )}
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {signals.account.employees && (
                <span>{signals.account.employees.toLocaleString()} employees</span>
              )}
              {signals.account.revenue && (
                <span>${(signals.account.revenue / 1000000).toFixed(1)}M revenue</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Opportunity Summary */}
      {signals.opportunity && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              Opportunity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="font-medium">{signals.opportunity.name}</div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{signals.opportunity.stage}</Badge>
              {signals.opportunity.probability && (
                <span className="text-xs text-muted-foreground">
                  {signals.opportunity.probability}% prob
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              {signals.opportunity.amount && (
                <div className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  ${signals.opportunity.amount.toLocaleString()}
                </div>
              )}
              {signals.opportunity.closeDate && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(signals.opportunity.closeDate).toLocaleDateString()}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Deal Health */}
      {signals.dealHealth && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Deal Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold ${
                  signals.dealHealth.score >= 70 ? 'text-green-600' :
                  signals.dealHealth.score >= 40 ? 'text-amber-600' :
                  'text-red-600'
                }`}>
                  {signals.dealHealth.score}
                </span>
                <span className="text-sm text-muted-foreground">/100</span>
              </div>
              {signals.dealHealth.trend === 'up' && (
                <TrendingUp className="h-5 w-5 text-green-500" />
              )}
              {signals.dealHealth.trend === 'down' && (
                <TrendingDown className="h-5 w-5 text-red-500" />
              )}
            </div>
            
            {signals.dealHealth.risks.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Risks</div>
                {signals.dealHealth.risks.slice(0, 3).map((risk, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                    <span>{risk}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* MEDDIC Score */}
      {signals.meddic && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">MEDDIC Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <MeddicItem label="Metrics" score={signals.meddic.metrics} />
              <MeddicItem label="Economic Buyer" found={signals.meddic.economicBuyer} />
              <MeddicItem label="Decision Criteria" score={signals.meddic.decisionCriteria} />
              <MeddicItem label="Decision Process" score={signals.meddic.decisionProcess} />
              <MeddicItem label="Identify Pain" score={signals.meddic.identifyPain} />
              <MeddicItem label="Champion" found={signals.meddic.champion} />
            </div>
            <div className="mt-3 pt-3 border-t flex justify-between items-center">
              <span className="text-sm font-medium">Overall</span>
              <span className={`text-lg font-bold ${
                signals.meddic.overall >= 70 ? 'text-green-600' :
                signals.meddic.overall >= 40 ? 'text-amber-600' :
                'text-red-600'
              }`}>
                {signals.meddic.overall}%
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Stakeholders */}
      {signals.contacts && signals.contacts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Key Stakeholders
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {signals.contacts.slice(0, 5).map((contact, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">{contact.name}</div>
                  {contact.title && (
                    <div className="text-xs text-muted-foreground">{contact.title}</div>
                  )}
                </div>
                {contact.role && (
                  <RoleBadge role={contact.role} />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent Calls */}
      {signals.recentCalls && signals.recentCalls.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Recent Calls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {signals.recentCalls.slice(0, 4).map((call, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <Clock className="h-3 w-3 mt-1 text-muted-foreground shrink-0" />
                <div>
                  <div className="font-medium line-clamp-1">{call.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(call.date).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Products of Interest */}
      {signals.products && signals.products.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Products of Interest</CardTitle>
          </CardHeader>
          <CardContent>
            <ProductBadges products={signals.products} size="sm" />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Helper components

interface MeddicItemProps {
  label: string
  score?: number
  found?: boolean
}

function MeddicItem({ label, score, found }: MeddicItemProps) {
  const hasScore = score !== undefined
  const isGood = hasScore ? score >= 70 : found

  return (
    <div className="flex items-center justify-between p-2 rounded bg-muted/50">
      <span className="text-muted-foreground">{label}</span>
      {hasScore ? (
        <span className={`font-medium ${
          score >= 70 ? 'text-green-600' :
          score >= 40 ? 'text-amber-600' :
          'text-red-600'
        }`}>
          {score}%
        </span>
      ) : (
        found ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : (
          <HelpCircle className="h-4 w-4 text-muted-foreground" />
        )
      )}
    </div>
  )
}

interface RoleBadgeProps {
  role: 'champion' | 'decision_maker' | 'influencer' | 'blocker' | 'user'
}

function RoleBadge({ role }: RoleBadgeProps) {
  const config: Record<string, { label: string; className: string }> = {
    champion: { label: 'Champion', className: 'bg-green-100 text-green-800' },
    decision_maker: { label: 'DM', className: 'bg-blue-100 text-blue-800' },
    influencer: { label: 'Influencer', className: 'bg-purple-100 text-purple-800' },
    blocker: { label: 'Blocker', className: 'bg-red-100 text-red-800' },
    user: { label: 'User', className: 'bg-gray-100 text-gray-800' },
  }
  
  const { label, className } = config[role] || { label: role, className: 'bg-gray-100 text-gray-800' }
  
  return (
    <Badge variant="outline" className={`text-xs ${className}`}>
      {label}
    </Badge>
  )
}
