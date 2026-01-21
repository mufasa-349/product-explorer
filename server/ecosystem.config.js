module.exports = {
  apps: [{
    name: 'product-explorer-api',
    script: 'index.js',
    instances: 1,
    exec_mode: 'fork',  // Cluster yerine fork mode (environment variables için)
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 5001,
      DISPLAY: ':99'  // Xvfb için virtual display
    }
  }]
};
