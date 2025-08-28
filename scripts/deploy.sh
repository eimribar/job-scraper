#!/bin/bash

# Sales Tool Detector - Production Deployment Script
# This script handles the complete deployment process

set -e  # Exit on any error

echo "🚀 Sales Tool Detector - Production Deployment"
echo "=============================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run from project root."
    exit 1
fi

# Check for required files
echo "📋 Pre-deployment checks..."
required_files=(
    "vercel.json"
    ".env.production"
    "app/api/cron/weekly/route.ts"
    "lib/services/jobProcessor.ts"
    "lib/services/scheduler.ts"
)

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ Missing required file: $file"
        exit 1
    fi
    echo "✅ Found: $file"
done

# Build project locally to check for errors
echo ""
echo "🔨 Building project locally..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful"
else
    echo "❌ Build failed. Please fix errors before deploying."
    exit 1
fi

# Check environment variables
echo ""
echo "🔐 Checking environment variables..."
if [ ! -f ".env.local" ]; then
    echo "❌ .env.local not found"
    exit 1
fi

# Check critical env vars
source .env.local
required_vars=(
    "NEXT_PUBLIC_SUPABASE_URL"
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    "OPENAI_API_KEY"
    "APIFY_TOKEN"
)

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Missing environment variable: $var"
        exit 1
    fi
    echo "✅ $var is set"
done

# Deploy to Vercel
echo ""
echo "🚢 Deploying to Vercel..."
npx vercel --prod --yes

if [ $? -eq 0 ]; then
    echo "✅ Deployment successful"
else
    echo "❌ Deployment failed"
    exit 1
fi

# Wait for deployment to be ready
echo ""
echo "⏳ Waiting for deployment to be ready..."
sleep 30

# Test production deployment
echo ""
echo "🧪 Testing production deployment..."
node scripts/monitor-production.js

echo ""
echo "=============================================="
echo "🎉 DEPLOYMENT COMPLETE!"
echo "=============================================="
echo ""
echo "📋 Next Steps:"
echo "1. Check Vercel dashboard for deployment URL"
echo "2. Update NEXT_PUBLIC_APP_URL in Vercel environment variables"
echo "3. Set up Supabase service role key"
echo "4. Generate and set CRON_SECRET for security"
echo "5. Configure Slack webhook for alerts (optional)"
echo "6. Monitor first automated run on Monday"
echo ""
echo "🔗 Important URLs:"
echo "- Vercel Dashboard: https://vercel.com/dashboard"
echo "- Supabase Dashboard: https://supabase.com/dashboard"
echo "- GitHub Repository: https://github.com/eimribar/job-scraper"
echo ""
echo "Happy hunting for Outreach.io and SalesLoft users! 🎯"