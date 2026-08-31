'use strict';

const app = require('./app');
const env = require('./config/env');
const { pool } = require('./config/db');

const server = app.listen(env.port, () => {
  console.log(`CampusCycle API listening on http://localhost:${env.port} (${env.nodeEnv})`);
});

// Graceful shutdown: close the HTTP server and the DB pool.
function shutdown(signal) {
  console.log(`\n${signal} received, shutting down...`);
  server.close(() => {
    pool.end().then(() => process.exit(0));
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = server;
