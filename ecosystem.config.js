module.exports = {
  apps: [
    {
      name: 'uniform-inventory',
      script: 'dist/index.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
