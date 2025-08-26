#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise(resolve => rl.question(query, resolve));

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function header(title) {
  console.log('\n' + '='.repeat(50));
  log(title, 'bright');
  console.log('='.repeat(50) + '\n');
}

async function checkPrerequisites() {
  header('🔍 Checking Prerequisites');
  
  const checks = {
    'Node.js': () => {
      const version = process.version;
      const major = parseInt(version.split('.')[0].substring(1));
      return major >= 18 ? { passed: true, version } : { passed: false, version, required: '18+' };
    },
    'npm': () => {
      try {
        const version = execSync('npm --version', { encoding: 'utf8' }).trim();
        return { passed: true, version };
      } catch {
        return { passed: false };
      }
    }
  };

  let allPassed = true;
  for (const [tool, check] of Object.entries(checks)) {
    const result = check();
    if (result.passed) {
      log(`✅ ${tool} (${result.version})`, 'green');
    } else {
      log(`❌ ${tool} ${result.required ? `requires ${result.required}` : 'not found'}`, 'red');
      allPassed = false;
    }
  }

  return allPassed;
}

async function setupSupabase() {
  header('🗄️  Supabase Setup');
  
  log('To set up Supabase, you need to:', 'cyan');
  log('1. Go to https://supabase.com and create an account', 'yellow');
  log('2. Create a new project', 'yellow');
  log('3. Wait for the project to initialize (~2 minutes)', 'yellow');
  log('4. Go to Settings → API to find your credentials\n', 'yellow');
  
  const hasSupabase = await question('Do you have a Supabase project ready? (y/n): ');
  
  if (hasSupabase.toLowerCase() === 'y') {
    const url = await question('Enter your Supabase URL (e.g., https://abc.supabase.co): ');
    const anonKey = await question('Enter your Supabase anon key: ');
    const serviceKey = await question('Enter your Supabase service role key: ');
    
    return {
      NEXT_PUBLIC_SUPABASE_URL: url,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
      SUPABASE_SERVICE_ROLE_KEY: serviceKey
    };
  } else {
    log('\n📝 Instructions to create a Supabase project:', 'blue');
    log('1. Visit: https://app.supabase.com/sign-up', 'cyan');
    log('2. Click "New project"', 'cyan');
    log('3. Enter project details:', 'cyan');
    log('   - Project name: sales-tool-detector', 'yellow');
    log('   - Database password: (save this securely!)', 'yellow');
    log('   - Region: Choose closest to you', 'yellow');
    log('4. Click "Create new project" and wait', 'cyan');
    log('5. Once ready, go to Settings → API', 'cyan');
    log('6. Copy the URL and both keys', 'cyan');
    
    return null;
  }
}

async function setupOpenAI() {
  header('🤖 OpenAI Setup');
  
  log('To set up OpenAI:', 'cyan');
  log('1. Go to https://platform.openai.com/api-keys', 'yellow');
  log('2. Create a new API key', 'yellow');
  log('3. Add billing details and credits\n', 'yellow');
  
  const hasOpenAI = await question('Do you have an OpenAI API key? (y/n): ');
  
  if (hasOpenAI.toLowerCase() === 'y') {
    const apiKey = await question('Enter your OpenAI API key: ');
    const useDefault = await question('Use GPT-4o-mini for cost efficiency? (y/n): ');
    
    return {
      OPENAI_API_KEY: apiKey,
      OPENAI_MODEL: useDefault.toLowerCase() === 'y' ? 'gpt-4o-mini' : 'gpt-4o',
      OPENAI_TEMPERATURE: '0.3'
    };
  } else {
    log('\n📝 Instructions to get an OpenAI API key:', 'blue');
    log('1. Visit: https://platform.openai.com/signup', 'cyan');
    log('2. Go to API keys section', 'cyan');
    log('3. Click "Create new secret key"', 'cyan');
    log('4. Copy and save the key securely', 'cyan');
    log('5. Add payment method for API usage', 'cyan');
    
    return null;
  }
}

