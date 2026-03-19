import { createInitialMarkets, addInitialAnomalies, calculateNetWorth } from './gameLogic.js';

/**
 * Server state structure:
 * {
 *   markets: {},              // Shared market state (all commodities at all stations)
 *   stationInventories: {},   // Which commodities are available at each station { stationId: [commodityId, ...] }
 *   minorStationModifiers: {},// Price modifiers for minor stations { stationId: { commodityId: modifier } }
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

export function initializeServerState() {
  const { markets, stationInventories, minorStationModifiers } = createInitialMarkets();
  const tick = 0;
  const activeEvents = addInitialAnomalies(markets, stationInventories, tick);
  
  serverState = {
    markets,
    stationInventories,
    minorStationModifiers,
    activeEvents,
    tick,
    players: {},
    socketToPlayer: {},
    recentActivity: [],
    tickState: {
      lastTickTime: Date.now(),
      playersTraveledThisTick: new Set()
    },
    marketPressure: {}
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
export function addPlayer(socketId, playerId, playerState) {
  if (!serverState) {
    throw new Error('Server state not initialized');
  }
  
  serverState.players[playerId] = {
    ...playerState,
    playerId,
    socketId,
    connected: true,
    connectedAt: Date.now(),
    lastActionTime: Date.now()
  };
  
  serverState.socketToPlayer[socketId] = playerId;
  
  console.log(`Player added: ${playerState.name} (${playerId}, socket: ${socketId})`);
  return serverState.players[playerId];
}

/**
 * Remove a player from server state
 */
export function markPlayerDisconnected(socketId) {
  if (!serverState) {
    throw new Error('Server state not initialized');
  }
  
  const playerId = serverState.socketToPlayer[socketId];
  if (!playerId) return;
  
  const player = serverState.players[playerId];
  if (player) {
    player.connected = false;
    player.disconnectedAt = Date.now();
    console.log(`Player disconnected: ${player.name} (${playerId})`);
  }
  
  delete serverState.socketToPlayer[socketId];
  serverState.tickState.playersTraveledThisTick.delete(socketId);
}

export function reconnectPlayer(playerId, newSocketId) {
  if (!serverState) {
    throw new Error('Server state not initialized');
  }
  
  const player = serverState.players[playerId];
  if (!player) return null;
  
  player.socketId = newSocketId;
  player.connected = true;
  player.reconnectedAt = Date.now();
  delete player.disconnectedAt;
  
  serverState.socketToPlayer[newSocketId] = playerId;
  
  console.log(`Player reconnected: ${player.name} (${playerId}, socket: ${newSocketId})`);
  return player;
}

export function getPlayerByPlayerId(playerId) {
  if (!serverState) {
    throw new Error('Server state not initialized');
  }
  return serverState.players[playerId] || null;
}

/**
 * Get a specific player by socket ID
 */
export function getPlayer(socketId) {
  if (!serverState) {
    throw new Error('Server state not initialized');
  }
  const playerId = serverState.socketToPlayer[socketId];
  if (!playerId) return null;
  return serverState.players[playerId];
}

/**
 * Update a player's state
 */
export function updatePlayer(socketId, updates) {
  if (!serverState) {
    throw new Error('Server state not initialized');
  }
  
  const playerId = serverState.socketToPlayer[socketId];
  if (!playerId || !serverState.players[playerId]) {
    throw new Error(`Player not found: ${socketId}`);
  }
  
  serverState.players[playerId] = {
    ...serverState.players[playerId],
    ...updates,
    lastActionTime: Date.now()
  };
  
  return serverState.players[playerId];
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

export function getCurrentTick() {
  if (!serverState) {
    throw new Error('Server state not initialized');
  }
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
  
  const connectedPlayerIds = Object.values(serverState.socketToPlayer);
  const players = connectedPlayerIds
    .map(playerId => serverState.players[playerId])
    .filter(p => p);
  
  const playersWithNetWorth = players.map(player => ({
    name: player.name,
    location: player.location,
    netWorth: calculateNetWorth(player, serverState.markets),
    credits: player.credits,
    bounty: player.reputation?.currentBounty || 0
  }));
  
  playersWithNetWorth.sort((a, b) => b.netWorth - a.netWorth);
  
  return playersWithNetWorth.slice(0, limit);
}

/**
 * Get public player info (visible to other players)
 */
export function getPublicPlayerInfo(socketId) {
  const player = getPlayer(socketId);
  if (!player) return null;
  
  return {
    socketId,
    playerId: player.playerId,
    name: player.name,
    location: player.location,
    credits: player.credits,
    hull: player.hull,
    hullMax: player.hullMax,
    cargo: player.cargo,
    cargoUsed: player.cargoUsed,
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
  
  return Object.keys(serverState.socketToPlayer).map(socketId => 
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
  
  const activeSocketIds = Object.keys(serverState.socketToPlayer);
  if (activeSocketIds.length === 0) return false;
  
  return activeSocketIds.every(socketId => 
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
  return Object.keys(serverState.socketToPlayer).length;
}

export function recordMarketPressure(stationId, commodityId, pressure, tick) {
  if (!serverState) {
    throw new Error('Server state not initialized');
  }
  
  if (!serverState.marketPressure[stationId]) {
    serverState.marketPressure[stationId] = {};
  }
  if (!serverState.marketPressure[stationId][commodityId]) {
    serverState.marketPressure[stationId][commodityId] = { tickData: {} };
  }
  
  const currentPressure = serverState.marketPressure[stationId][commodityId].tickData[tick] || 0;
  serverState.marketPressure[stationId][commodityId].tickData[tick] = currentPressure + pressure;
}

export function getMarketPressure(stationId, commodityId, currentTick, windowSize = 10) {
  if (!serverState || !serverState.marketPressure[stationId] || !serverState.marketPressure[stationId][commodityId]) {
    return 0;
  }
  
  const tickData = serverState.marketPressure[stationId][commodityId].tickData;
  let total = 0;
  
  for (const tick in tickData) {
    if (parseInt(tick) > currentTick - windowSize) {
      total += tickData[tick];
    }
  }
  
  return total;
}

export function getAllMarketPressure(currentTick, windowSize = 10) {
  if (!serverState) {
    return {};
  }
  
  const result = {};
  
  for (const stationId in serverState.marketPressure) {
    result[stationId] = {};
    for (const commodityId in serverState.marketPressure[stationId]) {
      result[stationId][commodityId] = getMarketPressure(stationId, commodityId, currentTick, windowSize);
    }
  }
  
  return result;
}

export function pruneMarketPressure(currentTick, windowSize = 10) {
  if (!serverState) {
    return;
  }
  
  const cutoffTick = currentTick - windowSize;
  
  for (const stationId in serverState.marketPressure) {
    for (const commodityId in serverState.marketPressure[stationId]) {
      const tickData = serverState.marketPressure[stationId][commodityId].tickData;
      for (const tick in tickData) {
        if (parseInt(tick) <= cutoffTick) {
          delete tickData[tick];
        }
      }
    }
  }
}
