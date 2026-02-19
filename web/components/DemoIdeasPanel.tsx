'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Download, RefreshCw, Lightbulb } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface DemoScript {
	title: string
	objectives: string[]
	duration: string
	targetAudience: string[]
	narrative: Array<{
		step?: number
		title: string
		duration?: string
		customerPainPoint?: string
		features?: string[]
		talkingPoints?: string[]
		section?: string
		content?: string
	}>
}

interface TrialPlan {
	duration: string
	scope: string[]
	dataRequirements: string[]
	setupSteps: Array<string | { step?: number; title: string; description?: string; owner?: string; estimatedTime?: string }>
	successMetrics: string[]
}

interface POCScope {
	duration: string
	technicalRequirements: string[]
	integrationPoints: string[]
	deliverables: string[]
	successCriteria: string[]
	timeline: Array<{ phase: string; activities: string[] }>
}

interface DemoIdea {
	accountKey: {
		name: string
		domain?: string
		salesforceId?: string
	}
	demoScript?: DemoScript
	trialPlan?: TrialPlan
	pocScope?: POCScope
	customizationNotes?: string[]
	generatedAt: string
}

interface DemoIdeasPanelProps {
	accountSlug: string
	accountName: string
	onGenerate?: () => void
}

export function DemoIdeasPanel({ accountSlug, accountName, onGenerate }: DemoIdeasPanelProps) {
	const [data, setData] = useState<DemoIdea | null>(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const fetchDemoIdeas = async () => {
		if (!accountSlug) return
		setLoading(true)
		setError(null)
		try {
			const res = await fetch(`${API_URL}/api/accounts/${accountSlug}/demos`)
			if (!res.ok) {
				if (res.status === 404) {
					setData(null)
					return
				}
				throw new Error(`Failed to fetch demo ideas: ${res.statusText}`)
			}
			const jsonData = await res.json()
			setData(jsonData)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Unknown error')
			setData(null)
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		fetchDemoIdeas()
	}, [accountSlug])

	const downloadMarkdown = () => {
		if (!data) return
		const md = generateMarkdown(data)
		const blob = new Blob([md], { type: 'text/markdown' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `demo-ideas-${accountSlug}-${new Date().toISOString().split('T')[0]}.md`
		a.click()
		URL.revokeObjectURL(url)
	}

	if (loading && !data) {
		return (
			<Card>
				<CardContent className="flex items-center justify-center p-8">
					<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
					<span className="ml-2 text-muted-foreground">Loading demo ideas...</span>
				</CardContent>
			</Card>
		)
	}

	if (error) {
		return (
			<Card>
				<CardContent className="p-8">
					<div className="text-center text-destructive">
						<p className="font-semibold">Error loading demo ideas</p>
						<p className="text-sm mt-1">{error}</p>
						<Button onClick={fetchDemoIdeas} variant="outline" size="sm" className="mt-4">
							<RefreshCw className="h-4 w-4 mr-2" />
							Retry
						</Button>
					</div>
				</CardContent>
			</Card>
		)
	}

	if (!data) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Lightbulb className="h-5 w-5" />
						Demo Ideas
					</CardTitle>
					<CardDescription>Generate tailored demo ideas and trial plans</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="text-center py-8">
						<p className="text-muted-foreground mb-4">No demo ideas generated yet.</p>
						{onGenerate && (
							<Button onClick={onGenerate}>
								<Lightbulb className="h-4 w-4 mr-2" />
								Generate Demo Ideas
							</Button>
						)}
					</div>
				</CardContent>
			</Card>
		)
	}

	return (
		<div className="space-y-4">
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="flex items-center gap-2">
								<Lightbulb className="h-5 w-5" />
								Demo Ideas for {data.accountKey.name}
							</CardTitle>
							<CardDescription>
								Generated {new Date(data.generatedAt).toLocaleDateString()} at{' '}
								{new Date(data.generatedAt).toLocaleTimeString()}
							</CardDescription>
						</div>
						<div className="flex gap-2">
							<Button onClick={fetchDemoIdeas} variant="outline" size="sm" disabled={loading}>
								<RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
								Refresh
							</Button>
							<Button onClick={downloadMarkdown} variant="outline" size="sm">
								<Download className="h-4 w-4 mr-2" />
								Download MD
							</Button>
						</div>
					</div>
				</CardHeader>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Demo Script</CardTitle>
					<CardDescription>{data.demoScript?.title || 'Custom demo script'}</CardDescription>
				</CardHeader>
				{data.demoScript && (
					<CardContent className="space-y-4">
						<div>
							<h4 className="font-semibold mb-2">Objectives</h4>
							<ul className="list-disc list-inside space-y-1">
								{data.demoScript.objectives.map((obj, i) => (
									<li key={i} className="text-sm">
										{obj}
									</li>
								))}
							</ul>
						</div>
						<div className="flex gap-4">
							<div>
								<Badge variant="secondary">{data.demoScript.duration}</Badge>
							</div>
							<div>
								<span className="text-sm text-muted-foreground">Target Audience: </span>
								{data.demoScript.targetAudience.map((aud, i) => (
									<Badge key={i} variant="outline" className="ml-1">
										{aud}
									</Badge>
								))}
							</div>
						</div>
						<Separator />
						<div>
							<h4 className="font-semibold mb-3">Narrative</h4>
							<div className="space-y-4">
								{data.demoScript.narrative.map((item, i) => (
									<div key={i} className="border-l-2 border-muted pl-4">
										<h5 className="font-medium text-sm mb-2">
											{item.step && `${item.step}. `}{item.title || item.section}
											{item.duration && <span className="text-muted-foreground ml-2">({item.duration})</span>}
										</h5>
										{item.customerPainPoint && (
											<p className="text-sm text-muted-foreground mb-2">
												<span className="font-medium">Pain Point:</span> {item.customerPainPoint}
											</p>
										)}
										{item.features && item.features.length > 0 && (
											<div className="mb-2">
												<p className="text-sm font-medium mb-1">Features:</p>
												<ul className="list-disc list-inside space-y-1 ml-2">
													{item.features.map((feature, j) => (
														<li key={j} className="text-sm text-muted-foreground">{feature}</li>
													))}
												</ul>
											</div>
										)}
										{item.talkingPoints && item.talkingPoints.length > 0 && (
											<div>
												<p className="text-sm font-medium mb-1">Talking Points:</p>
												<ul className="list-disc list-inside space-y-1 ml-2">
													{item.talkingPoints.map((point, j) => (
														<li key={j} className="text-sm text-muted-foreground">{point}</li>
													))}
												</ul>
											</div>
										)}
										{item.content && <p className="text-sm text-muted-foreground">{item.content}</p>}
									</div>
								))}
							</div>
						</div>
					</CardContent>
				)}
			</Card>

			{data.customizationNotes && data.customizationNotes.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle>Customization Notes</CardTitle>
					</CardHeader>
					<CardContent>
						<ul className="list-disc list-inside space-y-1">
							{data.customizationNotes.map((note, i) => (
								<li key={i} className="text-sm">
									{note}
								</li>
							))}
						</ul>
					</CardContent>
				</Card>
			)}
		</div>
	)
}