async function setupApify() {
  header('🕷️  Apify Setup');
  
  log('To set up Apify:', 'cyan');
  log('1. Go to https://apify.com and create an account', 'yellow');
  log('2. Get your API token from Account → Integrations', 'yellow');
  log('3. Ensure you have access to the required actors\n', 'yellow');
  
  const hasApify = await question('Do you have an Apify account? (y/n): ');
  
  if (hasApify.toLowerCase() === 'y') {
    const token = await question('Enter your Apify API token: ');
    
    return {
      APIFY_TOKEN: token,
      APIFY_INDEED_ACTOR: 'misceres~indeed-scraper',
      APIFY_LINKEDIN_ACTOR: 'bebity~linkedin-jobs-scraper'
    };
  } else {
    log('\n📝 Instructions to get an Apify token:', 'blue');
    log('1. Visit: https://console.apify.com/sign-up', 'cyan');
    log('2. Complete registration', 'cyan');
    log('3. Go to Settings → Integrations', 'cyan');
    log('4. Copy your API token', 'cyan');
    log('5. Test these actors work:', 'cyan');
    log('   - misceres~indeed-scraper', 'yellow');
    log('   - bebity~linkedin-jobs-scraper', 'yellow');
    
    return null;
  }
}

async function setupOptionalFeatures() {
  header('⚙️  Optional Features');
  
  const features = {};
  
  const enableAuth = await question('Enable authentication? (y/n): ');
  features.ENABLE_AUTH = enableAuth.toLowerCase() === 'y' ? 'true' : 'false';
  
  const enableSlack = await question('Enable Slack notifications? (y/n): ');
  if (enableSlack.toLowerCase() === 'y') {
    features.ENABLE_SLACK_NOTIFICATIONS = 'true';
    features.SLACK_WEBHOOK_URL = await question('Enter Slack webhook URL: ');
  } else {
    features.ENABLE_SLACK_NOTIFICATIONS = 'false';
  }
  
  const enableAuto = await question('Enable automated scraping? (y/n): ');
  features.ENABLE_AUTO_SCRAPING = enableAuto.toLowerCase() === 'y' ? 'true' : 'false';
  
  // Set defaults
  features.NEXT_PUBLIC_APP_URL = 'http://localhost:3001';
  features.SCRAPING_RATE_LIMIT = '10';
  features.ANALYSIS_RATE_LIMIT = '30';
  features.BATCH_SIZE = '20';
  features.MAX_CONCURRENT_ANALYSIS = '5';
  features.API_RATE_LIMIT_PER_MINUTE = '100';
  features.NODE_ENV = 'development';
  
  return features;
}

function createEnvFile(config) {
  const envPath = path.join(process.cwd(), '.env.local');
  let envContent = '# Sales Tool Detector Configuration\n';
  envContent += '# Generated on ' + new Date().toISOString() + '\n\n';
  
  for (const [key, value] of Object.entries(config)) {
    if (value !== null && value !== undefined) {
      envContent += `${key}=${value}\n`;
    }
  }
  
  fs.writeFileSync(envPath, envContent);
  log('\n✅ Created .env.local file', 'green');
}

async function runDatabaseMigration() {
  header('🔧 Database Migration');
  
  const runMigration = await question('Run database migrations now? (y/n): ');
  if (runMigration.toLowerCase() === 'y') {
    log('Running migrations...', 'yellow');
    
    try {
      // Create a migration script
      const migrationScript = `
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function runMigration() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  const schema = fs.readFileSync(
    path.join(__dirname, '..', 'supabase-schema.sql'), 
    'utf8'
  );
  
  const { error } = await supabase.rpc('exec_sql', { sql: schema });
  
  if (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } else {
    console.log('✅ Database migration completed successfully');
  }
}

runMigration();
      `;
      
      fs.writeFileSync(path.join(__dirname, 'run-migration.js'), migrationScript);
      execSync('node scripts/run-migration.js', { stdio: 'inherit' });
      
      log('✅ Database migration completed', 'green');
    } catch (error) {
      log('❌ Migration failed: ' + error.message, 'red');
      log('You can run it manually later with: npm run migrate', 'yellow');
    }
  }
}

