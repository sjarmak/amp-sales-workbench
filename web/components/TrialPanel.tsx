'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, FlaskConical } from 'lucide-react'
import { Separator } from '@/components/ui/separator'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

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
	trialPlan?: TrialPlan
	pocScope?: POCScope
	generatedAt: string
}

interface TrialPanelProps {
	accountSlug: string
	accountName: string
	onGenerate?: () => void
}

export function TrialPanel({ accountSlug, accountName, onGenerate }: TrialPanelProps) {
	const [data, setData] = useState<DemoIdea | null>(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const fetchTrialData = async () => {
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
				throw new Error(`Failed to fetch trial data: ${res.statusText}`)
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
		fetchTrialData()
	}, [accountSlug])

	if (loading && !data) {
		return (
			<Card>
				<CardContent className="flex items-center justify-center p-8">
					<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
					<span className="ml-2 text-muted-foreground">Loading trial plans...</span>
				</CardContent>
			</Card>
		)
	}

	if (error) {
		return (
			<Card>
				<CardContent className="p-8">
					<div className="text-center text-destructive">
						<p className="font-semibold">Error loading trial plans</p>
						<p className="text-sm mt-1">{error}</p>
						<Button onClick={fetchTrialData} variant="outline" size="sm" className="mt-4">
							<RefreshCw className="h-4 w-4 mr-2" />
							Retry
						</Button>
					</div>
				</CardContent>
			</Card>
		)
	}

	if (!data || (!data.trialPlan && !data.pocScope)) {
		return (
			<div className="space-y-4">
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<FlaskConical className="h-5 w-5" />
							Trial & POC Documents
						</CardTitle>
						<CardDescription>Generate trial plans and POC scope documents</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="text-center py-8">
							<p className="text-muted-foreground mb-4">No trial documents generated yet.</p>
							<p className="text-sm text-muted-foreground mb-4">
								Trial and POC plans are generated as part of Demo Ideas.
							</p>
							{onGenerate && (
								<Button onClick={onGenerate}>
									<FlaskConical className="h-4 w-4 mr-2" />
									Generate Trial POC Documents
								</Button>
							)}
						</div>
					</CardContent>
				</Card>
			</div>
		)
	}

	return (
		<div className="space-y-4">
			{data.trialPlan && (
				<Card>
					<CardHeader>
						<div className="flex items-center justify-between">
							<div>
								<CardTitle>Trial Plan</CardTitle>
								<CardDescription>{data.trialPlan.duration} trial scope</CardDescription>
							</div>
							<Button onClick={fetchTrialData} variant="outline" size="sm" disabled={loading}>
								<RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
								Refresh
							</Button>
						</div>
					</CardHeader>
					<CardContent className="space-y-4">
						{data.trialPlan.scope.length > 0 && (
							<div>
								<h4 className="font-semibold mb-2">Scope</h4>
								<ul className="list-disc list-inside space-y-1">
									{data.trialPlan.scope.map((item, i) => (
										<li key={i} className="text-sm">
											{item}
										</li>
									))}
								</ul>
							</div>
						)}
						{data.trialPlan.dataRequirements.length > 0 && (
							<div>
								<h4 className="font-semibold mb-2">Data Requirements</h4>
								<ul className="list-disc list-inside space-y-1">
									{data.trialPlan.dataRequirements.map((item, i) => (
										<li key={i} className="text-sm">
											{item}
										</li>
									))}
								</ul>
							</div>
						)}
						{data.trialPlan.setupSteps.length > 0 && (
							<div>
								<h4 className="font-semibold mb-2">Setup Steps</h4>
								<ol className="list-decimal list-inside space-y-2">
									{data.trialPlan.setupSteps.map((step, i) => {
										const stepText = typeof step === 'string' ? step : step.title || step.description
										return (
											<li key={i} className="text-sm">
												{typeof step === 'object' && step.title ? (
													<div>
														<span className="font-medium">{step.title}</span>
														{step.description && <p className="text-muted-foreground ml-6 mt-1">{step.description}</p>}
													</div>
												) : (
													stepText
												)}
											</li>
										)
									})}
								</ol>
							</div>
						)}
						{data.trialPlan.successMetrics.length > 0 && (
							<div>
								<h4 className="font-semibold mb-2">Success Metrics</h4>
								<ul className="list-disc list-inside space-y-1">
									{data.trialPlan.successMetrics.map((metric, i) => (
										<li key={i} className="text-sm">
											{metric}
										</li>
									))}
								</ul>
							</div>
						)}
					</CardContent>
				</Card>
			)}

			{data.pocScope && (
				<Card>
					<CardHeader>
						<CardTitle>POC Scope</CardTitle>
						<CardDescription>{data.pocScope.duration} proof of concept</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						{data.pocScope.technicalRequirements.length > 0 && (
							<div>
								<h4 className="font-semibold mb-2">Technical Requirements</h4>
								<ul className="list-disc list-inside space-y-1">
									{data.pocScope.technicalRequirements.map((req, i) => (
										<li key={i} className="text-sm">
											{req}
										</li>
									))}
								</ul>
							</div>
						)}
						{data.pocScope.integrationPoints.length > 0 && (
							<div>
								<h4 className="font-semibold mb-2">Integration Points</h4>
								<ul className="list-disc list-inside space-y-1">
									{data.pocScope.integrationPoints.map((point, i) => (
										<li key={i} className="text-sm">
											{point}
										</li>
									))}
								</ul>
							</div>
						)}
						{data.pocScope.deliverables.length > 0 && (
							<div>
								<h4 className="font-semibold mb-2">Deliverables</h4>
								<ul className="list-disc list-inside space-y-1">
									{data.pocScope.deliverables.map((del, i) => (
										<li key={i} className="text-sm">
											{del}
										</li>
									))}
								</ul>
							</div>
						)}
						{data.pocScope.successCriteria.length > 0 && (
							<div>
								<h4 className="font-semibold mb-2">Success Criteria</h4>
								<ul className="list-disc list-inside space-y-1">
									{data.pocScope.successCriteria.map((crit, i) => (
										<li key={i} className="text-sm">
											{crit}
										</li>
									))}
								</ul>
							</div>
						)}
						{data.pocScope.timeline.length > 0 && (
							<div>
								<h4 className="font-semibold mb-2">Timeline</h4>
								<div className="space-y-3">
									{data.pocScope.timeline.map((phase, i) => (
										<div key={i}>
											<h5 className="font-medium text-sm mb-1">{phase.phase}</h5>
											<ul className="list-disc list-inside space-y-1 ml-4">
												{phase.activities.map((activity, j) => (
													<li key={j} className="text-sm text-muted-foreground">
														{activity}
													</li>
												))}
											</ul>
										</div>
									))}
								</div>
							</div>
						)}
					</CardContent>
				</Card>
			)}
		</div>
	)
}