function generateMarkdown(data: DemoIdea): string {
	let md = `# Demo Ideas for ${data.accountKey.name}\n\n`
	md += `Generated: ${new Date(data.generatedAt).toLocaleString()}\n\n`

	if (data.demoScript) {
		md += `## Demo Script\n\n`
		md += `### ${data.demoScript.title}\n\n`
		md += `**Duration:** ${data.demoScript.duration}\n\n`
		md += `**Target Audience:** ${data.demoScript.targetAudience.join(', ')}\n\n`
		md += `### Objectives\n\n`
		data.demoScript.objectives.forEach((obj) => {
			md += `- ${obj}\n`
		})
		md += `\n### Narrative\n\n`
		data.demoScript.narrative.forEach((item) => {
			md += `#### ${item.step ? `${item.step}. ` : ''}${item.title || item.section}`
			if (item.duration) md += ` (${item.duration})`
			md += `\n\n`
			if (item.customerPainPoint) md += `**Pain Point:** ${item.customerPainPoint}\n\n`
			if (item.features && item.features.length > 0) {
				md += `**Features:**\n`
				item.features.forEach(f => md += `- ${f}\n`)
				md += `\n`
			}
			if (item.talkingPoints && item.talkingPoints.length > 0) {
				md += `**Talking Points:**\n`
				item.talkingPoints.forEach(tp => md += `- ${tp}\n`)
				md += `\n`
			}
			if (item.content) md += `${item.content}\n\n`
		})
	}

	if (data.trialPlan) {
		md += `## Trial Plan\n\n`
		md += `**Duration:** ${data.trialPlan.duration}\n\n`
		if (data.trialPlan.scope.length > 0) {
			md += `### Scope\n\n`
			data.trialPlan.scope.forEach((item) => {
				md += `- ${item}\n`
			})
			md += `\n`
		}
		if (data.trialPlan.dataRequirements.length > 0) {
			md += `### Data Requirements\n\n`
			data.trialPlan.dataRequirements.forEach((item) => {
				md += `- ${item}\n`
			})
			md += `\n`
		}
		if (data.trialPlan.setupSteps.length > 0) {
			md += `### Setup Steps\n\n`
			data.trialPlan.setupSteps.forEach((step, i) => {
				if (typeof step === 'string') {
					md += `${i + 1}. ${step}\n`
				} else {
					md += `${i + 1}. **${step.title}**\n`
					if (step.description) md += `   ${step.description}\n`
					if (step.owner) md += `   *Owner: ${step.owner}*\n`
					if (step.estimatedTime) md += `   *Estimated Time: ${step.estimatedTime}*\n`
				}
			})
			md += `\n`
		}
		if (data.trialPlan.successMetrics.length > 0) {
			md += `### Success Metrics\n\n`
			data.trialPlan.successMetrics.forEach((metric) => {
				md += `- ${metric}\n`
			})
			md += `\n`
		}
	}

	if (data.pocScope) {
		md += `## POC Scope\n\n`
		md += `**Duration:** ${data.pocScope.duration}\n\n`
		if (data.pocScope.technicalRequirements.length > 0) {
			md += `### Technical Requirements\n\n`
			data.pocScope.technicalRequirements.forEach((req) => {
				md += `- ${req}\n`
			})
			md += `\n`
		}
		if (data.pocScope.integrationPoints.length > 0) {
			md += `### Integration Points\n\n`
			data.pocScope.integrationPoints.forEach((point) => {
				md += `- ${point}\n`
			})
			md += `\n`
		}
		if (data.pocScope.deliverables.length > 0) {
			md += `### Deliverables\n\n`
			data.pocScope.deliverables.forEach((del) => {
				md += `- ${del}\n`
			})
			md += `\n`
		}
		if (data.pocScope.successCriteria.length > 0) {
			md += `### Success Criteria\n\n`
			data.pocScope.successCriteria.forEach((crit) => {
				md += `- ${crit}\n`
			})
			md += `\n`
		}
		if (data.pocScope.timeline.length > 0) {
			md += `### Timeline\n\n`
			data.pocScope.timeline.forEach((phase) => {
				md += `#### ${phase.phase}\n\n`
				phase.activities.forEach((activity) => {
					md += `- ${activity}\n`
				})
				md += `\n`
			})
		}
	}

	if (data.customizationNotes && data.customizationNotes.length > 0) {
		md += `## Customization Notes\n\n`
		data.customizationNotes.forEach((note) => {
			md += `- ${note}\n`
		})
	}

	return md
}
