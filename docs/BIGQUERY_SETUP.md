# BigQuery Setup & Configuration

## Status: Phase 1 Complete ✅

Service account credentials obtained for project: `your-gcp-project`

## Quick Start (5 minutes)

```bash
# 1. Set up environment
export GCP_PROJECT_ID=your-gcp-project
export GCP_DATASET_ID=sales_workbench_dev
export GCP_KEY_FILE=$(pwd)/config/gcp-service-account.json

# 2. Save your service account JSON
cp /path/to/downloaded/service-account.json $GCP_KEY_FILE

# 3. Validate setup
npx tsx scripts/validate-bigquery-setup.ts

# 4. Run Phase 3 migrations
npm run gong:bq-sync -- --dry-run     # Test
npm run gong:bq-sync                  # Execute

# 5. Test with cloud data sources
GONG_SOURCE=bigquery \
SALESFORCE_SOURCE=bigquery \
npm run start:web
```

## Configuration

### Environment Variables

```bash
# GCP Project & Dataset
GCP_PROJECT_ID=your-gcp-project
GCP_DATASET_ID=sales_workbench_dev
GCP_KEY_FILE=config/gcp-service-account.json

# Data sources (dev mode: local, hybrid: BQ+fallback, cloud: all BQ)
GONG_SOURCE=bigquery              # bigquery | parquet | mcp
SALESFORCE_SOURCE=bigquery        # bigquery | local-cache | mcp
ENRICHED_SOURCE=bigquery          # bigquery | local-cache
```

### Preset Modes

**Dev (Local - No GCP)**
```bash
GONG_SOURCE=parquet
SALESFORCE_SOURCE=local-cache
ENRICHED_SOURCE=local-cache
```

**Hybrid (Cloud Primary + Local Fallback)**
```bash
GONG_SOURCE=bigquery
SALESFORCE_SOURCE=bigquery
ENRICHED_SOURCE=local-cache
GCP_PROJECT_ID=your-gcp-project
GCP_DATASET_ID=sales_workbench_dev
GCP_KEY_FILE=config/gcp-service-account.json
```

**Cloud (Full BigQuery)**
```bash
GONG_SOURCE=bigquery
SALESFORCE_SOURCE=bigquery
ENRICHED_SOURCE=bigquery
GCP_PROJECT_ID=your-gcp-project
GCP_DATASET_ID=sales_workbench_dev
GCP_KEY_FILE=config/gcp-service-account.json
```

## Step-by-Step Setup

### Step 1: Save Service Account

```bash
# The JSON file from GCP Console
cp ~/Downloads/your-gcp-project-sa.json config/gcp-service-account.json

# Verify it's readable
cat config/gcp-service-account.json | jq '.project_id'
# Expected output: your-gcp-project
```

### Step 2: Authenticate with GCP

```bash
export GCP_KEY_FILE=$(pwd)/config/gcp-service-account.json
gcloud auth activate-service-account --key-file=$GCP_KEY_FILE
gcloud config set project your-gcp-project

# Verify
gcloud projects describe your-gcp-project
```

### Step 3: Create BigQuery Dataset & Tables

If not already done:

```bash
# Create dataset
bq mk --dataset \
  --description="Sales Workbench Development" \
  sales_workbench_dev

# Create tables (see schema files in docs/schemas/)
bq mk --table sales_workbench_dev.gong_calls docs/schemas/gong_calls.schema.json
bq mk --table sales_workbench_dev.salesforce_accounts docs/schemas/salesforce_accounts.schema.json
bq mk --table sales_workbench_dev.salesforce_contacts docs/schemas/salesforce_contacts.schema.json
bq mk --table sales_workbench_dev.salesforce_opportunities docs/schemas/salesforce_opportunities.schema.json
bq mk --table sales_workbench_dev.enriched_transcripts docs/schemas/enriched_transcripts.schema.json
bq mk --table sales_workbench_dev.enriched_snapshots docs/schemas/enriched_snapshots.schema.json
```

### Step 4: Validate Setup

```bash
# Run validation script
GCP_PROJECT_ID=your-gcp-project \
GCP_DATASET_ID=sales_workbench_dev \
GCP_KEY_FILE=$(pwd)/config/gcp-service-account.json \
npx tsx scripts/validate-bigquery-setup.ts
```

