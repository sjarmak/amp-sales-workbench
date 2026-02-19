/**
 * Data Source Router Configuration
 * 
 * Routes data requests to appropriate sources based on environment configuration.
 * Enables gradual migration from local files to BigQuery.
 * 
 * Configuration via environment variables:
 * - GONG_SOURCE: 'bigquery' | 'parquet' | 'events-api' | 'mcp' (default: parquet)
 * - SALESFORCE_SOURCE: 'bigquery' | 'local-cache' | 'mcp' (default: local-cache)
 * - ENRICHED_SOURCE: 'bigquery' | 'local-cache' (default: local-cache)
 * 
 * Use cases:
 * - Dev: All local (no GCP access needed)
 * - Hybrid: BQ for primary, local fallback
 * - Cloud: All BigQuery
 */

export type DataSourceKind = 'bigquery' | 'local-cache' | 'parquet' | 'events-api' | 'mcp'

export interface DataSourceConfig {
  gong: DataSourceKind
  salesforce: DataSourceKind
  enriched: DataSourceKind
}

/**
 * Get data source configuration from environment
 */
export function getDataSourceConfig(): DataSourceConfig {
  return {
    gong: (process.env.GONG_SOURCE as DataSourceKind) || 'parquet',
    salesforce: (process.env.SALESFORCE_SOURCE as DataSourceKind) || 'local-cache',
    enriched: (process.env.ENRICHED_SOURCE as DataSourceKind) || 'local-cache',
  }
}

/**
 * Validate source configuration
 */
export function validateDataSourceConfig(config: DataSourceConfig): boolean {
  const validGongSources: DataSourceKind[] = ['bigquery', 'parquet', 'events-api', 'mcp']
  const validSfSources: DataSourceKind[] = ['bigquery', 'local-cache', 'mcp']
  const validEnrichedSources: DataSourceKind[] = ['bigquery', 'local-cache']

  return (
    validGongSources.includes(config.gong) &&
    validSfSources.includes(config.salesforce) &&
    validEnrichedSources.includes(config.enriched)
  )
}

/**
 * Get preset configurations for common scenarios
 */
export function getDataSourcePreset(preset: 'dev' | 'hybrid' | 'cloud'): DataSourceConfig {
  switch (preset) {
    case 'dev':
      // All local - no GCP required
      return {
        gong: 'parquet',
        salesforce: 'local-cache',
        enriched: 'local-cache',
      }

    case 'hybrid':
      // BigQuery for Gong/Salesforce, local cache for enriched (safe for dev)
      return {
        gong: 'bigquery',
        salesforce: 'bigquery',
        enriched: 'local-cache', // Keep local until fully migrated
      }

    case 'cloud':
      // Full BigQuery
      return {
        gong: 'bigquery',
        salesforce: 'bigquery',
        enriched: 'bigquery',
      }
  }
}

/**
 * Check if BigQuery is enabled for any source
 */
export function isBigQueryEnabled(config: DataSourceConfig): boolean {
  return config.gong === 'bigquery' || config.salesforce === 'bigquery' || config.enriched === 'bigquery'
}

/**
 * Check if all sources use BigQuery
 */
export function isFullCloud(config: DataSourceConfig): boolean {
  return config.gong === 'bigquery' && config.salesforce === 'bigquery' && config.enriched === 'bigquery'
}

/**
 * Log current data source configuration
 */
export function logDataSourceConfig(): void {
  const config = getDataSourceConfig()
  console.log('[Data Sources]')
  console.log(`  Gong:      ${config.gong}`)
  console.log(`  Salesforce: ${config.salesforce}`)
  console.log(`  Enriched:  ${config.enriched}`)
}
