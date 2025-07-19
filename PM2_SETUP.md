# PM2 Setup Guide - Volume Backtest Application

This guide will help you run both the backend and frontend applications simultaneously using PM2 process manager.

## 🚀 Quick Start

### Prerequisites
- Node.js (v18+) ✅ Installed
- MongoDB running (for backend data storage)
- PM2 installed ✅ Installed locally

### 1. Install Dependencies
```bash
# Install all dependencies for both backend and frontend
npm run setup
```

### 2. Configure Environment
```bash
# Backend environment
cp backend/.env.example backend/.env
# Edit backend/.env with your MongoDB connection string

# Frontend environment is already configured in frontend/.env
```

### 3. Start Both Applications
```bash
# Start both backend and frontend with PM2
npm start

# Or use PM2 directly
pm2 start ecosystem.config.js
```

## 📋 Available Commands

### PM2 Management
```bash
# Start both applications
npm start                    # Start in development mode
npm run dev                  # Start in development mode (explicit)
npm run prod                 # Start in production mode

# Control applications
npm stop                     # Stop both applications
npm restart                  # Restart both applications
npm run reload               # Reload both applications (zero-downtime)
npm run delete               # Delete both applications from PM2

# Monitoring
npm run status               # Show status of all processes
npm run logs                 # Show logs from both applications
npm run logs:backend         # Show only backend logs
npm run logs:frontend        # Show only frontend logs
npm run monit                # Open PM2 monitoring dashboard
```

### Development Commands
```bash
# Install dependencies
npm run install:all          # Install for both backend and frontend
npm run install:backend      # Install only backend dependencies
npm run install:frontend     # Install only frontend dependencies

# Build applications
npm run build:all            # Build both applications
npm run build:backend        # Build only backend
npm run build:frontend       # Build only frontend
```

## 🔧 Configuration Details

### PM2 Ecosystem Configuration
The `ecosystem.config.js` file defines:

**Backend Process:**
- **Name**: `volume-backtest-backend`
- **Port**: 5000
- **Script**: `npm run dev` (TypeScript with hot reload)
- **Working Directory**: `./backend`
- **Auto-restart**: Yes
- **Memory Limit**: 1GB

**Frontend Process:**
- **Name**: `volume-backtest-frontend`
- **Port**: 3000
- **Script**: `npm start` (React development server)
- **Working Directory**: `./frontend`
- **Auto-restart**: Yes
- **Memory Limit**: 1GB
- **Browser**: Disabled (won't auto-open browser)

### Log Files
All logs are stored in the `./logs/` directory:
- `backend-*.log` - Backend application logs
- `frontend-*.log` - Frontend application logs

## 🌐 Access Your Application

Once started, you can access:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000/api
- **PM2 Web Interface**: `npm run monit`

## 📊 Monitoring

### Check Status
```bash
npm run status
```
Shows:
- Process names and IDs
- Status (online/stopped/errored)
- CPU and memory usage
- Uptime and restart count

### View Logs
```bash
# All logs (both applications)
npm run logs

# Backend only
npm run logs:backend

# Frontend only
npm run logs:frontend

# Follow logs in real-time
pm2 logs --lines 50
```

### PM2 Monitoring Dashboard
```bash
npm run monit
```
Opens a real-time monitoring interface showing:
- CPU and memory usage graphs
- Process status and logs
- System information

## 🔄 Development Workflow

### Starting Development
```bash
# 1. Start MongoDB (if not running)
# 2. Start both applications
npm start

# 3. Check status
npm run status

# 4. View logs if needed
npm run logs
```

### Making Changes
- **Backend**: Changes will auto-reload (nodemon + ts-node)
- **Frontend**: Changes will auto-reload (React dev server)
- **PM2 Config**: Restart with `npm restart` after changes

### Stopping Development
```bash
# Stop both applications
npm stop

# Or delete from PM2 completely
npm run delete
```

## 🚨 Troubleshooting

### Common Issues

**Port Already in Use:**
```bash
# Check what's using the ports
lsof -i :3000  # Frontend
lsof -i :5000  # Backend

# Kill processes if needed
kill -9 <PID>
```

**MongoDB Connection Issues:**
- Ensure MongoDB is running
- Check connection string in `backend/.env`
- Verify MongoDB is accessible

**PM2 Process Issues:**
```bash
# Restart specific process
pm2 restart volume-backtest-backend
pm2 restart volume-backtest-frontend

# View detailed logs
pm2 logs volume-backtest-backend --lines 100
```

**Memory Issues:**
```bash
# Check memory usage
npm run monit

# Restart if memory usage is high
npm restart
```

### Reset Everything
```bash
# Stop and delete all processes
npm run delete

# Clear PM2 logs
pm2 flush

# Restart fresh
npm start
```

## 🎯 Production Deployment

For production deployment, modify `ecosystem.config.js`:

1. **Backend**: Use compiled JavaScript instead of ts-node
2. **Frontend**: Use `serve` to serve built files instead of dev server
3. **Environment**: Set `NODE_ENV=production`

```bash
# Build for production
npm run build:all

# Start in production mode
npm run prod
```

## 📝 Notes

- **Auto-restart**: Both processes will automatically restart if they crash
- **Log Rotation**: PM2 handles log rotation automatically
- **Zero-downtime**: Use `npm run reload` for zero-downtime restarts
- **Clustering**: Can be configured for multiple instances if needed

## 🎉 Success!

Your Volume Pattern Backtest application is now running with PM2! 

Visit http://localhost:3000 to see your application in action.