**Expected output:**
```
✅ Project accessible: your-gcp-project
✅ Dataset exists: sales_workbench_dev
✅ gong_calls
✅ salesforce_accounts
✅ salesforce_contacts
✅ salesforce_opportunities
✅ Query execution successful
✅ All validations passed! Ready for Phase 3 migrations.
```

### Step 5: Run Phase 3 Migrations

#### Gong Parquet → BigQuery

```bash
# Dry run first (shows what would migrate, no writes)
DEBUG=1 npx tsx scripts/migrate-gong-to-bq.ts --dry-run --limit 10

# Full migration
npx tsx scripts/migrate-gong-to-bq.ts

# Verify row count
bq query --use_legacy_sql=false \
  'SELECT COUNT(*) as count FROM `your-gcp-project.sales_workbench_dev.gong_calls`'
```

#### Salesforce JSON → BigQuery

```bash
# Dry run
npx tsx scripts/migrate-salesforce-to-bq.ts --dry-run

# Full migration
npx tsx scripts/migrate-salesforce-to-bq.ts

# Verify
bq query --use_legacy_sql=false \
  'SELECT COUNT(*) as count FROM `your-gcp-project.sales_workbench_dev.salesforce_accounts`'
```

### Step 6: Test with Cloud Mode

```bash
# Enable cloud data sources
export GONG_SOURCE=bigquery
export SALESFORCE_SOURCE=bigquery
export GCP_PROJECT_ID=your-gcp-project
export GCP_DATASET_ID=sales_workbench_dev
export GCP_KEY_FILE=$(pwd)/config/gcp-service-account.json

# Start the system
npm run start:web
```

**Verify in browser:**
```
http://localhost:3001/api/status/data-sources
→ Should show "mode": "cloud"

http://localhost:3001/api/health/bigquery
→ Should show "status": "healthy"
```

## Monitoring & Debugging

### Check Data Source Status

```bash
curl http://localhost:3001/api/status/data-sources
```

**Response (cloud mode):**
```json
{
  "success": true,
  "config": {
    "gong": "bigquery",
    "salesforce": "bigquery",
    "enriched": "bigquery"
  },
  "mode": "cloud"
}
```

### Check BigQuery Connectivity

```bash
curl http://localhost:3001/api/health/bigquery
```

**Response (healthy):**
```json
{
  "status": "healthy",
  "project": "your-gcp-project",
  "dataset": "sales_workbench_dev",
  "timestamp": "2025-12-12T..."
}
```

### View BigQuery Tables

```bash
# List all tables
bq ls --project_id=your-gcp-project sales_workbench_dev

# Describe a table
bq show --project_id=your-gcp-project sales_workbench_dev.gong_calls

# Query table info
bq query --use_legacy_sql=false \
  'SELECT table_name, row_count, size_bytes FROM `your-gcp-project.sales_workbench_dev.__TABLES_SUMMARY__`'
```

### Troubleshooting

**Problem: "Failed to connect to BigQuery"**
```bash
# Check service account file
cat config/gcp-service-account.json | jq '.project_id, .type, .client_email'

# Verify authentication
gcloud auth list
gcloud config get-value project
```

**Problem: "Table not found"**
```bash
# Check if dataset exists
bq ls --project_id=your-gcp-project

# Check if tables exist
bq ls --project_id=your-gcp-project sales_workbench_dev

# Create missing tables (see Step 3)
```

**Problem: "Permission denied"**
```bash
# Verify service account has BigQuery roles:
# - roles/bigquery.admin (for setup)
# - roles/bigquery.dataEditor (for reads/writes)

# Check via GCP Console:
# 1. Go to IAM & Admin → Service Accounts
# 2. Click service account email
# 3. Check Roles tab
```

**Problem: "Quota exceeded"**
```bash
# Check BigQuery quotas in GCP Console
# Monitor → Quotas & System Limits
# May need to request quota increase
```

## Architecture: Local → Cloud

### Before (Dev Mode)
```
API → DataAccessService → ParquetClient → ~/gong_data/calls.parquet
                       → FileSystem → data/accounts/*/salesforce.json
```

