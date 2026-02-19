/**
 * Client for sales-events-api service
 * Thin wrapper around fetch for retrieving Gong call data
 */

export interface EventsApiGongCall {
  gong_call_id: string;
  account_name: string | null;
  started_at: string;
  duration_seconds: number | null;
  owner_name: string | null;
  owner_email: string | null;
  recording_url: string | null;
  transcript_ready: boolean;
}

interface FetchGongCallsParams {
  accountSlug: string;
  from?: string;
  to?: string;
  limit?: number;
}

export async function fetchGongCallsForAccount(
  params: FetchGongCallsParams
): Promise<EventsApiGongCall[]> {
  const apiUrl = process.env.SALES_EVENTS_API_URL;
  
  if (!apiUrl) {
    throw new Error(
      'SALES_EVENTS_API_URL environment variable is not set. ' +
      'Please configure the sales-events-api service URL.'
    );
  }

  const url = new URL('/gong/calls', apiUrl);
  url.searchParams.set('account_slug', params.accountSlug);
  
  if (params.from) {
    url.searchParams.set('from', params.from);
  }
  if (params.to) {
    url.searchParams.set('to', params.to);
  }
  if (params.limit !== undefined) {
    url.searchParams.set('limit', params.limit.toString());
  }

  let response: Response;
  try {
    response = await fetch(url.toString());
  } catch (error) {
    throw new Error(
      `Failed to connect to sales-events-api at ${apiUrl}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  if (!response.ok) {
    let errorMessage = `sales-events-api returned ${response.status} ${response.statusText}`;
    try {
      const errorBody = await response.text();
      if (errorBody) {
        errorMessage += `: ${errorBody}`;
      }
    } catch {
      // Ignore error reading body
    }
    throw new Error(errorMessage);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error(
      `Failed to parse JSON response from sales-events-api: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  if (!Array.isArray(data)) {
    throw new Error('Expected array response from sales-events-api');
  }

  return data as EventsApiGongCall[];
}
