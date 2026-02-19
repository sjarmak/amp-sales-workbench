#!/bin/bash

# Phase 3: Data Migration Execution Script
# This script guides you through the complete Phase 3 execution
# GCP service account should be saved to config/gcp-service-account.json

set -e

echo "═══════════════════════════════════════════════════════════════"
echo "  Phase 3: Data Migration Execution"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Check if service account file exists
if [ ! -f "config/gcp-service-account.json" ]; then
    echo "❌ Service account file not found: config/gcp-service-account.json"
    echo ""
    echo "Please save your GCP service account JSON to:"
    echo "  cp /path/to/downloaded/sa.json config/gcp-service-account.json"
    exit 1
fi

echo "✅ Service account found"
echo ""

# Set environment variables
export GCP_PROJECT_ID=${GCP_PROJECT_ID:?'Set GCP_PROJECT_ID in .env'}
export GCP_DATASET_ID=${GCP_DATASET_ID:?'Set GCP_DATASET_ID in .env'}
export GCP_KEY_FILE=$(pwd)/config/gcp-service-account.json

echo "Environment configured:"
echo "  GCP_PROJECT_ID:  $GCP_PROJECT_ID"
echo "  GCP_DATASET_ID:  $GCP_DATASET_ID"
echo "  GCP_KEY_FILE:    $GCP_KEY_FILE"
echo ""

# Step 1: Validate setup
echo "───────────────────────────────────────────────────────────────"
echo "Step 1: Validating BigQuery Setup"
echo "───────────────────────────────────────────────────────────────"
read -p "Press ENTER to continue..." < /dev/tty

npm run validate:bigquery || {
    echo "❌ Validation failed. Check your service account and GCP setup."
    exit 1
}

echo ""
echo "✅ Validation passed!"
echo ""

# Step 2: Gong migration
echo "───────────────────────────────────────────────────────────────"
echo "Step 2: Migrating Gong Data (Parquet → BigQuery)"
echo "───────────────────────────────────────────────────────────────"
echo ""
echo "Running dry-run first (shows what would be migrated, no writes)..."
echo ""
read -p "Press ENTER to start dry-run..." < /dev/tty

DEBUG=1 npx tsx scripts/migrate-gong-to-bq.ts --dry-run --limit 10

echo ""
echo "Review the output above. If it looks good, proceed with full migration."
read -p "Run full Gong migration? (y/n) " -n 1 -r < /dev/tty
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Starting Gong migration..."
    npx tsx scripts/migrate-gong-to-bq.ts
    
    echo ""
    echo "Verifying migration..."
    echo "Query: SELECT COUNT(*) FROM \`$GCP_PROJECT_ID.$GCP_DATASET_ID.gong_calls\`"
    bq query --use_legacy_sql=false \
        "SELECT COUNT(*) as count FROM \`$GCP_PROJECT_ID.$GCP_DATASET_ID.gong_calls\`" \
        --project_id=$GCP_PROJECT_ID
else
    echo "Skipping Gong migration"
fi

echo ""

# Step 3: Salesforce migration
echo "───────────────────────────────────────────────────────────────"
echo "Step 3: Migrating Salesforce Data (JSON → BigQuery)"
echo "───────────────────────────────────────────────────────────────"
echo ""
echo "Running dry-run first..."
read -p "Press ENTER to start dry-run..." < /dev/tty

npx tsx scripts/migrate-salesforce-to-bq.ts --dry-run

echo ""
read -p "Run full Salesforce migration? (y/n) " -n 1 -r < /dev/tty
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Starting Salesforce migration..."
    npx tsx scripts/migrate-salesforce-to-bq.ts
    
    echo ""
    echo "Verifying migration..."
    bq query --use_legacy_sql=false \
        "SELECT COUNT(*) as count FROM \`$GCP_PROJECT_ID.$GCP_DATASET_ID.salesforce_accounts\`" \
        --project_id=$GCP_PROJECT_ID
else
    echo "Skipping Salesforce migration"
fi

echo ""

# Step 4: Test cloud mode
echo "───────────────────────────────────────────────────────────────"
echo "Step 4: Testing Cloud Mode"
echo "───────────────────────────────────────────────────────────────"
echo ""
echo "Start the system with cloud data sources enabled:"
echo ""
echo "  GONG_SOURCE=bigquery \\"
echo "  SALESFORCE_SOURCE=bigquery \\"
echo "  ENRICHED_SOURCE=bigquery \\"
echo "  npm run start:web"
echo ""
echo "Then verify in browser:"
echo "  http://localhost:3001/api/status/data-sources"
echo "  http://localhost:3001/api/health/bigquery"
echo ""
read -p "Start system now? (y/n) " -n 1 -r < /dev/tty
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    GONG_SOURCE=bigquery \
    SALESFORCE_SOURCE=bigquery \
    ENRICHED_SOURCE=bigquery \
    npm run start:web
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ✅ Phase 3 Complete!"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. Verify all data was migrated correctly"
echo "  2. Test the UI with cloud data sources"
echo "  3. Prepare for MSP deployment"
echo ""