### After (Cloud Mode)
```
API → DataAccessService → GongBigQueryClient → BigQuery.gong_calls
                       → SalesforceClient → BigQuery.salesforce_accounts
                       → EnrichedClient → BigQuery.enriched_snapshots
```

### Fallback Chain (Hybrid Mode)
```
API → DataAccessService → Try BigQuery
                       → Fall back to Parquet
                       → Fall back to MCP
```

## Security

### Service Account Best Practices

1. **Never commit JSON to git:**
   ```bash
   echo "config/gcp-service-account.json" >> .gitignore
   ```

2. **Use Secret Manager in production:**
   ```yaml
   # service.yaml (MSP)
   secretEnv:
     GCP_KEY_FILE: projects/sg-sales-workbench-prod/secrets/gcp-sa-key
   ```

3. **Rotate keys regularly:**
   - GCP Console → Service Accounts → Keys
   - Max age: 90 days
   - Always have 2 active keys during rotation

4. **Limit service account permissions:**
   - Only grant `roles/bigquery.dataEditor` (not admin)
   - Only grant access to required dataset
   - Review monthly

### Data Security

- **Encryption in transit:** TLS (automatic in Cloud Run)
- **Encryption at rest:** BigQuery default (Google-managed keys)
- **PII handling:** RedactionPolicy on sensitive columns
- **Audit logging:** Enable BigQuery data audit logs

## Production Deployment (MSP)

Once verified in dev, prepare for MSP deployment:

```bash
# 1. Create service.yaml in managed-services
cat > service.yaml << 'EOF'
service:
  id: sg-sales-workbench
  name: Sales Workbench
  owners:
    - revenue  # (use actual Opsgenie team)
  
build:
  image: us-docker.pkg.dev/sourcegraph-images/internal/sg-sales-workbench
  source:
    repo: github.com/your-org/sg-sales-workbench

environments:
  - id: prod
    env:
      GONG_SOURCE: bigquery
      SALESFORCE_SOURCE: bigquery
      GCP_PROJECT_ID: sg-sales-workbench-prod-xxxx
      GCP_DATASET_ID: sales_workbench_prod
    secretEnv:
      GCP_KEY_FILE: projects/sg-sales-workbench-prod/secrets/gcp-sa-key
EOF

# 2. Initialize MSP
cd ~/managed-services
sg msp init

# 3. Generate Terraform
sg msp generate sg-sales-workbench prod

# 4. Create pull request
git checkout -b feat/sg-sales-workbench
git add services/sg-sales-workbench/
git commit -m "Add sg-sales-workbench to MSP"
git push origin feat/sg-sales-workbench
```

## References

- [BigQuery Documentation](https://cloud.google.com/bigquery/docs)
- [Service Account Key Management](https://cloud.google.com/iam/docs/service-account-keys)
- [MSP Implementation Guide](https://notion.so) (internal)
- Local files:
  - `src/services/bqClient.ts` - BigQuery client
  - `src/clients/gongBigQueryClient.ts` - Gong queries
  - `src/clients/salesforceBigQueryClient.ts` - Salesforce queries
  - `scripts/migrate-gong-to-bq.ts` - Gong migration
  - `scripts/migrate-salesforce-to-bq.ts` - Salesforce migration

## Checklist

- [ ] Service account JSON saved to `config/gcp-service-account.json`
- [ ] BigQuery dataset created: `sales_workbench_dev`
- [ ] Required tables created (6 tables)
- [ ] Validation script passes: `npx tsx scripts/validate-bigquery-setup.ts`
- [ ] Gong migration complete: `npm run gong:bq-sync`
- [ ] Salesforce migration complete: `npx tsx scripts/migrate-salesforce-to-bq.ts`
- [ ] Cloud mode tested: `GONG_SOURCE=bigquery npm run start:web`
- [ ] Health checks pass: `/api/health/bigquery` returns 200
- [ ] Production ready for MSP deployment

## Next Steps

1. **Immediate:** Run validation and migrations (today)
2. **This week:** Test cloud mode with full data
3. **Next week:** Configure MSP and prepare for production deployment
4. **Production:** Deploy via MSP with automatic monitoring

---

**Current Phase:** 3 (Data Migrations)  
**Blocked:** No  
**Status:** Ready to execute  
**ETA:** 2-4 hours total (validation + migrations)
