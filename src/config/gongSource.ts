/**
 * Configuration for Gong data source selection
 *
 * Supported modes:
 * - events-api: Production mode, uses sales-events-api service for real-time data
 * - parquet: Local lakehouse mode, queries ~/gong_data Parquet files
 * - cache: DEPRECATED - use parquet instead
 * - mcp: Legacy fallback, uses Gong MCP server directly
 */

export type GongSourceKind = "events-api" | "parquet" | "mcp" | "cache";

/**
 * Get the configured Gong data source from environment
 * @returns The Gong source kind, defaults to "parquet" for local dev
 */
export function getGongSource(): GongSourceKind {
  const source = process.env.GONG_SOURCE?.toLowerCase();
  
  if (source === "mcp" || source === "cache" || source === "events-api" || source === "parquet") {
    return source;
  }
  
  // Default to parquet for local development (faster than events-api, no service needed)
  return "parquet";
}
