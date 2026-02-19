'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CreateAccountDialog } from '@/components/CreateAccountDialog'
import { EditAccountDialog } from '@/components/EditAccountDialog'
import { DataSourceBadges } from '@/components/DataSourceBadges'
import { LifecycleStageTabs } from '@/components/LifecycleStageTabs'
import { StageWorkspace } from '@/components/StageWorkspace'
import { LiveQnaPanel } from '@/components/LiveQnaPanel'
import { Loader2, Beaker } from 'lucide-react'
import Link from 'next/link'
import type { LifecycleStageId } from '@/types/agent'

// Use window.location.hostname to work on mobile
const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    return `http://${window.location.hostname}:3001/api`
  }
  return 'http://localhost:3001/api'
}

interface Account {
  slug: string
  name: string
  capabilities: {
    salesforce: boolean
    gong: boolean
    notion: boolean
    sourcegraph: boolean
  }
}

export default function Home() {
  const API_URL = getApiUrl()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)
  const [accountsLoading, setAccountsLoading] = useState(true)
  const [activeStage, setActiveStage] = useState<LifecycleStageId>('prospecting')
  const [currentStage, setCurrentStage] = useState<LifecycleStageId>('prospecting')
  const [products, setProducts] = useState<string[]>([])
  
  // Agent execution state
  const [loadingAgent, setLoadingAgent] = useState<string | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Load accounts
  const loadAccounts = () => {
    fetch(`${API_URL}/accounts`)
      .then((res) => res.json())
      .then((data) => {
        setAccounts(data)
        
        // Try to restore previously selected account
        const savedSlug = localStorage.getItem('selectedAccountSlug')
        if (savedSlug) {
          const savedAccount = data.find((a: Account) => a.slug === savedSlug)
          if (savedAccount) {
            setSelectedAccount(savedAccount)
            setAccountsLoading(false)
            return
          }
        }
        
        // Fallback to first account
        if (data.length > 0) {
          setSelectedAccount(data[0])
        }
        setAccountsLoading(false)
      })
      .catch(err => {
        console.error('Failed to load accounts:', err)
        setAccountsLoading(false)
      })
  }

  useEffect(() => {
    loadAccounts()
  }, [])

  // Load account context when account changes
  useEffect(() => {
    if (selectedAccount) {
      fetch(`${API_URL}/accounts/${selectedAccount.slug}/context`)
        .then(res => res.json())
        .then(context => {
          if (context) {
            setCurrentStage(context.stage)
            setActiveStage(context.stage)
            setProducts(context.products || [])
          }
        })
        .catch(err => console.error('Failed to load context:', err))
    }
  }, [selectedAccount])

  const runAgent = async (agentId: string) => {
    if (!selectedAccount) return

    setLoadingAgent(agentId)
    try {
      const res = await fetch(`${API_URL}/accounts/${selectedAccount.slug}/agents/${agentId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const result = await res.json()
      
      if (result.success) {
        setRefreshTrigger(prev => prev + 1)
        // TODO: Show result notification or artifact
      } else {
        console.error('Agent failed:', result.error)
        alert(`Agent failed: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to run agent:', error)
      alert(`Failed to run agent: ${error}`)
    } finally {
      setLoadingAgent(null)
    }
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="border-b h-16 flex-shrink-0 bg-background z-10">
        <div className="h-full px-6 flex items-center justify-between">
          <h1 className="text-xl font-bold">Sourcegraph Sales Workbench</h1>
          <div className="flex items-center gap-3">
            <Link 
              href="/lab" 
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Beaker className="h-4 w-4" />
              Agent Lab
            </Link>
            {selectedAccount && (
              <EditAccountDialog 
                account={selectedAccount}
                onAccountUpdated={loadAccounts}
              />
            )}
            <CreateAccountDialog onAccountCreated={loadAccounts} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-12 divide-x min-h-0">
        
        {/* Left: Context & Navigation (3 cols) */}
        <div className="col-span-3 flex flex-col bg-muted/10">
          <div className="p-6 border-b space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Account</label>
              {accountsLoading ? (
                <div className="flex h-10 w-full items-center justify-center rounded-md border border-input bg-background px-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading...
                </div>
              ) : (
                <Select value={selectedAccount?.slug || ''} onValueChange={(slug) => {
                  const account = accounts.find(a => a.slug === slug)
                  if (account) {
                    setSelectedAccount(account)
                    localStorage.setItem('selectedAccountSlug', slug)
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.slug} value={account.slug}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="flex-1 p-4 overflow-y-auto">
            <div className="mb-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Lifecycle Stages
            </div>
            <LifecycleStageTabs
              currentStage={currentStage}
              activeStage={activeStage}
              onStageSelect={setActiveStage}
            />
          </div>
        </div>

        {/* Center: Workspace (6 cols) */}
        <div className="col-span-6 flex flex-col bg-background">
          {selectedAccount ? (
            <StageWorkspace
              accountSlug={selectedAccount.slug}
              stageId={activeStage}
              capabilities={selectedAccount.capabilities}
              onRunAgent={runAgent}
              loadingAgent={loadingAgent}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Select an account to start
            </div>
          )}
        </div>

        {/* Right: Quick Actions & Live Q&A (3 cols) */}
        <div className="col-span-3 flex flex-col bg-muted/10 h-full">
          <div className="flex-1 p-4 min-h-0 flex flex-col gap-4">
            {selectedAccount && (
              <>
                <div className="flex-shrink-0">
                  <LiveQnaPanel
                    accountSlug={selectedAccount.slug}
                    accountName={selectedAccount.name}
                    stage={currentStage}
                    products={products}
                  />
                </div>
                
                <div className="flex-shrink-0">
                  <Card>
                    <CardContent className="p-4">
                      <DataSourceBadges
                        accountSlug={selectedAccount.slug}
                        capabilities={selectedAccount.capabilities}
                        refreshTrigger={refreshTrigger}
                      />
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
