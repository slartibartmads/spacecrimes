import { createInitialMarkets, addInitialAnomalies, calculateNetWorth } from './gameLogic.js';

/**
 * Server state structure:
 * {
 *   markets: {},              // Shared market state (all commodities at all stations)
 *   activeEvents: [],         // Active market events affecting prices
 *   tick: 0,                  // Global game clock
 *   players: {},              // All connected players { socketId: playerState }
 *   recentActivity: [],       // Recent player actions for activity feed
 *   tickState: {              // Tick system tracking
 *     lastTickTime: Date.now(),
 *     playersActedThisTick: Set<socketId>
 *   }
 * }
 */

let serverState = null;

/**
 * Initialize server state
 */
export function initializeServerState() {
  const markets = createInitialMarkets();
  const tick = 0;
  const activeEvents = addInitialAnomalies(markets, tick);
  
  serverState = {
    markets,
    activeEvents,
    tick,
    players: {},
    recentActivity: [],
    tickState: {
      lastTickTime: Date.now(),
      playersTraveledThisTick: new Set()
    }
  };
  
  console.log('Server state initialized');
  return serverState;
}

/**
 * Get server state (read-only)
 */
export function getServerState() {
  if (!serverState) {
    throw new Error('Server state not initialized');
  }
  return serverState;
}

/**
 * Add a player to server state
 */
export function addPlayer(socketId, playerState) {
  if (!serverState) {
    throw new Error('Server state not initialized');
  }
  
  serverState.players[socketId] = {
    ...playerState,
    socketId,
    connectedAt: Date.now(),
    lastActionTime: Date.now()
  };
  
  console.log(`Player added: ${playerState.name} (${socketId})`);
  return serverState.players[socketId];
}

/**
 * Remove a player from server state
 */
export function removePlayer(socketId) {
  if (!serverState) {
    throw new Error('Server state not initialized');
  }
  
  const player = serverState.players[socketId];
  if (player) {
    console.log(`Player removed: ${player.name} (${socketId})`);
    delete serverState.players[socketId];
    
    // Remove from tick tracking
    serverState.tickState.playersTraveledThisTick.delete(socketId);
  }
}

/**
 * Get a specific player by socket ID
 */
export function getPlayer(socketId) {
  if (!serverState) {
    throw new Error('Server state not initialized');
  }
  return serverState.players[socketId];
}

/**
 * Update a player's state
 */
export function updatePlayer(socketId, updates) {
  if (!serverState) {
    throw new Error('Server state not initialized');
  }
  
  if (!serverState.players[socketId]) {
    throw new Error(`Player not found: ${socketId}`);
  }
  
  serverState.players[socketId] = {
    ...serverState.players[socketId],
    ...updates,
    lastActionTime: Date.now()
  };
  
  return serverState.players[socketId];
}

/**
 * Update markets (shared by all players)
 */
export function updateMarkets(newMarkets) {
  if (!serverState) {
    throw new Error('Server state not initialized');
  }
  serverState.markets = newMarkets;
}

/**
 * Update active events
 */
export function updateActiveEvents(newEvents) {
  if (!serverState) {
    throw new Error('Server state not initialized');
  }
  serverState.activeEvents = newEvents;
}

/**
 * Increment tick counter
 */
export function incrementTick() {
  if (!serverState) {
    throw new Error('Server state not initialized');
  }
  serverState.tick++;
  return serverState.tick;
}

/**
 * Add activity to recent activity feed
 */
export function addActivity(activity) {
  if (!serverState) {
    throw new Error('Server state not initialized');
  }
  
  serverState.recentActivity.unshift({
    ...activity,
    timestamp: Date.now(),
    tick: serverState.tick
  });
  
  // Keep only last 50 activities
  if (serverState.recentActivity.length > 50) {
    serverState.recentActivity = serverState.recentActivity.slice(0, 50);
  }
}

/**
 * Get leaderboard (top players by net worth)
 */
export function getLeaderboard(limit = 10) {
  if (!serverState) {
    throw new Error('Server state not initialized');
  }
  
  const players = Object.values(serverState.players);
  
  // Calculate net worth for each player using proper function
  const playersWithNetWorth = players.map(player => ({
    name: player.name,
    location: player.location,
    netWorth: calculateNetWorth(player, serverState.markets),
    credits: player.credits
  }));
  
  // Sort by net worth descending
  playersWithNetWorth.sort((a, b) => b.netWorth - a.netWorth);
  
  return playersWithNetWorth.slice(0, limit);
}

/**
 * Get public player info (visible to other players)
 */
export function getPublicPlayerInfo(socketId) {
  const player = serverState.players[socketId];
  if (!player) return null;
  
  return {
    socketId,
    name: player.name,
    location: player.location,
    credits: player.credits,
    hull: player.hull,
    hullMax: player.hullMax,
    cargo: player.cargo,
    cargoMax: player.cargoMax,
    upgrades: player.upgrades,
    reputation: player.reputation
  };
}

/**
 * Get all public player info (for broadcasting)
 */
export function getAllPublicPlayerInfo() {
  if (!serverState) {
    throw new Error('Server state not initialized');
  }
  
  return Object.keys(serverState.players).map(socketId => 
    getPublicPlayerInfo(socketId)
  ).filter(p => p !== null);
}

/**
 * Mark player as having traveled this tick
 */
export function markPlayerTraveled(socketId) {
  if (!serverState) {
    throw new Error('Server state not initialized');
  }
  serverState.tickState.playersTraveledThisTick.add(socketId);
}

/**
 * Check if player has traveled this tick
 */
export function hasPlayerTraveled(socketId) {
  if (!serverState) {
    throw new Error('Server state not initialized');
  }
  return serverState.tickState.playersTraveledThisTick.has(socketId);
}

/**
 * Reset tick state after tick processes
 */
export function resetTickState() {
  if (!serverState) {
    throw new Error('Server state not initialized');
  }
  serverState.tickState.playersTraveledThisTick.clear();
  serverState.tickState.lastTickTime = Date.now();
}

/**
 * Check if all players have traveled this tick
 */
export function haveAllPlayersTraveled() {
  if (!serverState) {
    throw new Error('Server state not initialized');
  }
  
  const activePlayers = Object.keys(serverState.players);
  if (activePlayers.length === 0) return false;
  
  return activePlayers.every(socketId => 
    serverState.tickState.playersTraveledThisTick.has(socketId)
  );
}

/**
 * Get time since last tick (milliseconds)
 */
export function getTimeSinceLastTick() {
  if (!serverState) {
    throw new Error('Server state not initialized');
  }
  return Date.now() - serverState.tickState.lastTickTime;
}

/**
 * Get active player count
 */
export function getActivePlayerCount() {
  if (!serverState) {
    throw new Error('Server state not initialized');
  }
  return Object.keys(serverState.players).length;
}
