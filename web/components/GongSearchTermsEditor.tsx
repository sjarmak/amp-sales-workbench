'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { X, Plus, Loader2 } from 'lucide-react'

const API_URL = 'http://localhost:3001/api'

interface GongSearchTermsEditorProps {
  accountSlug: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated: () => void
}

export function GongSearchTermsEditor({ accountSlug, open, onOpenChange, onUpdated }: GongSearchTermsEditorProps) {
  const [searchTerms, setSearchTerms] = useState<string[]>([])
  const [reason, setReason] = useState<string>('')
  const [newTerm, setNewTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && accountSlug) {
      loadSearchTerms()
    }
  }, [open, accountSlug])

  const loadSearchTerms = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/accounts/${accountSlug}/gong-search-terms`)
      if (res.ok) {
        const data = await res.json()
        setSearchTerms(data.searchTerms || [])
        setReason(data.isDefault ? '' : (data.reason || ''))
      }
    } catch (error) {
      console.error('Failed to load search terms:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddTerm = () => {
    const term = newTerm.trim()
    if (term && !searchTerms.includes(term)) {
      setSearchTerms([...searchTerms, term])
      setNewTerm('')
    }
  }

  const handleRemoveTerm = (term: string) => {
    setSearchTerms(searchTerms.filter(t => t !== term))
  }

  const handleSave = async () => {
    if (searchTerms.length === 0) {
      alert('Please add at least one search term')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/accounts/${accountSlug}/gong-search-terms`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchTerms,
          reason: reason || 'Custom search terms',
        }),
      })

      if (res.ok) {
        onUpdated()
        onOpenChange(false)
      } else {
        const error = await res.json()
        alert(`Failed to save: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Failed to save search terms:', error)
      alert('Failed to save search terms')
    } finally {
      setSaving(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTerm()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Gong Search Terms</DialogTitle>
          <DialogDescription>
            Configure custom search terms to find Gong calls for this account
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Search Terms</Label>
              <div className="flex flex-wrap gap-2 min-h-[40px] p-2 border rounded-md">
                {searchTerms.map((term) => (
                  <Badge key={term} variant="secondary" className="flex items-center gap-1">
                    {term}
                    <button
                      onClick={() => handleRemoveTerm(term)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {searchTerms.length === 0 && (
                  <span className="text-sm text-muted-foreground">No search terms added</span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-term">Add Search Term</Label>
              <div className="flex gap-2">
                <Input
                  id="new-term"
                  value={newTerm}
                  onChange={(e) => setNewTerm(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="e.g., IBM, Big Blue"
                />
                <Button onClick={handleAddTerm} size="sm" variant="outline">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Input
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Calls use abbreviation instead of full name"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
