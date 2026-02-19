'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface QualificationData {
	methodology: string
	score?: number
	assessment: any
	generatedAt: string
}

interface QualificationPanelProps {
	accountSlug: string
	accountName: string
	onRefresh?: () => void
	isGenerating?: boolean
	refreshTrigger?: number
}

export function QualificationPanel({ accountSlug, accountName, onRefresh, isGenerating, refreshTrigger }: QualificationPanelProps) {
	const [data, setData] = useState<QualificationData | null>(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const fetchQualification = async () => {
		if (!accountSlug) return
		setLoading(true)
		setError(null)
		try {
			const res = await fetch(`${API_URL}/api/accounts/${accountSlug}/insights/qualification`)
			if (!res.ok) {
				if (res.status === 404) {
					setData(null)
					return
				}
				throw new Error(`Failed to fetch qualification: ${res.statusText}`)
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
		fetchQualification()
	}, [accountSlug, refreshTrigger])

	if (loading && !data) {
		return (
			<Card>
				<CardContent className="flex items-center justify-center p-8">
					<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
					<span className="ml-2 text-muted-foreground">Loading qualification...</span>
				</CardContent>
			</Card>
		)
	}

	if (error) {
		return (
			<Card>
				<CardContent className="p-8">
					<div className="text-center text-destructive">
						<p className="font-semibold">Error loading qualification</p>
						<p className="text-sm mt-1">{error}</p>
						<Button onClick={fetchQualification} variant="outline" size="sm" className="mt-4">
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
						<CheckCircle2 className="h-5 w-5" />
						Qualification Assessment
					</CardTitle>
					<CardDescription>Assess deal qualification using MEDDIC, BANT, or SPICED</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="text-center py-8">
						<p className="text-muted-foreground mb-4">
							{isGenerating ? 'Generating qualification assessment...' : 'No qualification assessment yet.'}
						</p>
						{onRefresh && (
							<Button onClick={onRefresh} disabled={isGenerating}>
								{isGenerating ? (
									<>
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
										Generating...
									</>
								) : (
									<>
										<CheckCircle2 className="h-4 w-4 mr-2" />
										Generate Assessment
									</>
								)}
							</Button>
						)}
					</div>
				</CardContent>
			</Card>
		)
	}

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="flex items-center gap-2">
							<CheckCircle2 className="h-5 w-5" />
							Qualification: {data.methodology}
						</CardTitle>
						<CardDescription>
							Generated {new Date(data.generatedAt).toLocaleDateString()} at{' '}
							{new Date(data.generatedAt).toLocaleTimeString()}
						</CardDescription>
					</div>
					<div className="flex gap-2">
						{data.score !== undefined && (
							<Badge variant={data.score >= 70 ? 'default' : data.score >= 40 ? 'secondary' : 'destructive'}>
								Score: {data.score}%
							</Badge>
						)}
						{onRefresh && (
							<Button onClick={onRefresh} variant="outline" size="sm" disabled={isGenerating}>
								{isGenerating ? (
									<>
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
										Regenerating...
									</>
								) : (
									<>
										<RefreshCw className="h-4 w-4 mr-2" />
										Regenerate
									</>
								)}
							</Button>
						)}
						<Button onClick={fetchQualification} variant="outline" size="sm" disabled={loading || isGenerating}>
							<RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
							Refresh Data
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-md">
					{JSON.stringify(data.assessment, null, 2)}
				</pre>
			</CardContent>
		</Card>
	)
}