async function testConnections(config) {
  header('🧪 Testing Connections');
  
  const testConnection = await question('Test service connections? (y/n): ');
  if (testConnection.toLowerCase() !== 'y') return;
  
  // Test Supabase
  if (config.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      log('Testing Supabase connection...', 'yellow');
      const response = await fetch(config.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/', {
        headers: {
          'apikey': config.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        }
      });
      if (response.ok) {
        log('✅ Supabase connection successful', 'green');
      } else {
        log('⚠️  Supabase connection failed', 'red');
      }
    } catch (error) {
      log('⚠️  Supabase connection error: ' + error.message, 'red');
    }
  }
  
  // Test OpenAI
  if (config.OPENAI_API_KEY) {
    try {
      log('Testing OpenAI connection...', 'yellow');
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${config.OPENAI_API_KEY}`,
        }
      });
      if (response.ok) {
        log('✅ OpenAI connection successful', 'green');
      } else {
        log('⚠️  OpenAI connection failed', 'red');
      }
    } catch (error) {
      log('⚠️  OpenAI connection error: ' + error.message, 'red');
    }
  }
  
  // Test Apify
  if (config.APIFY_TOKEN) {
    try {
      log('Testing Apify connection...', 'yellow');
      const response = await fetch(`https://api.apify.com/v2/acts?token=${config.APIFY_TOKEN}`);
      if (response.ok) {
        log('✅ Apify connection successful', 'green');
      } else {
        log('⚠️  Apify connection failed', 'red');
      }
    } catch (error) {
      log('⚠️  Apify connection error: ' + error.message, 'red');
    }
  }
}

async function main() {
  console.clear();
  log('🚀 Sales Tool Detector - Backend Setup Wizard', 'bright');
  log('This wizard will help you configure your backend services\n', 'cyan');
  
  // Check prerequisites
  const prereqsPassed = await checkPrerequisites();
  if (!prereqsPassed) {
    log('\n❌ Please fix the prerequisites before continuing', 'red');
    process.exit(1);
  }
  
  const config = {};
  
  // Setup each service
  const supabaseConfig = await setupSupabase();
  if (supabaseConfig) Object.assign(config, supabaseConfig);
  
  const openAIConfig = await setupOpenAI();
  if (openAIConfig) Object.assign(config, openAIConfig);
  
  const apifyConfig = await setupApify();
  if (apifyConfig) Object.assign(config, apifyConfig);
  
  const features = await setupOptionalFeatures();
  Object.assign(config, features);
  
  // Create env file
  if (Object.keys(config).length > 0) {
    createEnvFile(config);
    
    // Test connections
    await testConnections(config);
    
    // Run migrations
    if (supabaseConfig) {
      await runDatabaseMigration();
    }
  } else {
    log('\n⚠️  No configuration was provided. Please set up services manually.', 'yellow');
  }
  
  header('📋 Next Steps');
  
  log('1. Complete any missing service setups', 'cyan');
  log('2. Copy .env.local.example to .env.local and fill in values', 'cyan');
  log('3. Run database migrations: npm run migrate', 'cyan');
  log('4. Start the development server: npm run dev', 'cyan');
  log('5. Test the API endpoints:', 'cyan');
  log('   - POST /api/scrape - Start scraping', 'yellow');
  log('   - POST /api/analyze - Analyze jobs', 'yellow');
  log('   - GET /api/dashboard - View stats', 'yellow');
  
  log('\n✨ Setup wizard completed!', 'green');
  rl.close();
}

main().catch(error => {
  log('\n❌ Setup failed: ' + error.message, 'red');
  process.exit(1);
});