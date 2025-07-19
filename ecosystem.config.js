module.exports = {
  apps: [
    {
      name: 'volume-backtest-backend',
      cwd: './backend',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'development',
        PORT: 5002
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5002
      },
      watch: false,
      ignore_watch: ['node_modules', 'dist', 'logs'],
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '1G',
      error_file: './backend/logs/backend-error.log',
      out_file: './backend/logs/backend-out.log',
      log_file: './backend/logs/backend-combined.log',
      time: true
    },
    {
      name: 'volume-backtest-frontend',
      cwd: './frontend',
      script: '/opt/homebrew/bin/serve',
      args: '-s build -l 3000',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        BROWSER: 'none'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      watch: false,
      ignore_watch: ['node_modules', 'build'],
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '1G',
      error_file: './frontend/logs/frontend-error.log',
      out_file: './frontend/logs/frontend-out.log',
      log_file: './frontend/logs/frontend-combined.log',
      time: true
    }
  ]
};
