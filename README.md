# Volume Pattern Backtest Application

A professional trading signal backtesting application that analyzes volume patterns and provides comprehensive performance metrics for cryptocurrency trading strategies.

## 🚀 Features

- **Real-time Binance API Integration**: Live data from 450+ USDT perpetual trading pairs
- **Advanced Volume Pattern Detection**: Sophisticated algorithms for identifying trading signals
- **Interactive Charts**: TradingView Lightweight Charts with local timezone support
- **Comprehensive Backtesting**: Detailed performance analysis with multiple metrics
- **Professional Dashboard**: Real-time monitoring and management interface
- **Production-Ready**: PM2 process management with automatic restarts and logging

## 📋 System Requirements

- **Node.js**: Version 16.x or higher
- **MongoDB**: Version 4.4 or higher
- **PM2**: Global installation required for production deployment
- **Memory**: Minimum 4GB RAM recommended
- **Storage**: At least 2GB free space for logs and data

## 🛠️ Installation

### 1. Clone the Repository

```bash
git clone https://github.com/hammamsawalma/VolumeFlowPro.git
cd VolumeFlowPro
```

### 2. Install PM2 Globally

```bash
npm install -g pm2
```

### 3. Install Dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Return to root directory
cd ..
```

### 4. Configure Environment Variables

#### Backend Configuration (`backend/.env`)
```env
# Server Configuration
PORT=5002

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/volume_backtest

# API Configuration
NODE_ENV=production

# Rate Limiting
BINANCE_RATE_LIMIT=1200

# Logging
LOG_LEVEL=info
```

#### Frontend Configuration (`frontend/.env`)
```env
REACT_APP_API_URL=http://localhost:5002/api
```

### 5. Build the Application

```bash
# Build backend (TypeScript compilation)
cd backend
npm run build

# Build frontend (React production build)
cd ../frontend
npm run build

# Return to root directory
cd ..
```

### 6. Install Serve (for frontend production serving)

```bash
npm install -g serve
```

## 🚀 Running the Application

### Production Mode (Recommended)

Start both backend and frontend using PM2:

```bash
# Start all services
pm2 start ecosystem.config.js

# Check status
pm2 status

# View logs
pm2 logs

# Monitor processes
pm2 monit
```

### Development Mode

For development with hot reload:

```bash
# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Start frontend
cd frontend
npm start
```

## 📊 Application Access

- **Frontend Dashboard**: http://localhost:3000
- **Backend API**: http://localhost:5002/api
- **API Health Check**: http://localhost:5002/api/health
- **Binance Connection Test**: http://localhost:5002/api/binance/test-connection

## 🔧 PM2 Management Commands

### Basic Operations
```bash
# Start services
pm2 start ecosystem.config.js

# Stop services
pm2 stop all

# Restart services
pm2 restart all

# Delete services
pm2 delete all

# Reload services (zero-downtime)
pm2 reload all
```

### Monitoring & Logs
```bash
# View real-time logs
pm2 logs

# View specific service logs
pm2 logs volume-backtest-backend
pm2 logs volume-backtest-frontend

# Monitor CPU/Memory usage
pm2 monit

# Show process information
pm2 show volume-backtest-backend
```

### Auto-startup Configuration
```bash
# Generate startup script
pm2 startup

# Save current process list
pm2 save

# Resurrect saved processes
pm2 resurrect
```

## 📁 Project Structure

```
VolumeFlowPro/
├── backend/                 # Node.js/Express API server
│   ├── src/
│   │   ├── models/         # Database models
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   └── types/          # TypeScript definitions
│   ├── logs/               # Application logs
│   └── dist/               # Compiled JavaScript
├── frontend/               # React application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API services
│   │   └── types/          # TypeScript definitions
│   ├── build/              # Production build
│   └── logs/               # Application logs
├── ecosystem.config.js     # PM2 configuration
└── README.md              # This file
```

## 🔌 API Endpoints

### Binance Integration
- `GET /api/binance/test-connection` - Test API connection
- `GET /api/binance/symbols` - Get available trading pairs
- `GET /api/binance/chart-data/:symbol/:timeframe` - Get chart data

### Backtesting
- `POST /api/backtest/start` - Start new backtest
- `GET /api/backtest/:id` - Get backtest results
- `GET /api/backtest/:id/progress` - Get backtest progress
- `DELETE /api/backtest/:id` - Delete backtest

### System
- `GET /api/health` - Health check
- `GET /api/binance/server-time` - Get server time

## 🎯 Key Features Explained

### Volume Pattern Detection
The application uses sophisticated algorithms to detect:
- **Primary Buy Signals**: Strong bullish volume patterns
- **Basic Buy Signals**: Moderate bullish indicators
- **Primary Sell Signals**: Strong bearish volume patterns
- **Basic Sell Signals**: Moderate bearish indicators

### Chart Timezone Handling
Charts automatically display in your local timezone, converting UTC timestamps from Binance API to your browser's timezone for accurate time representation.

### Performance Metrics
Comprehensive backtesting provides:
- Total signals detected
- Success rate percentage
- Profit/loss analysis
- Risk metrics
- Drawdown analysis

## 🔍 Troubleshooting

### Common Issues

#### 1. Binance API Connection Failed
```bash
# Check internet connection
curl -s https://api.binance.com/api/v3/ping

# Restart backend service
pm2 restart volume-backtest-backend
```

#### 2. Frontend Not Loading
```bash
# Check if build exists
ls -la frontend/build/

# Rebuild frontend
cd frontend && npm run build

# Restart frontend service
pm2 restart volume-backtest-frontend
```

#### 3. MongoDB Connection Issues
```bash
# Check MongoDB status
brew services list | grep mongodb
# or
systemctl status mongod

# Start MongoDB
brew services start mongodb-community
# or
systemctl start mongod
```

#### 4. Port Already in Use
```bash
# Find process using port 5002
lsof -ti:5002

# Kill process (replace PID)
kill -9 <PID>

# Restart services
pm2 restart all
```

### Log Analysis
```bash
# View error logs
pm2 logs --err

# View specific timeframe
pm2 logs --lines 100

# Follow logs in real-time
pm2 logs --follow
```

## 🔒 Security Considerations

- API endpoints include rate limiting
- Input validation on all parameters
- Error handling without sensitive data exposure
- MongoDB connection with authentication (configure as needed)
- CORS configuration for production deployment

## 📈 Performance Optimization

- PM2 cluster mode available for scaling
- MongoDB indexing for faster queries
- Efficient data caching strategies
- Optimized chart rendering
- Lazy loading for large datasets

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Check the troubleshooting section above
- Review PM2 logs for detailed error information

## 🔄 Updates and Maintenance

### Regular Maintenance
```bash
# Update dependencies
npm update

# Clean PM2 logs
pm2 flush

# Restart services for updates
pm2 reload all
```

### Backup Recommendations
- Regular MongoDB backups
- Configuration file backups
- Log rotation setup
- Process monitoring alerts

---

**Version**: 1.0.0  
**Last Updated**: January 2025  
**Status**: Production Ready ✅
