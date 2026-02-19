import { execute, type AmpOptions } from '@sourcegraph/amp-sdk'
import { join } from 'path'

export type AmpMode = 'smart' | 'fast' | 'free'

interface AmpExecuteOptions {
	prompt: string
	mode?: AmpMode
	options?: Omit<AmpOptions, 'settingsFile'>
}

/**
 * Execute Amp with the specified mode
 * @param prompt - The prompt to execute
 * @param mode - Agent mode: 'fast' (cheaper, for data tasks), 'smart' (default, for complex reasoning), or 'free'
 * @param options - Additional Amp options
 */
export async function* executeWithMode({
	prompt,
	mode = 'smart',
	options = {},
}: AmpExecuteOptions) {
	// Build settings file path based on mode
	const settingsFile = mode !== 'smart' 
		? join(process.cwd(), 'config', 'amp-modes', `${mode}.json`)
		: undefined

	// Execute with appropriate settings
	yield* execute({
		prompt,
		options: {
			...options,
			...(settingsFile && { settingsFile }),
		},
	})
}
