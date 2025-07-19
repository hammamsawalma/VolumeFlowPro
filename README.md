# 🌊 VolumeFlow Pro
### Professional Volume Pattern Analysis & Backtesting Platform

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/hammamsawalma/VolumeFlowPro)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node.js-18%2B-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.0%2B-blue.svg)](https://www.typescriptlang.org/)

> **Core Version 1.0.0** - Production-ready volume pattern analysis platform for Binance Futures trading with advanced backtesting capabilities and professional analytics dashboard.

---

## 🎯 **What is VolumeFlow Pro?**

VolumeFlow Pro is a comprehensive, production-ready backtesting application that analyzes volume-based trading signals on Binance Futures (USDT Perpetual contracts). Built with modern web technologies and deployed using PM2 for enterprise-grade reliability.

### ✨ **Key Features**
- 🔍 **Advanced Volume Pattern Detection** - 4 distinct signal types with Pine Script accuracy
- 📊 **Interactive Analytics Dashboard** - 5-tab comprehensive analysis interface
- 🚀 **Real-time Binance Integration** - Live market data with rate limiting
- 📈 **Professional Backtesting Engine** - Historical performance analysis
- 🎨 **Modern UI/UX** - Material-UI based responsive interface
- 🔧 **Production Deployment** - PM2 process management with auto-restart
- 📤 **Data Export** - CSV export with filtering capabilities
- 🛡️ **Enterprise Ready** - Logging, monitoring, and error handling

---

## 📊 **The Four Volume Signals**

### 🟢 **Primary BUY Signal**
- **Pattern**: 2 consecutive red candles → 1 green candle
- **Volume**: Second red + current green candles must have significant volume
- **Price**: Green candle closes above second red candle's open
- **Body Ratio**: Second red candle ≥ 0.61 body ratio

### 🔵 **Basic BUY Signal**
- **Pattern**: 2 consecutive red candles → 1 green candle
- **Volume**: Current green candle must have significant volume
- **Price**: Green candle closes above FIRST red candle's open
- **Body Ratio**: No requirement (less strict)

### 🔴 **Primary SELL Signal**
- **Pattern**: 2 consecutive green candles → 1 red candle
- **Volume**: Second green + current red candles must have significant volume
- **Price**: Red candle closes below second green candle's open
- **Body Ratio**: Second green candle ≥ 0.61 body ratio

### 🟠 **Basic SELL Signal**
- **Pattern**: 2 consecutive green candles → 1 red candle
- **Volume**: Current red candle must have significant volume
- **Price**: Red candle closes below FIRST green candle's open
- **Body Ratio**: No requirement (less strict)

---

## 🏗️ **Technology Stack**

### **Backend**
- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js with comprehensive middleware
- **Database**: MongoDB for backtest result storage
- **API Integration**: Binance Futures API (public endpoints)
- **Process Management**: PM2 for production deployment

### **Frontend**
- **Framework**: React 18+ with TypeScript
- **UI Library**: Material-UI (MUI) v5
- **Charts**: Recharts for data visualization
- **State Management**: React Query for server state
- **Build Tool**: Create React App with TypeScript

### **DevOps & Deployment**
- **Process Manager**: PM2 with ecosystem configuration
- **Logging**: Structured logging with rotation
- **Monitoring**: Built-in health checks and metrics
- **Environment**: Production-ready configuration

---

## 🚀 **Quick Start Guide**

### **Prerequisites**

Before installing VolumeFlow Pro, ensure you have:

```bash
# Required software
Node.js >= 18.0.0
npm >= 8.0.0
PM2 (will be installed globally)
Git

# Check versions
node --version    # Should be 18+
npm --version     # Should be 8+
```

### **📦 Installation Steps**

#### **1. Clone & Setup Project**
```bash
# Clone the repository
git clone https://github.com/hammamsawalma/VolumeFlowPro.git
cd VolumeFlowPro

# Install PM2 globally (if not already installed)
npm install -g pm2
```

#### **2. Backend Configuration**
```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env

# Edit environment file (use your preferred editor)
nano .env
```

**Required Environment Variables:**
```env
# Server Configuration
PORT=5000
NODE_ENV=production

# MongoDB Configuration (if using MongoDB)
MONGODB_URI=mongodb://localhost:27017/volumeflow-pro

# API Configuration
API_BASE_URL=http://localhost:5000/api

# Binance API (public endpoints - no keys required)
BINANCE_BASE_URL=https://fapi.binance.com

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=./logs
```

#### **3. Frontend Configuration**
```bash
# Navigate to frontend directory
cd ../frontend

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env

# Edit frontend environment
nano .env
```

**Frontend Environment Variables:**
```env
# API Configuration
REACT_APP_API_URL=http://localhost:5000

# Build Configuration
GENERATE_SOURCEMAP=false
```

#### **4. Build Applications**
```bash
# Build backend (from backend directory)
cd ../backend
npm run build

# Build frontend (from frontend directory)
cd ../frontend
npm run build

# Return to root directory
cd ..
```

#### **5. PM2 Deployment**
```bash
# Start applications with PM2
npm start

# Verify applications are running
npm run status

# View logs
npm run logs

# Monitor applications
pm2 monit
```

---

## 🔧 **PM2 Configuration**

VolumeFlow Pro uses PM2 for production process management. The configuration is defined in `ecosystem.config.js`:

### **Ecosystem Configuration**
```javascript
module.exports = {
  apps: [
    {
      name: 'volumeflow-backend',
      script: './backend/dist/server.js',
      cwd: './backend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      // Auto-restart configuration
      watch: false,
      max_restarts: 10,
      min_uptime: '10s',
      
      // Logging
      log_file: './logs/backend-combined.log',
      out_file: './logs/backend-out.log',
      error_file: './logs/backend-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Memory management
      max_memory_restart: '500M'
    },
    {
      name: 'volumeflow-frontend',
      script: 'serve',
      args: '-s build -l 3000',
      cwd: './frontend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      // Logging
      log_file: './logs/frontend-combined.log',
      out_file: './logs/frontend-out.log',
      error_file: './logs/frontend-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
```

### **PM2 Management Commands**

```bash
# Start applications
npm start                    # Start both backend and frontend
pm2 start ecosystem.config.js

# Monitor applications
npm run status              # Show application status
pm2 status                  # PM2 status command
pm2 monit                   # Real-time monitoring

# View logs
npm run logs                # View all logs
pm2 logs volumeflow-backend # Backend logs only
pm2 logs volumeflow-frontend # Frontend logs only

# Restart applications
npm restart                 # Restart both applications
pm2 restart volumeflow-backend # Restart backend only

# Stop applications
npm stop                    # Stop both applications
pm2 stop all               # Stop all PM2 processes

# Advanced monitoring
pm2 show volumeflow-backend # Detailed process info
pm2 describe volumeflow-backend # Process description
```

---

## 🌐 **Accessing the Application**

Once deployed, access VolumeFlow Pro at:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000/api
- **Health Check**: http://localhost:5000/api/health

### **Application Structure**
```
VolumeFlow Pro/
├── 📊 Dashboard          # Overview and quick stats
├── ⚙️ Configuration      # Backtest setup and parameters
├── 🏃 Backtest Manager   # Running and managing backtests
├── 📈 Results           # Analytics dashboard with 5 tabs
│   ├── Distribution     # Signal type pie chart
│   ├── Timeline         # Performance over time
│   ├── Symbols          # Top performing symbols
│   ├── Risk/Reward      # Scatter plot analysis
│   └── Details          # Sortable performance table
└── ⚙️ Settings          # Application configuration
```

---

## 📊 **Analytics Dashboard Features**

### **🎯 Interactive Results Analysis**
- **Distribution Tab**: Signal type breakdown with pie charts
- **Timeline Tab**: Performance trends over time with line charts
- **Symbols Tab**: Top performing symbols with horizontal bar charts
- **Risk/Reward Tab**: Risk vs reward scatter plot analysis
- **Details Tab**: Sortable table with all performance metrics

### **🔍 Advanced Filtering**
- Filter by signal type (Primary/Basic Buy/Sell)
- Filter by symbol and timeframe
- Filter by performance criteria
- Filter by date ranges
- Export filtered results to CSV

### **📈 Performance Metrics**
- **Success Rate**: Percentage where drawup > drawdown
- **Risk/Reward Ratios**: Individual and average R/R
- **Max Drawup/Drawdown**: Peak movements within lookforward period
- **Time Analysis**: When peak movements occurred

---

## 🔧 **Configuration Options**

### **Backtest Parameters**
```javascript
{
  symbols: ['BTCUSDT', 'ETHUSDT', ...],     // USDT perpetual pairs
  timeframes: ['1h', '4h', '1d'],           // Supported timeframes
  startDate: '2023-01-01',                  // Historical start date
  endDate: '2024-01-01',                    // Historical end date
  lookforwardCandles: 24,                   // Analysis period
  signalTypes: ['PRIMARY_BUY', 'BASIC_BUY', 'PRIMARY_SELL', 'BASIC_SELL']
}
```

### **Volume Analysis Settings**
```javascript
{
  volumeMaLength: 610,        // Volume moving average period
  volumeStdLength: 610,       // Volume standard deviation period
  mediumThreshold: 1.0,       // Medium volume threshold
  highThreshold: 2.5,         // High volume threshold
  extraHighThreshold: 4.0,    // Extra high volume threshold
  bodyRatioThreshold: 0.61    // Body ratio requirement
}
```

---

## 📡 **API Documentation**

### **Binance Integration**
```bash
GET  /api/binance/symbols           # Get all USDT perpetual symbols
GET  /api/binance/timeframes        # Get supported timeframes
GET  /api/binance/limits            # Get historical data limits
GET  /api/binance/test-connection   # Test API connectivity
POST /api/binance/preview-data      # Preview data availability
GET  /api/binance/server-time       # Get server time sync
```

### **Backtesting Endpoints**
```bash
POST /api/backtest/start            # Start new backtest
GET  /api/backtest/:id              # Get backtest results
GET  /api/backtest                  # Get all backtest results (paginated)
GET  /api/backtest/:id/progress     # Get backtest progress
POST /api/backtest/:id/cancel       # Cancel running backtest
DELETE /api/backtest/:id            # Delete backtest result
POST /api/backtest/:id/signals/filter # Filter signals with criteria
GET  /api/backtest/:id/export/csv   # Export results to CSV
POST /api/backtest/validate-config  # Validate configuration
```

### **System Endpoints**
```bash
GET /api/health                     # Health check endpoint
```

---

## 🛠️ **Development & Debugging**

### **Development Mode**
```bash
# Backend development (with hot reload)
cd backend
npm run dev

# Frontend development (with hot reload)
cd frontend
npm start

# Both in development mode
npm run dev
```

### **Debugging & Logs**
```bash
# View real-time logs
pm2 logs --lines 100

# View specific application logs
pm2 logs volumeflow-backend --lines 50

# Log files location
./backend/logs/backend-combined.log
./frontend/logs/frontend-combined.log

# Debug mode
NODE_ENV=development npm run dev
```

### **Health Monitoring**
```bash
# Check application health
curl http://localhost:5000/api/health

# PM2 monitoring
pm2 monit

# Process information
pm2 show volumeflow-backend
```

---

## 🔒 **Security & Best Practices**

### **Environment Security**
- Never commit `.env` files to version control
- Use strong, unique passwords for databases
- Regularly update dependencies
- Monitor logs for suspicious activity

### **API Rate Limiting**
- Binance API: 1200 requests/minute (automatically managed)
- Built-in rate limiting and retry mechanisms
- Graceful error handling for API failures

### **Production Considerations**
- Use reverse proxy (nginx) for production
- Enable HTTPS with SSL certificates
- Configure firewall rules appropriately
- Regular backups of backtest results

---

## 🚨 **Troubleshooting**

### **Common Issues**

#### **Port Already in Use**
```bash
# Find process using port
lsof -i :5000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or change ports in environment files
```

#### **PM2 Process Not Starting**
```bash
# Check PM2 status
pm2 status

# View error logs
pm2 logs volumeflow-backend --err

# Restart with fresh logs
pm2 restart volumeflow-backend --update-env
```

#### **Database Connection Issues**
```bash
# Check MongoDB status (if using MongoDB)
sudo systemctl status mongod

# Test connection
mongo --eval "db.adminCommand('ismaster')"
```

#### **Build Failures**
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check Node.js version
node --version  # Should be 18+
```

### **Log Analysis**
```bash
# Backend errors
tail -f ./backend/logs/backend-error.log

# Frontend errors
tail -f ./frontend/logs/frontend-error.log

# Combined logs
tail -f ./logs/*-combined.log
```

---

## 📈 **Performance Optimization**

### **Backend Optimization**
- MongoDB indexing for faster queries
- API response caching
- Batch processing for large datasets
- Memory usage monitoring

### **Frontend Optimization**
- Code splitting and lazy loading
- Chart rendering optimization
- Efficient state management
- Bundle size optimization

### **PM2 Optimization**
```javascript
// ecosystem.config.js optimizations
{
  max_memory_restart: '500M',  // Restart if memory exceeds limit
  min_uptime: '10s',           // Minimum uptime before restart
  max_restarts: 10,            // Maximum restart attempts
  restart_delay: 4000          // Delay between restarts
}
```

---

## 🔄 **Updates & Maintenance**

### **Updating VolumeFlow Pro**
```bash
# Pull latest changes
git pull origin main

# Update dependencies
cd backend && npm update
cd ../frontend && npm update

# Rebuild applications
npm run build

# Restart with PM2
npm restart
```

### **Database Maintenance**
```bash
# Backup backtest results (if using MongoDB)
mongodump --db volumeflow-pro --out ./backups/

# Clean old logs
pm2 flush  # Clear PM2 logs
```

---

## 🤝 **Contributing**

### **Development Setup**
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Add tests if applicable
5. Commit changes: `git commit -m 'Add amazing feature'`
6. Push to branch: `git push origin feature/amazing-feature`
7. Submit a pull request

### **Code Standards**
- TypeScript for type safety
- ESLint for code quality
- Prettier for code formatting
- Comprehensive error handling
- Unit tests for critical functions

---

## 📞 **Support & Community**

### **Getting Help**
- 📖 **Documentation**: Check this README and inline code comments
- 🐛 **Issues**: Create an issue on GitHub for bugs
- 💡 **Feature Requests**: Submit enhancement requests
- 📧 **Contact**: [your-email@domain.com]

### **Community**
- ⭐ Star the repository if you find it useful
- 🍴 Fork and contribute improvements
- 📢 Share with other traders and developers

---

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 **Acknowledgments**

- **Binance API** for providing comprehensive market data
- **Pine Script Community** for volume analysis techniques
- **Open Source Libraries** that make this project possible
- **Contributors** who help improve VolumeFlow Pro

---

## 📊 **Project Stats**

- **Version**: 1.0.0 (Core Release)
- **Release Date**: January 2025
- **Language**: TypeScript
- **Backend**: Node.js + Express
- **Frontend**: React + Material-UI
- **Deployment**: PM2 Process Manager
- **Status**: Production Ready ✅

---

**🌊 VolumeFlow Pro - Professional Volume Pattern Analysis Platform**

*Built with ❤️ for the trading community*
