// High-performance transparent TCP port bridge for PostgreSQL 5433 -> 5432
const net = require('node:net');

const LISTEN_PORT = process.env.PG_BRIDGE_PORT ? Number(process.env.PG_BRIDGE_PORT) : 5433;
const TARGET_PORT = process.env.PG_TARGET_PORT ? Number(process.env.PG_TARGET_PORT) : 5432;
const TARGET_HOST = process.env.PG_TARGET_HOST || '127.0.0.1';

const server = net.createServer((clientSocket) => {
  clientSocket.setNoDelay(true);

  const targetSocket = net.connect(TARGET_PORT, TARGET_HOST);
  targetSocket.setNoDelay(true);

  clientSocket.pipe(targetSocket);
  targetSocket.pipe(clientSocket);

  clientSocket.on('error', (err) => {
    // console.warn('Client socket error:', err.message);
    targetSocket.destroy();
  });

  targetSocket.on('error', (err) => {
    // console.warn('Target socket error:', err.message);
    clientSocket.destroy();
  });
});

server.listen(LISTEN_PORT, '127.0.0.1', () => {
  console.log(`[PG-Bridge] PostgreSQL port bridge listening on 127.0.0.1:${LISTEN_PORT} -> ${TARGET_HOST}:${TARGET_PORT}`);
});

process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());
