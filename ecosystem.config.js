module.exports = {
  apps: [
    {
      name: 'continuous-analyzer',
      script: 'scripts/continuous-analysis-new.js',
      cwd: '/Users/eimribar/sales-tool-detector',
      env: {
        NODE_ENV: 'production'
      },
      // Auto-restart settings
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      
      // Logging
      log_file: './logs/continuous-analyzer.log',
      out_file: './logs/continuous-analyzer-out.log',
      error_file: './logs/continuous-analyzer-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Restart policy
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s',
      
      // Process management
      instances: 1,
      exec_mode: 'fork',
      
      // Environment variables
      env_file: '.env.local'
    },
    {
      name: 'weekly-scraper',
      script: 'scripts/weekly-scraper-new.js', 
      cwd: '/Users/eimribar/sales-tool-detector',
      env: {
        NODE_ENV: 'production'
      },
      // Auto-restart settings
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      
      // Logging
      log_file: './logs/weekly-scraper.log',
      out_file: './logs/weekly-scraper-out.log', 
      error_file: './logs/weekly-scraper-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Restart policy  
      restart_delay: 10000,
      max_restarts: 5,
      min_uptime: '30s',
      
      // Process management
      instances: 1,
      exec_mode: 'fork',
      
      // Environment variables
      env_file: '.env.local'
    }
  ],
  
  // Deployment configuration (optional)
  deploy: {
    production: {
      user: 'eimribar',
      host: 'localhost',
      ref: 'origin/main',
      repo: 'https://github.com/eimribar/job-scraper.git',
      path: '/Users/eimribar/sales-tool-detector',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production'
    }
  }
};