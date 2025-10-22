'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PreCallPrepTab } from '@/components/PreCallPrepTab'
import { AfterCallTab } from '@/components/AfterCallTab'
import { ProspectorTab } from '@/components/ProspectorTab'
import { CrmUpdatesTab } from '@/components/CrmUpdatesTab'
import { InsightsTab } from '@/components/InsightsTab'
import { CreateAccountDialog } from '@/components/CreateAccountDialog'
import { EditAccountDialog } from '@/components/EditAccountDialog'
import { DataSourceBadges } from '@/components/DataSourceBadges'
import { DataSourcesTab } from '@/components/DataSourcesTab'
import { AgentButton } from '@/components/AgentButton'
import { AddToNotionButton } from '@/components/AddToNotionButton'
import { AgentResultCard } from '@/components/AgentResultCard'
import { Loader2, Database, PhoneCall, FileText } from 'lucide-react'

const API_URL = 'http://localhost:3001/api'

interface Account {
  slug: string
  name: string
  capabilities: {
    salesforce: boolean
    gong: boolean
    notion: boolean
    amp: boolean
  }
}

export default function Home() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('quick-actions')
  const [loadingAgent, setLoadingAgent] = useState<string | null>(null)
  const [prospectorLogs, setProspectorLogs] = useState<string[]>([])
  const [prospectorRunning, setProspectorRunning] = useState(false)
  const [prospectorEventSource, setProspectorEventSource] = useState<EventSource | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [showNotionButton, setShowNotionButton] = useState(false)
  const [lastSuccessfulAgent, setLastSuccessfulAgent] = useState<string | null>(null)

  const loadAccounts = () => {
    fetch(`${API_URL}/accounts`)
      .then((res) => res.json())
      .then((data) => {
        setAccounts(data)
        
        // Try to restore previously selected account from localStorage
        const savedSlug = localStorage.getItem('selectedAccountSlug')
        if (savedSlug) {
          const savedAccount = data.find((a: Account) => a.slug === savedSlug)
          if (savedAccount) {
            setSelectedAccount(savedAccount)
            return
          }
        }
        
        // Fallback to first account
        if (data.length > 0 && !selectedAccount) {
          setSelectedAccount(data[0])
        }
      })
  }

  useEffect(() => {
    loadAccounts()
  }, [])

  const runProspector = () => {
    if (!selectedAccount) return

    setProspectorRunning(true)
    setProspectorLogs([])
    setActiveTab('research')

    const eventSource = new EventSource(`${API_URL}/agents/prospector/stream?accountName=${encodeURIComponent(selectedAccount.name)}`)
    setProspectorEventSource(eventSource)

    eventSource.onmessage = (event) => {
      const message = JSON.parse(event.data)

      if (message.type === 'log') {
        setProspectorLogs((prev) => [...prev, message.data])
      } else if (message.type === 'complete') {
        setProspectorRunning(false)
        setProspectorEventSource(null)
        eventSource.close()
        if (message.success) {
          setProspectorLogs((prev) => [...prev, '\n✓ Research complete! Files generated.'])
        } else {
          setProspectorLogs((prev) => [...prev, `\n✗ Error: ${message.error}`])
        }
      } else if (message.type === 'error') {
        setProspectorLogs((prev) => [...prev, `✗ Error: ${message.error}`])
        setProspectorRunning(false)
        setProspectorEventSource(null)
        eventSource.close()
      }
    }

    eventSource.onerror = () => {
      setProspectorLogs((prev) => [...prev, '✗ Connection error'])
      setProspectorRunning(false)
      setProspectorEventSource(null)
      eventSource.close()
    }
  }

  const cancelProspector = () => {
    if (prospectorEventSource) {
      prospectorEventSource.close()
      setProspectorEventSource(null)
    }
    setProspectorRunning(false)
    setProspectorLogs((prev) => [...prev, '\n⚠ Cancelled by user'])
  }

  const runAgent = async (agent: string, options = {}) => {
    if (!selectedAccount) return

    setLoading(true)
    setLoadingAgent(agent)
    try {
      const res = await fetch(`${API_URL}/agents/${agent}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountName: selectedAccount.name, ...options }),
      })
      const result = await res.json()
      if (result.success) {
        // Show Notion button for agents that generate content
        const contentGeneratingAgents = [
          'precall-brief', 'postcall', 'exec-summary', 'deal-review', 
          'qualification', 'handoff', 'email', 'coaching', 'demo-ideas'
        ]
        if (contentGeneratingAgents.includes(agent)) {
          setShowNotionButton(true)
          setLastSuccessfulAgent(agent)
        }

        // Trigger data source refresh for full-refresh agent
        if (agent === 'full-refresh') {
          setRefreshTrigger(prev => prev + 1)
          alert(`✅ Full refresh completed successfully!\n\nData sources have been updated.`)
        } else {
          alert(`✅ ${agent} completed successfully!\n\nCheck the Prep, After Call, or CRM tabs for updated data.`)
        }
      } else {
        alert(`❌ Error running ${agent}:\n\n${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      alert(`❌ Failed to run ${agent}:\n\n${error}`)
    } finally {
      setLoading(false)
      setLoadingAgent(null)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Amp Sales Workbench</h1>
          <div className="flex items-center gap-3">
            <CreateAccountDialog onAccountCreated={loadAccounts} />
            <div className="flex items-center gap-2">
              <div className="w-64">
                <Select value={selectedAccount?.slug} onValueChange={(slug) => {
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
              </div>
              {selectedAccount && (
                <EditAccountDialog 
                  account={selectedAccount}
                  onAccountUpdated={loadAccounts}
                />
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {selectedAccount && (
          <div className="mb-6 space-y-4">
            <DataSourceBadges
              accountSlug={selectedAccount.slug}
              capabilities={selectedAccount.capabilities}
              refreshTrigger={refreshTrigger}
            />
            
            {/* Show Add to Notion button after successful agent run */}
            {showNotionButton && (
              <Card className="border-green-200 bg-green-50">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-green-900">
                        {lastSuccessfulAgent && lastSuccessfulAgent.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} Complete
                      </h3>
                      <p className="text-sm text-green-700">
                        Save this output to your Notion workspace for team collaboration
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <AddToNotionButton
                        accountSlug={selectedAccount.slug}
                        accountName={selectedAccount.name}
                        variant="default"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowNotionButton(false)}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="quick-actions">Quick Actions</TabsTrigger>
            <TabsTrigger value="prep">Pre-Call Brief</TabsTrigger>
            <TabsTrigger value="research">Prospector Results</TabsTrigger>
            <TabsTrigger value="data-sources">Data Sources</TabsTrigger>
            <TabsTrigger value="after-call">After Call</TabsTrigger>
            <TabsTrigger value="crm">CRM Updates</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="quick-actions">
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Pre-Call</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button 
                    className="w-full" 
                    variant="outline"
                    onClick={runProspector}
                    disabled={prospectorRunning}
                    title="Run Amp prospector agent to gather publicly available intel about the account and generate documents in the Research tab"
                  >
                    {prospectorRunning ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Running...
                      </span>
                    ) : 'Run Prospector'}
                  </Button>
                  <AgentButton
                  name="precall-brief"
                  label="Create Pre-Call Brief"
                  description="Generate a comprehensive pre-call brief with account context, recent activity, and talking points"
                  loading={loadingAgent === 'precall-brief'}
                  disabled={loading}
                  onClick={() => runAgent('precall-brief')}
                  variant="outline"
                  requires={{ salesforce: true, gong: true, notion: true }}
                  capabilities={selectedAccount?.capabilities}
                  />
                  <AgentButton
                    name="demo-ideas"
                    label="Demo Ideas"
                    description="Generate tailored demo ideas based on account profile and industry"
                    loading={loadingAgent === 'demo-ideas'}
                    disabled={loading}
                    onClick={() => runAgent('demo-ideas')}
                    variant="outline"
                    requires={{ salesforce: true, notion: true }}
                    capabilities={selectedAccount?.capabilities}
                  />
                  <AgentButton
                    name="qualification"
                    label="Qualification"
                    description="Assess deal qualification using MEDDIC, BANT, or SPICED framework"
                    loading={loadingAgent === 'qualification'}
                    disabled={loading}
                    onClick={() => runAgent('qualification')}
                    variant="outline"
                    requires={{ salesforce: true, gong: true }}
                    capabilities={selectedAccount?.capabilities}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Post-Call</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <AgentButton
                  name="postcall"
                  label="Post-Call Update"
                  description="Analyze the most recent call and update CRM with action items and next steps"
                  loading={loadingAgent === 'postcall'}
                  disabled={loading}
                  onClick={() => runAgent('postcall')}
                  variant="outline"
                  requires={{ gong: true }}
                    capabilities={selectedAccount?.capabilities}
                   />
                  <AgentButton
                    name="email"
                    label="Follow-Up Email"
                    description="Draft a personalized follow-up email based on recent call and account context"
                    loading={loadingAgent === 'email'}
                    disabled={loading}
                    onClick={() => runAgent('email')}
                    variant="outline"
                    requires={{ salesforce: true, gong: true }}
                    capabilities={selectedAccount?.capabilities}
                  />
                  <AgentButton
                    name="coaching"
                    label="Coaching"
                    description="Get AI coaching feedback on recent call performance and areas to improve"
                    loading={loadingAgent === 'coaching'}
                    disabled={loading}
                    onClick={() => runAgent('coaching')}
                    variant="outline"
                    requires={{ gong: true }}
                    capabilities={selectedAccount?.capabilities}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Analysis</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <AgentButton
                    name="exec-summary"
                    label="Exec Summary"
                    description="Generate executive summary of account status, opportunities, and key risks"
                    loading={loadingAgent === 'exec-summary'}
                    disabled={loading}
                    onClick={() => runAgent('exec-summary')}
                    variant="outline"
                    requires={{ salesforce: true }}
                    capabilities={selectedAccount?.capabilities}
                  />
                  <AgentButton
                    name="deal-review"
                    label="Deal Review"
                    description="Comprehensive deal health analysis with risks, momentum, and recommended actions"
                    loading={loadingAgent === 'deal-review'}
                    disabled={loading}
                    onClick={() => runAgent('deal-review')}
                    variant="outline"
                    requires={{ salesforce: true, gong: true }}
                    capabilities={selectedAccount?.capabilities}
                  />
                  <AgentButton
                    name="closedlost"
                    label="Closed-Lost"
                    description="Analyze closed-lost opportunities to identify patterns and lessons learned"
                    loading={loadingAgent === 'closedlost'}
                    disabled={loading}
                    onClick={() => runAgent('closedlost')}
                    variant="outline"
                    requires={{ salesforce: true, gong: true }}
                    capabilities={selectedAccount?.capabilities}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">CRM</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <AgentButton
                    name="backfill"
                    label="AI Backfill"
                    description="Automatically populate missing CRM fields using data from calls and documents"
                    loading={loadingAgent === 'backfill'}
                    disabled={loading}
                    onClick={() => runAgent('backfill')}
                    variant="outline"
                    requires={{ salesforce: true, gong: true }}
                    capabilities={selectedAccount?.capabilities}
                  />
                  <AgentButton
                    name="handoff"
                    label="Handoff Doc"
                    description="Create handoff documentation for transitions between sales stages or team members"
                    loading={loadingAgent === 'handoff'}
                    disabled={loading}
                    onClick={() => runAgent('handoff')}
                    variant="outline"
                    requires={{ salesforce: true }}
                    capabilities={selectedAccount?.capabilities}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="prep">
            <PreCallPrepTab accountSlug={selectedAccount?.slug} accountName={selectedAccount?.name} />
          </TabsContent>

          <TabsContent value="research">
            <ProspectorTab 
              accountSlug={selectedAccount?.slug}
              logs={prospectorLogs}
              isRunning={prospectorRunning}
              onRun={runProspector}
              onCancel={cancelProspector}
            />
          </TabsContent>

          <TabsContent value="data-sources">
            <DataSourcesTab accountSlug={selectedAccount?.slug} />
          </TabsContent>

          <TabsContent value="after-call">
            <AfterCallTab accountSlug={selectedAccount?.slug} />
          </TabsContent>

          <TabsContent value="crm">
            {selectedAccount ? (
              <CrmUpdatesTab accountSlug={selectedAccount.slug} />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>CRM Updates</CardTitle>
                  <CardDescription>Select an account to view CRM updates</CardDescription>
                </CardHeader>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="insights">
            {selectedAccount ? (
              <InsightsTab 
                accountSlug={selectedAccount.slug}
                accountName={selectedAccount.name}
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Account Insights</CardTitle>
                  <CardDescription>Select an account to view insights</CardDescription>
                </CardHeader>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
