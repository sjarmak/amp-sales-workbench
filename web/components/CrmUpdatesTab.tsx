'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  ChevronDown, 
  ChevronRight,
  Loader2,
  Filter,
  Calendar
} from 'lucide-react'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from './ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'

interface Patch {
  id: string
  objectType: 'Account' | 'Contact' | 'Opportunity'
  objectId?: string
  objectName: string
  field: string
  before: any
  after: any
  confidence: 'high' | 'medium' | 'low'
  source: string[]
  reasoning?: string
  status: 'pending' | 'applied' | 'rejected'
}

interface DraftInfo {
  file: string
  generatedAt: string
  approved: boolean
}

interface HistoryEntry {
  appliedAt: string
  changes: Array<{
    objectType: string
    objectId: string
    success: boolean
    fieldsUpdated?: string[]
    error?: string
  }>
  errors?: string[]
}

interface CrmUpdatesTabProps {
  accountSlug: string
}

export function CrmUpdatesTab({ accountSlug }: CrmUpdatesTabProps) {
  const [drafts, setDrafts] = useState<Patch[]>([])
  const [draftInfo, setDraftInfo] = useState<DraftInfo | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [expandedPatch, setExpandedPatch] = useState<string | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [selectedPatches, setSelectedPatches] = useState<Set<string>>(new Set())
  
  // Filters
  const [objectTypeFilter, setObjectTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [confidenceFilter, setConfidenceFilter] = useState<string>('all')

  useEffect(() => {
    loadData()
  }, [accountSlug])

  const loadData = async () => {
    setLoading(true)
    try {
      const [draftsRes, historyRes] = await Promise.all([
        fetch(`http://localhost:3001/api/accounts/${accountSlug}/crm/drafts`),
        fetch(`http://localhost:3001/api/accounts/${accountSlug}/crm/history`)
      ])

      if (draftsRes.ok) {
        const data = await draftsRes.json()
        setDrafts(data.drafts || [])
        setDraftInfo(data.latest)
      }

      if (historyRes.ok) {
        const data = await historyRes.json()
        setHistory(data.history || [])
      }
    } catch (error) {
      console.error('Failed to load CRM data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApply = async () => {
    setApplying(true)
    try {
      const res = await fetch(`http://localhost:3001/api/accounts/${accountSlug}/crm/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patchIds: Array.from(selectedPatches) })
      })

      if (res.ok) {
        await loadData()
        setSelectedPatches(new Set())
      }
    } catch (error) {
      console.error('Failed to apply patches:', error)
    } finally {
      setApplying(false)
      setShowConfirmDialog(false)
    }
  }

  const togglePatchSelection = (patchId: string) => {
    const newSelection = new Set(selectedPatches)
    if (newSelection.has(patchId)) {
      newSelection.delete(patchId)
    } else {
      newSelection.add(patchId)
    }
    setSelectedPatches(newSelection)
  }

  const selectAllFiltered = () => {
    const filtered = getFilteredDrafts()
    const newSelection = new Set(selectedPatches)
    filtered.forEach(p => newSelection.add(p.id))
    setSelectedPatches(newSelection)
  }

  const deselectAll = () => {
    setSelectedPatches(new Set())
  }

  const getFilteredDrafts = () => {
    return drafts.filter(draft => {
      if (objectTypeFilter !== 'all' && draft.objectType !== objectTypeFilter) return false
      if (statusFilter !== 'all' && draft.status !== statusFilter) return false
      if (confidenceFilter !== 'all' && draft.confidence !== confidenceFilter) return false
      return true
    })
  }

  const getConfidenceBadge = (confidence: string) => {
    const colors = {
      high: 'bg-green-100 text-green-800 border-green-300',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      low: 'bg-orange-100 text-orange-800 border-orange-300'
    }
    return <Badge className={colors[confidence as keyof typeof colors] || ''}>{confidence}</Badge>
  }

  const formatValue = (value: any) => {
    if (value === null || value === undefined || value === '') return <span className="text-muted-foreground italic">empty</span>
    if (typeof value === 'string' && value.length > 100) {
      return value.slice(0, 100) + '...'
    }
    return String(value)
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const filteredDrafts = getFilteredDrafts()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">CRM Updates</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Review and apply proposed changes to Salesforce
          </p>
        </div>
        {draftInfo && (
          <div className="text-right text-sm text-muted-foreground">
            <div>Generated {formatTimestamp(draftInfo.generatedAt)}</div>
            <div className="flex items-center gap-2 justify-end mt-1">
              {draftInfo.approved ? (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Approved
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                  <Clock className="h-3 w-3 mr-1" /> Pending Review
                </Badge>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Object Type</label>
              <Select value={objectTypeFilter} onValueChange={setObjectTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Account">Account</SelectItem>
                  <SelectItem value="Contact">Contact</SelectItem>
                  <SelectItem value="Opportunity">Opportunity</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="applied">Applied</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Confidence</label>
              <Select value={confidenceFilter} onValueChange={setConfidenceFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Confidence</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Draft Patches Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Draft Patches</CardTitle>
              <CardDescription>
                {filteredDrafts.length} proposed change{filteredDrafts.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
            {filteredDrafts.length > 0 && (
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={selectAllFiltered}
                >
                  Select All
                </Button>
                {selectedPatches.size > 0 && (
                  <>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={deselectAll}
                    >
                      Deselect All
                    </Button>
                    <Button 
                      size="sm"
                      onClick={() => setShowConfirmDialog(true)}
                      disabled={applying}
                    >
                      {applying ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Applying...
                        </>
                      ) : (
                        `Apply ${selectedPatches.size} Change${selectedPatches.size !== 1 ? 's' : ''}`
                      )}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filteredDrafts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No draft patches found. Generate drafts using the workbench agents.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDrafts.map((patch) => (
                <div 
                  key={patch.id}
                  className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <input
                        type="checkbox"
                        checked={selectedPatches.has(patch.id)}
                        onChange={() => togglePatchSelection(patch.id)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">{patch.objectType}</Badge>
                          <span className="font-medium">{patch.objectName}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          <code className="text-sm bg-muted px-2 py-0.5 rounded">{patch.field}</code>
                          {getConfidenceBadge(patch.confidence)}
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-start gap-2">
                            <div className="text-xs text-muted-foreground w-16">Before:</div>
                            <div className="text-sm flex-1 font-mono bg-red-50 px-2 py-1 rounded border border-red-200">
                              {formatValue(patch.before)}
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <div className="text-xs text-muted-foreground w-16">After:</div>
                            <div className="text-sm flex-1 font-mono bg-green-50 px-2 py-1 rounded border border-green-200">
                              {formatValue(patch.after)}
                            </div>
                          </div>
                        </div>
                        
                        {patch.reasoning && (
                          <button
                            onClick={() => setExpandedPatch(expandedPatch === patch.id ? null : patch.id)}
                            className="flex items-center gap-1 text-xs text-muted-foreground mt-2 hover:text-foreground"
                          >
                            {expandedPatch === patch.id ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronRight className="h-3 w-3" />
                            )}
                            Show reasoning
                          </button>
                        )}
                        
                        {expandedPatch === patch.id && patch.reasoning && (
                          <div className="mt-2 text-sm text-muted-foreground bg-muted p-3 rounded">
                            {patch.reasoning}
                            <div className="mt-2 text-xs">
                              Source: {patch.source.join(', ')}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Change History Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Change History
          </CardTitle>
          <CardDescription>
            Previously applied changes to Salesforce
          </CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No changes have been applied yet.
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((entry, idx) => (
                <div key={idx} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-medium">
                      Applied {formatTimestamp(entry.appliedAt)}
                    </div>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      {entry.changes.length} change{entry.changes.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    {entry.changes.map((change, changeIdx) => (
                      <div 
                        key={changeIdx}
                        className="flex items-center justify-between text-sm py-2 px-3 bg-muted rounded"
                      >
                        <div className="flex items-center gap-2">
                          {change.success ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                          <Badge variant="outline" className="text-xs">{change.objectType}</Badge>
                          <span className="text-xs text-muted-foreground">{change.objectId}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {change.fieldsUpdated?.join(', ') || 'No fields updated'}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {entry.errors && entry.errors.length > 0 && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                      <div className="flex items-center gap-2 text-sm font-medium text-red-800 mb-1">
                        <AlertTriangle className="h-4 w-4" />
                        Errors
                      </div>
                      <ul className="text-xs text-red-700 space-y-1">
                        {entry.errors.map((error, errorIdx) => (
                          <li key={errorIdx}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Changes to Salesforce?</DialogTitle>
            <DialogDescription>
              You are about to apply {selectedPatches.size} change{selectedPatches.size !== 1 ? 's' : ''} to Salesforce.
              This action cannot be undone automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                Make sure to review all changes carefully. Changes will be written directly to your Salesforce instance.
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleApply} disabled={applying}>
              {applying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Applying...
                </>
              ) : (
                'Apply Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
