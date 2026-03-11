import { 
  getServerState, 
  incrementTick, 
  updateMarkets, 
  updateActiveEvents,
  resetTickState,
  haveAllPlayersTraveled,
  getTimeSinceLastTick,
  getActivePlayerCount,
  updatePlayer
} from './gameState.js';
import { processTick } from './gameLogic.js';

/**
 * Tick System Configuration
 * - MIN_TICK_INTERVAL: Minimum time (ms) before tick can advance (5 seconds)
 * - MAX_TICK_INTERVAL: Maximum time (ms) before tick auto-advances (5 seconds)
 * - CHECK_INTERVAL: How often to check if tick should advance (1 second)
 */
const MIN_TICK_INTERVAL = 5 * 1000;  // 5 seconds
const MAX_TICK_INTERVAL = 5 * 1000;  // 5 seconds
const CHECK_INTERVAL = 1000;          // 1 second

let tickTimer = null;
let io = null;

/**
 * Initialize tick system with Socket.IO instance
 */
export function initializeTickSystem(socketIO) {
  io = socketIO;
  startTickTimer();
  console.log('Tick system initialized');
}

/**
 * Start the tick timer that checks periodically if tick should advance
 */
function startTickTimer() {
  if (tickTimer) {
    clearInterval(tickTimer);
  }
  
  tickTimer = setInterval(() => {
    checkAndAdvanceTick();
  }, CHECK_INTERVAL);
}

/**
 * Stop the tick timer
 */
export function stopTickTimer() {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
    console.log('Tick timer stopped');
  }
}

/**
 * Check if tick should advance and advance if conditions met
 */
function checkAndAdvanceTick() {
  const timeSinceLastTick = getTimeSinceLastTick();
  const playerCount = getActivePlayerCount();
  
  // No tick if no players online
  if (playerCount === 0) {
    return;
  }
  
  // Force tick after MAX_TICK_INTERVAL
  if (timeSinceLastTick >= MAX_TICK_INTERVAL) {
    console.log(`Tick advancing: MAX_TICK_INTERVAL reached (${MAX_TICK_INTERVAL}ms)`);
    advanceTick();
    return;
  }
  
  // Tick if MIN_TICK_INTERVAL passed AND all players have traveled
  if (timeSinceLastTick >= MIN_TICK_INTERVAL && haveAllPlayersTraveled()) {
    console.log(`Tick advancing: All ${playerCount} players traveled and MIN_TICK_INTERVAL passed`);
    advanceTick();
    return;
  }
}

/**
 * Manually trigger tick advance (used when player acts)
 */
export function tryAdvanceTick() {
  checkAndAdvanceTick();
}

/**
 * Advance the game tick
 */
function advanceTick() {
  const state = getServerState();
  
  // Process tick for markets and events
  const tickResult = processTick(state.markets, state.activeEvents, state.stationInventories, state.tick);
  
  // Update server state
  updateMarkets(tickResult.markets);
  updateActiveEvents(tickResult.activeEvents);
  const newTick = incrementTick();
  
  // Apply event effects to all players
  applyEventEffectsToPlayers(tickResult.newEvent);
  
  // Decay bounties for all players
  decayBounties();
  
  // Reset tick state
  resetTickState();
  
  // Broadcast tick event to all clients
  if (io) {
    io.emit('tick', {
      tick: newTick,
      markets: tickResult.markets,
      activeEvents: tickResult.activeEvents,
      newEvent: tickResult.newEvent,
      expiredEvents: tickResult.expiredEvents
    });
    
    console.log(`Tick ${newTick} broadcasted to ${getActivePlayerCount()} players`);
  }
}

/**
 * Apply event effects to all players (if event affects players directly)
 * For now, events only affect markets, but this is here for future expansion
 */
function applyEventEffectsToPlayers(newEvent) {
  if (!newEvent) return;
  
  const state = getServerState();
  
  // Example: If an event damages all ships at a station
  // This is for future expansion - current events only affect markets
  if (newEvent.type === 'station_damage') {
    Object.keys(state.players).forEach(socketId => {
      const player = state.players[socketId];
      if (player.location === newEvent.station) {
        const updatedPlayer = {
          ...player,
          hull: Math.max(0, player.hull - 10)
        };
        updatePlayer(socketId, updatedPlayer);
        
        // Notify player
        if (io) {
          io.to(socketId).emit('event_damage', {
            message: `Your ship took damage from ${newEvent.description}`,
            damage: 10
          });
        }
      }
    });
  }
}

/**
 * Decay bounties for all players each tick
 */
function decayBounties() {
  const state = getServerState();
  const BOUNTY_DECAY_PER_TICK = 100;
  
  Object.keys(state.players).forEach(socketId => {
    const player = state.players[socketId];
    if (player.reputation && player.reputation.currentBounty > 0) {
      const updatedPlayer = {
        ...player,
        reputation: {
          ...player.reputation,
          currentBounty: Math.max(0, player.reputation.currentBounty - BOUNTY_DECAY_PER_TICK)
        }
      };
      updatePlayer(socketId, updatedPlayer);
    }
  });
}


/**
 * Get time until next possible tick (for client display)
 */
export function getTimeUntilNextTick() {
  const timeSinceLastTick = getTimeSinceLastTick();
  const timeUntilMin = Math.max(0, MIN_TICK_INTERVAL - timeSinceLastTick);
  const timeUntilMax = Math.max(0, MAX_TICK_INTERVAL - timeSinceLastTick);
  const allTraveled = haveAllPlayersTraveled();
  
  return {
    timeUntilMinTick: timeUntilMin,
    timeUntilMaxTick: timeUntilMax,
    allPlayersTraveled: allTraveled,
    canTickNow: timeSinceLastTick >= MIN_TICK_INTERVAL && allTraveled
  };
}

/**
 * Force immediate tick (admin/debug function)
 */
export function forceTickNow() {
  console.log('Force tick triggered');
  advanceTick();
}
