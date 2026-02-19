'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { MessageCircle, Send, Sparkles } from 'lucide-react'

interface LiveQnaPanelProps {
  accountSlug: string
  accountName: string
  stage: string
  products: string[]
}

interface QnaHistoryItem {
  question: string
  answer: string
  bullets: string[]
  suggestedFollowups: string[]
  evidence: Array<{ label: string; source: string }>
  createdAt: string
}

export function LiveQnaPanel({ accountSlug, accountName, stage, products }: LiveQnaPanelProps) {
  const [question, setQuestion] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [history, setHistory] = useState<QnaHistoryItem[]>([])
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!question.trim()) return

    setIsLoading(true)
    setError(null)

    try {
      // Get API URL (handling both localhost and network access)
      const apiUrl = typeof window !== 'undefined' 
        ? `http://${window.location.hostname}:3001/api`
        : 'http://localhost:3001/api'

      const response = await fetch(`${apiUrl}/accounts/${accountSlug}/live-qna`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })

      if (!response.ok) {
        throw new Error('Failed to get answer')
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Unknown error')
      }

      setHistory(prev => [
        {
          question,
          answer: result.data.answer,
          bullets: result.data.bullets || [],
          suggestedFollowups: result.data.suggestedFollowups || [],
          evidence: result.data.evidence || [],
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ])
      
      setQuestion('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageCircle className="h-5 w-5" />
          Live Q&A
        </CardTitle>
        <div className="flex flex-wrap gap-1 mt-1">
          <Badge variant="outline" className="text-xs">{accountName}</Badge>
          <Badge variant="secondary" className="text-xs">{stage}</Badge>
          {products.map(p => (
            <Badge key={p} className="text-xs">{p}</Badge>
          ))}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-3 overflow-hidden">
        {/* Question input */}
        <div className="flex gap-2">
          <Textarea
            placeholder="Ask about this customer or deal..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="min-h-[60px] resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              }
            }}
          />
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !question.trim()}
            size="icon"
          >
            {isLoading ? (
              <Sparkles className="h-4 w-4 animate-pulse" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        {error && (
          <div className="text-sm text-red-500">{error}</div>
        )}

        {/* History */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {history.map((item, idx) => (
            <div key={idx} className="space-y-2 p-3 bg-muted rounded-lg">
              <div className="text-sm font-medium text-muted-foreground">
                Q: {item.question}
              </div>
              <div className="text-sm">{item.answer}</div>
              
              {item.bullets.length > 0 && (
                <ul className="text-sm list-disc pl-4 space-y-1">
                  {item.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              )}

              {item.suggestedFollowups.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {item.suggestedFollowups.map((f, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="text-xs cursor-pointer hover:bg-primary/10"
                      onClick={() => setQuestion(f)}
                    >
                      {f}
                    </Badge>
                  ))}
                </div>
              )}

              {item.evidence.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {item.evidence.map((e, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {e.label}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
