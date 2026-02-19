/**
 * Salesforce BigQuery Client
 * 
 * Queries Salesforce data from BigQuery instead of scattered JSON files.
 * Replaces file-based lookups with direct SQL.
 * 
 * Features:
 * - Account lookups by ID or name
 * - Contact queries with company association
 * - Opportunity queries with deal status
 * - Activity tracking for call history
 */

import { executeQuery, getGcpConfig } from '../services/bqClient.js'

export interface SalesforceAccount {
  Id: string
  Name: string
  Website?: string
  Industry?: string
  NumberOfEmployees?: number
  BillingCity?: string
  BillingCountry?: string
  LastModifiedDate: string
}

export interface SalesforceContact {
  Id: string
  AccountId: string
  FirstName: string
  LastName: string
  Email?: string
  Phone?: string
  Title?: string
  LastModifiedDate: string
}

export interface SalesforceOpportunity {
  Id: string
  AccountId: string
  Name: string
  StageName: string
  Amount?: number
  CloseDate: string
  LastModifiedDate: string
}

export interface SalesforceActivity {
  Id: string
  AccountId: string
  Type: string
  Subject: string
  ActivityDate: string
  CreatedDate: string
}

/**
 * Query accounts by ID or name
 */
export async function queryAccounts(params: {
  accountIds?: string[]
  accountNames?: string[]
  limit?: number
}): Promise<SalesforceAccount[]> {
  const config = getGcpConfig()
  const { accountIds, accountNames, limit = 100 } = params

  const conditions: string[] = []

  if (accountIds && accountIds.length > 0) {
    const placeholders = accountIds.map((_, i) => `@id_${i}`).join(', ')
    conditions.push(`Id IN (${placeholders})`)
  }

  if (accountNames && accountNames.length > 0) {
    const orConditions = accountNames
      .map((_, i) => `Name LIKE CONCAT('%', @name_${i}, '%')`)
      .join(' OR ')
    conditions.push(`(${orConditions})`)
  }

  if (conditions.length === 0) {
    throw new Error('Must provide accountIds or accountNames')
  }

  const whereClause = conditions.join(' OR ')

  const sql = `
    SELECT
      Id,
      Name,
      Website,
      Industry,
      NumberOfEmployees,
      BillingCity,
      BillingCountry,
      LastModifiedDate
    FROM \`${config.projectId}.${config.datasetId}.salesforce.accounts\`
    WHERE ${whereClause}
    ORDER BY LastModifiedDate DESC
    LIMIT @limit
  `

  const paramObj: Record<string, any> = { limit }

  if (accountIds) {
    accountIds.forEach((id, i) => {
      paramObj[`id_${i}`] = id
    })
  }

  if (accountNames) {
    accountNames.forEach((name, i) => {
      paramObj[`name_${i}`] = name
    })
  }

  return executeQuery<SalesforceAccount>(sql, { params: paramObj })
}

/**
 * Get contacts for an account
 */
export async function queryContacts(params: {
  accountId: string
  limit?: number
}): Promise<SalesforceContact[]> {
  const config = getGcpConfig()
  const { accountId, limit = 100 } = params

  const sql = `
    SELECT
      Id,
      AccountId,
      FirstName,
      LastName,
      Email,
      Phone,
      Title,
      LastModifiedDate
    FROM \`${config.projectId}.${config.datasetId}.salesforce.contacts\`
    WHERE AccountId = @account_id
    ORDER BY LastModifiedDate DESC
    LIMIT @limit
  `

  return executeQuery<SalesforceContact>(sql, {
    params: { account_id: accountId, limit },
  })
}

/**
 * Get opportunities for an account
 */
export async function queryOpportunities(params: {
  accountId: string
  stageFilter?: string[] // e.g., ['Prospecting', 'Qualification', 'Proposal']
  limit?: number
}): Promise<SalesforceOpportunity[]> {
  const config = getGcpConfig()
  const { accountId, stageFilter, limit = 100 } = params

  let whereClause = 'AccountId = @account_id'

  if (stageFilter && stageFilter.length > 0) {
    const stagePlaceholders = stageFilter.map((_, i) => `@stage_${i}`).join(', ')
    whereClause += ` AND StageName IN (${stagePlaceholders})`
  }

  const sql = `
    SELECT
      Id,
      AccountId,
      Name,
      StageName,
      Amount,
      CloseDate,
      LastModifiedDate
    FROM \`${config.projectId}.${config.datasetId}.salesforce.opportunities\`
    WHERE ${whereClause}
    ORDER BY CloseDate DESC
    LIMIT @limit
  `

  const paramObj: Record<string, any> = { account_id: accountId, limit }

  if (stageFilter) {
    stageFilter.forEach((stage, i) => {
      paramObj[`stage_${i}`] = stage
    })
  }

  return executeQuery<SalesforceOpportunity>(sql, { params: paramObj })
}

/**
 * Get recent activities for an account
 */
export async function queryActivities(params: {
  accountId: string
  maxAge?: number // days, default 90
  limit?: number
}): Promise<SalesforceActivity[]> {
  const config = getGcpConfig()
  const { accountId, maxAge = 90, limit = 100 } = params

  const sql = `
    SELECT
      Id,
      AccountId,
      Type,
      Subject,
      ActivityDate,
      CreatedDate
    FROM \`${config.projectId}.${config.datasetId}.salesforce.activities\`
    WHERE AccountId = @account_id
      AND ActivityDate >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @max_age DAY)
    ORDER BY ActivityDate DESC
    LIMIT @limit
  `

  return executeQuery<SalesforceActivity>(sql, {
    params: { account_id: accountId, max_age: maxAge, limit },
  })
}

/**
 * Get account summary with related data
 */
export async function getAccountSummary(accountId: string): Promise<{
  account: SalesforceAccount | null
  contacts: SalesforceContact[]
  opportunities: SalesforceOpportunity[]
  recentActivities: SalesforceActivity[]
}> {
  const [accounts, contacts, opportunities, activities] = await Promise.all([
    queryAccounts({ accountIds: [accountId] }),
    queryContacts({ accountId }),
    queryOpportunities({ accountId }),
    queryActivities({ accountId }),
  ])

  return {
    account: accounts[0] || null,
    contacts,
    opportunities,
    recentActivities: activities,
  }
}

/**
 * Search accounts by name
 */
export async function searchAccounts(
  searchTerm: string,
  limit: number = 50
): Promise<SalesforceAccount[]> {
  const config = getGcpConfig()

  const sql = `
    SELECT
      Id,
      Name,
      Website,
      Industry,
      NumberOfEmployees,
      BillingCity,
      BillingCountry,
      LastModifiedDate
    FROM \`${config.projectId}.${config.datasetId}.salesforce.accounts\`
    WHERE Name LIKE CONCAT('%', @search_term, '%')
    ORDER BY LastModifiedDate DESC
    LIMIT @limit
  `

  return executeQuery<SalesforceAccount>(sql, {
    params: { search_term: searchTerm, limit },
  })
}
