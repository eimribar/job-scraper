#!/bin/bash

# PM2 Manager Script for Sales Tool Detector
# Manages the continuous analyzer and weekly scraper processes

PM2_CMD="npx pm2"

case "$1" in
  "start")
    echo "🚀 Starting Sales Tool Detector automation processes..."
    
    # Stop any existing processes first
    $PM2_CMD delete all 2>/dev/null || true
    
    # Start processes using ecosystem config
    $PM2_CMD start ecosystem.config.js
    
    # Show status
    $PM2_CMD status
    $PM2_CMD logs --lines 10
    ;;
    
  "stop")
    echo "🛑 Stopping Sales Tool Detector automation processes..."
    $PM2_CMD stop all
    $PM2_CMD status
    ;;
    
  "restart")
    echo "🔄 Restarting Sales Tool Detector automation processes..."
    $PM2_CMD restart all
    $PM2_CMD status
    ;;
    
  "status")
    echo "📊 Sales Tool Detector automation status:"
    $PM2_CMD status
    $PM2_CMD monit
    ;;
    
  "logs")
    echo "📋 Showing logs for all processes..."
    $PM2_CMD logs
    ;;
    
  "logs-analyzer")
    echo "📋 Showing logs for continuous analyzer..."
    $PM2_CMD logs continuous-analyzer
    ;;
    
  "logs-scraper")
    echo "📋 Showing logs for weekly scraper..."
    $PM2_CMD logs weekly-scraper
    ;;
    
  "setup")
    echo "⚙️ Setting up PM2 for auto-startup..."
    $PM2_CMD startup
    echo "Run the command shown above, then run: $0 save"
    ;;
    
  "save")
    echo "💾 Saving current PM2 processes for auto-startup..."
    $PM2_CMD save
    echo "✅ PM2 processes will now start automatically on system boot"
    ;;
    
  "delete")
    echo "🗑️ Deleting all PM2 processes..."
    $PM2_CMD delete all
    ;;
    
  *)
    echo "Sales Tool Detector PM2 Manager"
    echo "================================"
    echo "Usage: $0 {start|stop|restart|status|logs|logs-analyzer|logs-scraper|setup|save|delete}"
    echo ""
    echo "Commands:"
    echo "  start           - Start both automation processes"
    echo "  stop            - Stop all processes"
    echo "  restart         - Restart all processes" 
    echo "  status          - Show process status and monitoring"
    echo "  logs            - Show logs for all processes"
    echo "  logs-analyzer   - Show logs for continuous analyzer only"
    echo "  logs-scraper    - Show logs for weekly scraper only"
    echo "  setup           - Configure PM2 for auto-startup on system boot"
    echo "  save            - Save current processes for auto-startup"
    echo "  delete          - Delete all processes"
    echo ""
    echo "Examples:"
    echo "  $0 start        # Start automation"
    echo "  $0 logs         # View logs"
    echo "  $0 status       # Check status"
    exit 1
    ;;
esac