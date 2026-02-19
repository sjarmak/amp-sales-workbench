'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Button } from './ui/button'
import { Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

const API_URL = 'http://localhost:3001/api'

interface ProspectorFile {
  filename: string
  content: string
}

interface ProspectorData {
  files: ProspectorFile[]
}

interface ProspectorTabProps {
  accountSlug?: string
  logs: string[]
  isRunning: boolean
  onRun: () => void
  onCancel: () => void
}

export function ProspectorTab({ accountSlug, logs, isRunning, onRun, onCancel }: ProspectorTabProps) {
  const [data, setData] = useState<ProspectorData | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  useEffect(() => {
    if (!accountSlug) return
    loadProspectingData()
  }, [accountSlug])

  // Reload data when prospector finishes
  useEffect(() => {
    if (!isRunning && logs.length > 0 && logs.some(log => log.includes('✓ Research complete'))) {
      setTimeout(() => {
        loadProspectingData()
      }, 1000)
    }
  }, [isRunning, logs])

  const loadProspectingData = () => {
    setLoading(true)
    fetch(`${API_URL}/accounts/${accountSlug}/prospecting`)
      .then((res) => res.json())
      .then((data) => {
        setData(data)
        if (data.files.length > 0) {
          setSelectedFile(data.files[0].filename)
        }
      })
      .finally(() => setLoading(false))
  }

  if (loading) {
    return <Card><CardContent className="py-8">Loading research files...</CardContent></Card>
  }

  if (isRunning || (logs.length > 0 && !logs.some(log => log.includes('✓ Research complete')))) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Running Prospector...</CardTitle>
              <CardDescription>Live execution output</CardDescription>
            </div>
            {isRunning && (
              <Button onClick={onCancel} variant="destructive" size="sm">
                Cancel Research
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-black text-green-400 p-4 rounded font-mono text-sm h-96 overflow-y-auto">
            {logs.map((log, i) => (
              <div key={i} className="whitespace-pre-wrap">{log}</div>
            ))}
            {isRunning && (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Running...</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data || data.files.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Research</CardTitle>
          <CardDescription>No research files available.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onRun} disabled={isRunning}>
            Run Prospector
          </Button>
        </CardContent>
      </Card>
    )
  }

  const formatTabName = (filename: string): string => {
    return filename
      .replace('.md', '')
      .replace(/^\d+_/, '') // Remove number prefix like "01_"
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const parseFrontmatter = (content: string) => {
    if (!content.startsWith('---\n')) {
      return { metadata: null, markdown: content }
    }
    
    const endIndex = content.indexOf('\n---\n', 4)
    if (endIndex === -1) {
      return { metadata: null, markdown: content }
    }
    
    const frontmatter = content.substring(4, endIndex)
    const markdown = content.substring(endIndex + 5)
    
    const metadata: Record<string, any> = {}
    frontmatter.split('\n').forEach(line => {
      const colonIndex = line.indexOf(':')
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim()
        const value = line.substring(colonIndex + 1).trim()
        metadata[key] = value
      }
    })
    
    return { metadata, markdown }
  }

  const selectedFileContent = data.files.find((f) => f.filename === selectedFile)?.content || ''
  const { metadata, markdown } = parseFrontmatter(selectedFileContent)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Prospector Research</CardTitle>
              <CardDescription>{data.files.length} discovery files generated</CardDescription>
            </div>
            <Button onClick={onRun} disabled={isRunning} variant="outline">
              Refresh Research
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Tabs value={selectedFile || undefined} onValueChange={setSelectedFile}>
        <TabsList className="w-full justify-start overflow-x-auto">
          {data.files.map((file) => (
            <TabsTrigger key={file.filename} value={file.filename}>
              {formatTabName(file.filename)}
            </TabsTrigger>
          ))}
        </TabsList>

        {data.files.map((file) => {
          const { metadata, markdown } = parseFrontmatter(file.content)
          
          return (
            <TabsContent key={file.filename} value={file.filename}>
              <Card>
                <CardContent className="pt-6 space-y-4">
                  {metadata && (
                    <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm border">
                      {metadata.title && (
                        <div className="text-lg font-semibold">{metadata.title}</div>
                      )}
                      <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                        {metadata.company && (
                          <div><span className="font-medium">Company:</span> {metadata.company}</div>
                        )}
                        {metadata.date && (
                          <div><span className="font-medium">Date:</span> {metadata.date}</div>
                        )}
                        {metadata.confidence && (
                          <div><span className="font-medium">Confidence:</span> {metadata.confidence}</div>
                        )}
                        {metadata.sources_count && (
                          <div><span className="font-medium">Sources:</span> {metadata.sources_count}</div>
                        )}
                      </div>
                      {metadata.personas && (
                        <div><span className="font-medium">Personas:</span> <span className="text-muted-foreground">{metadata.personas}</span></div>
                      )}
                      {metadata.keywords && (
                        <div><span className="font-medium">Keywords:</span> <span className="text-muted-foreground">{metadata.keywords}</span></div>
                      )}
                    </div>
                  )}
                  <div className="prose max-w-none dark:prose-invert">
                    <ReactMarkdown
                      components={{
                        h1: ({node, ...props}) => <h1 className="text-2xl font-bold mt-8 mb-4 pb-2 border-b" {...props} />,
                        h2: ({node, ...props}) => <h2 className="text-xl font-semibold mt-8 mb-3" {...props} />,
                        h3: ({node, ...props}) => <h3 className="text-lg font-semibold mt-6 mb-2" {...props} />,
                        p: ({node, ...props}) => <p className="my-4 leading-relaxed" {...props} />,
                        ul: ({node, ...props}) => <ul className="my-4 space-y-2" {...props} />,
                        ol: ({node, ...props}) => <ol className="my-4 space-y-2" {...props} />,
                        li: ({node, ...props}) => <li className="ml-4" {...props} />,
                        strong: ({node, ...props}) => <strong className="font-semibold text-foreground" {...props} />,
                      }}
                    >
                      {markdown}
                    </ReactMarkdown>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}
