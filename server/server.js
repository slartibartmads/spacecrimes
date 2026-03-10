import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Serve static files from client directory
app.use(express.static(path.join(__dirname, '../client')));
app.use('/shared', express.static(path.join(__dirname, '../shared')));

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Import game modules
import { initializeServerState } from './gameState.js';
import { setupSocketHandlers } from './socketHandlers.js';
import { initializeTickSystem } from './tickSystem.js';

// Initialize game state
initializeServerState();

// Setup Socket.IO handlers
setupSocketHandlers(io);

// Start tick system
initializeTickSystem(io);

// Start server
httpServer.listen(PORT, () => {
  console.log(`🚀 Space Drugwars server running on http://localhost:${PORT}`);
  console.log(`📊 Game state initialized`);
  console.log(`⏰ Tick system active`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
