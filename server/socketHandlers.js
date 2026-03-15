import {
  getServerState,
  addPlayer,
  removePlayer,
  getPlayer,
  updatePlayer,
  updateMarkets,
  addActivity,
  getLeaderboard,
  getAllPublicPlayerInfo,
  getPublicPlayerInfo,
  markPlayerTraveled,
  hasPlayerTraveled
} from './gameState.js';
import {
  createPlayerState,
  buyCommodity,
  sellCommodity,
  jettisonCargo,
  depositCredits,
  withdrawCredits,
  travel,
  buyUpgrade,
  repairHull,
  doDesperateWork,
  resolveCombatRound,
  acceptLoot,
  resolveInspection,
  checkDeath,
  respawn,
  calculateTotalCargoValue,
  generateSpecificEvent,
  getPlayerMaxCargo
} from './gameLogic.js';
import { STATIONS } from '../shared/data.js';
import { tryAdvanceTick, getTimeUntilNextTick, forceAdvanceTick } from './tickSystem.js';

/**
 * Set up all Socket.IO event handlers
 */
export function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    
    // Player join
    socket.on('join', (data, callback) => {
      handleJoin(socket, data, callback, io);
    });
    
    // Trading actions
    socket.on('buy', (data, callback) => {
      handleBuy(socket, data, callback, io);
    });
    
    socket.on('sell', (data, callback) => {
      handleSell(socket, data, callback, io);
    });
    
    socket.on('jettison', (data, callback) => {
      handleJettison(socket, data, callback, io);
    });
    
    // Travel action
    socket.on('travel', (data, callback) => {
      handleTravel(socket, data, callback, io);
    });
    
    // Upgrade actions
    socket.on('buyUpgrade', (data, callback) => {
      handleBuyUpgrade(socket, data, callback, io);
    });
    
    socket.on('repair', (data, callback) => {
      handleRepair(socket, data, callback, io);
    });
    
    // Banking actions
    socket.on('bank:deposit', (data, callback) => {
      handleBankDeposit(socket, data, callback, io);
    });
    
    socket.on('bank:withdraw', (data, callback) => {
      handleBankWithdraw(socket, data, callback, io);
    });
    
    // Desperate work
    socket.on('desperateWork', (data, callback) => {
      handleDesperateWork(socket, data, callback, io);
    });
    
    // Combat actions
    socket.on('combatAction', (data, callback) => {
      handleCombatAction(socket, data, callback, io);
    });
    
    socket.on('acceptLoot', (data, callback) => {
      handleAcceptLoot(socket, data, callback, io);
    });
    
    // Inspection actions
    socket.on('inspectionAction', (data, callback) => {
      handleInspectionAction(socket, data, callback, io);
    });
    
    // Respawn
    socket.on('respawn', (data, callback) => {
      handleRespawn(socket, data, callback, io);
    });
    
    // Info requests
    socket.on('getLeaderboard', (callback) => {
      handleGetLeaderboard(callback);
    });
    
    socket.on('getTickInfo', (callback) => {
      handleGetTickInfo(callback);
    });
    
    // Debug/admin commands
    socket.on('clearCombat', (data, callback) => {
      handleClearCombat(socket, callback);
    });
    
    // Setup debug handlers
    setupDebugHandlers(socket, io);
    
    // Disconnect
    socket.on('disconnect', () => {
      handleDisconnect(socket, io);
    });
  });
}

/**
 * Handle player join
 */
function handleJoin(socket, data, callback, io) {
  const { username } = data;
  
  if (!username || username.trim().length === 0) {
    callback({ success: false, error: 'Username required' });
    return;
  }
  
  const state = getServerState();
  
  // Create new player
  const playerState = createPlayerState(username.trim());
  addPlayer(socket.id, playerState);
  
  // Send initial state to player
  callback({
    success: true,
    playerState: getPlayer(socket.id),
    markets: state.markets,
    stationInventories: state.stationInventories,
    activeEvents: state.activeEvents,
    tick: state.tick,
    players: getAllPublicPlayerInfo()
  });
  
  // Broadcast to all other players that new player joined
  socket.broadcast.emit('playerJoined', {
    player: getPublicPlayerInfo(socket.id)
  });
  
  // Add to activity feed
  addActivity({
    type: 'join',
    playerName: username.trim(),
    message: `${username.trim()} entered the system`
  });
  
  // Broadcast activity update
  io.emit('activityUpdate', {
    activities: state.recentActivity
  });
  
  console.log(`Player joined: ${username.trim()} (${socket.id})`);
}

/**
 * Handle buy commodity
 */
function handleBuy(socket, data, callback, io) {
  try {
    console.log(`Buy request from ${socket.id}:`, data);
    const { commodity, quantity } = data;
    const player = getPlayer(socket.id);
    
    if (!player) {
      console.log('Player not found for socket:', socket.id);
      callback({ success: false, error: 'Player not found' });
      return;
    }
    
    const state = getServerState();
    const result = buyCommodity(player, state.markets, commodity, quantity);
    
    if (!result.success) {
      console.log('Buy failed:', result.error);
      callback({ success: false, error: result.error });
      return;
    }
    
    // Update player and markets
    updatePlayer(socket.id, result.playerState);
    updateMarkets(result.markets);
    
    // Don't log buy transactions to activity feed (too noisy)
    
    // Broadcast updates
    io.emit('marketUpdate', { markets: result.markets });
    io.emit('playerUpdate', { 
      socketId: socket.id, 
      player: getPublicPlayerInfo(socket.id) 
    });
    
    console.log('Buy successful, sending callback');
    callback({ 
      success: true, 
      playerState: getPlayer(socket.id),
      markets: result.markets
    });
    
    // Try to advance tick
    tryAdvanceTick();
  } catch (error) {
    console.error('Error in handleBuy:', error);
    callback({ success: false, error: error.message || 'Server error' });
  }
}

/**
 * Handle sell commodity
 */
function handleSell(socket, data, callback, io) {
  const { commodity, quantity } = data;
  const player = getPlayer(socket.id);
  
  if (!player) {
    callback({ success: false, error: 'Player not found' });
    return;
  }
  
  const state = getServerState();
  const result = sellCommodity(player, state.markets, commodity, quantity);
  
  if (!result.success) {
    callback({ success: false, error: result.error });
    return;
  }
  
  // Update player and markets
  updatePlayer(socket.id, result.playerState);
  updateMarkets(result.markets);
  
  // Don't log sell transactions to activity feed (too noisy)
  
  // Broadcast updates
  io.emit('marketUpdate', { markets: result.markets });
  io.emit('playerUpdate', { 
    socketId: socket.id, 
    player: getPublicPlayerInfo(socket.id) 
  });
  
  callback({ 
    success: true, 
    playerState: getPlayer(socket.id),
    markets: result.markets
  });
  
  // Try to advance tick
  tryAdvanceTick();
}

/**
 * Handle jettison cargo
 */
function handleJettison(socket, data, callback, io) {
  const { commodity, quantity } = data;
  const player = getPlayer(socket.id);
  
  if (!player) {
    callback({ success: false, error: 'Player not found' });
    return;
  }
  
  const result = jettisonCargo(player, commodity, quantity);
  
  if (!result.success) {
    callback({ success: false, error: result.error });
    return;
  }
  
  // Update player
  updatePlayer(socket.id, result.playerState);
  
  // Broadcast player update
  io.emit('playerUpdate', { 
    socketId: socket.id, 
    player: getPublicPlayerInfo(socket.id) 
  });
  
  callback({ 
    success: true, 
    playerState: getPlayer(socket.id)
  });
}

/**
 * Handle travel
 */
function handleTravel(socket, data, callback, io) {
  const { destination } = data;
  const player = getPlayer(socket.id);
  
  if (!player) {
    callback({ success: false, error: 'Player not found' });
    return;
  }
  
  // Check if player has already traveled this tick
  if (hasPlayerTraveled(socket.id)) {
    callback({ success: false, error: 'You can only travel once per tick. Wait for next tick.' });
    return;
  }
  
  const state = getServerState();
  const result = travel(player, destination, state.markets, state.activeEvents);
  
  if (!result.success) {
    callback({ success: false, error: result.error });
    return;
  }
  
  // Mark player as having traveled (regardless of pirates/cops/inspection)
  markPlayerTraveled(socket.id);
  
  // Check for pirate encounter
  if (result.pirateEncounter) {
    // Update player with combat state
    updatePlayer(socket.id, result.playerState);
    
    // Broadcast position update to other players
    io.emit('playerUpdate', { 
      socketId: socket.id, 
      player: getPublicPlayerInfo(socket.id) 
    });
    
    // Send combat encounter to player
    callback({
      success: true,
      pirateEncounter: true,
      combat: result.combat,
      playerState: getPlayer(socket.id)
    });
    
    // Add to activity
    addActivity({
      type: 'combat',
      playerName: player.name,
      message: `${player.name} encountered ${result.combat.pirateName}!`
    });
    
    io.emit('activityUpdate', { activities: getServerState().recentActivity });
    return;
  }
  
  // Check for cop encounter
  if (result.copEncounter) {
    // Update player with combat state
    updatePlayer(socket.id, result.playerState);
    
    // Broadcast position update to other players
    io.emit('playerUpdate', { 
      socketId: socket.id, 
      player: getPublicPlayerInfo(socket.id) 
    });
    
    // Send combat encounter to player
    callback({
      success: true,
      copEncounter: true,
      combat: result.combat,
      playerState: getPlayer(socket.id)
    });
    
    // Add to activity
    const copName = result.combat.copTypeName || 'Law Enforcement';
    addActivity({
      type: 'combat',
      playerName: player.name,
      message: `${player.name} intercepted by ${copName} at ${destination}!`
    });
    
    io.emit('activityUpdate', { activities: getServerState().recentActivity });
    return;
  }
  
  // Check for inspection
  if (result.inspection) {
    // Update player with inspection state
    updatePlayer(socket.id, result.playerState);
    
    // Broadcast position update to other players
    io.emit('playerUpdate', { 
      socketId: socket.id, 
      player: getPublicPlayerInfo(socket.id) 
    });
    
    // Send inspection to player
    callback({
      success: true,
      inspection: true,
      inspectionState: result.inspectionState,
      playerState: getPlayer(socket.id)
    });
    
    // Don't log inspection start to activity feed (too noisy)
    
    return;
  }
  
  // Normal travel completed
  updatePlayer(socket.id, result.playerState);
  
  // Add to activity
  const destinationStation = STATIONS.find(s => s.id === destination);
  const stationName = destinationStation ? destinationStation.name : destination;
  
  addActivity({
    type: 'travel',
    playerName: player.name,
    destination,
    message: `${player.name} traveled to ${stationName}`
  });
  
  // Broadcast updates
  io.emit('playerUpdate', { 
    socketId: socket.id, 
    player: getPublicPlayerInfo(socket.id) 
  });
  io.emit('activityUpdate', { activities: getServerState().recentActivity });
  
  callback({ 
    success: true, 
    playerState: getPlayer(socket.id)
  });
  
  // Try to advance tick
  tryAdvanceTick();
}

/**
 * Handle buy upgrade
 */
function handleBuyUpgrade(socket, data, callback, io) {
  const { upgradeId } = data;
  const player = getPlayer(socket.id);
  
  if (!player) {
    callback({ success: false, error: 'Player not found' });
    return;
  }
  
  const result = buyUpgrade(player, upgradeId);
  
  if (!result.success) {
    callback({ success: false, error: result.error });
    return;
  }
  
  updatePlayer(socket.id, result.playerState);
  
  // Don't log upgrade purchases to activity feed (too noisy)
  
  io.emit('playerUpdate', { 
    socketId: socket.id, 
    player: getPublicPlayerInfo(socket.id) 
  });
  
  callback({ 
    success: true, 
    playerState: getPlayer(socket.id)
  });
}

/**
 * Handle repair hull
 */
function handleRepair(socket, data, callback, io) {
  const player = getPlayer(socket.id);
  
  if (!player) {
    callback({ success: false, error: 'Player not found' });
    return;
  }
  
  const result = repairHull(player);
  
  if (!result.success) {
    callback({ success: false, error: result.error });
    return;
  }
  
  updatePlayer(socket.id, result.playerState);
  
  io.emit('playerUpdate', { 
    socketId: socket.id, 
    player: getPublicPlayerInfo(socket.id) 
  });
  
  callback({ 
    success: true, 
    playerState: getPlayer(socket.id)
  });
}

/**
 * Handle bank deposit
 */
function handleBankDeposit(socket, data, callback, io) {
  const { amount } = data;
  const player = getPlayer(socket.id);
  
  if (!player) {
    callback({ success: false, error: 'Player not found' });
    return;
  }
  
  const result = depositCredits(player, amount);
  
  if (!result.success) {
    callback({ success: false, error: result.error });
    return;
  }
  
  updatePlayer(socket.id, result.playerState);
  
  io.emit('playerUpdate', { 
    socketId: socket.id, 
    player: getPublicPlayerInfo(socket.id) 
  });
  
  addActivity(`${player.name} deposited ${amount} credits at The Mattress`);
  
  callback({ 
    success: true, 
    playerState: getPlayer(socket.id),
    message: result.message
  });
}

/**
 * Handle bank withdrawal
 */
function handleBankWithdraw(socket, data, callback, io) {
  const { amount } = data;
  const player = getPlayer(socket.id);
  
  if (!player) {
    callback({ success: false, error: 'Player not found' });
    return;
  }
  
  const result = withdrawCredits(player, amount);
  
  if (!result.success) {
    callback({ success: false, error: result.error });
    return;
  }
  
  updatePlayer(socket.id, result.playerState);
  
  io.emit('playerUpdate', { 
    socketId: socket.id, 
    player: getPublicPlayerInfo(socket.id) 
  });
  
  addActivity(`${player.name} withdrew ${amount} credits from The Mattress`);
  
  callback({ 
    success: true, 
    playerState: getPlayer(socket.id),
    message: result.message
  });
}

/**
 * Handle desperate work
 */
function handleDesperateWork(socket, data, callback, io) {
  const player = getPlayer(socket.id);
  
  if (!player) {
    callback({ success: false, error: 'Player not found' });
    return;
  }
  
  const result = doDesperateWork(player);
  
  if (!result.success) {
    callback({ success: false, error: result.error });
    return;
  }
  
  updatePlayer(socket.id, result.playerState);
  
  io.emit('playerUpdate', { 
    socketId: socket.id, 
    player: getPublicPlayerInfo(socket.id) 
  });
  
  callback({ 
    success: true, 
    playerState: getPlayer(socket.id),
    message: result.message,
    earned: result.earned
  });
}

/**
 * Handle combat action
 */
function handleCombatAction(socket, data, callback, io) {
  const { action } = data;
  const player = getPlayer(socket.id);
  
  console.log(`Combat action from ${socket.id}: ${action}`);
  
  if (!player) {
    callback({ success: false, error: 'Player not found' });
    return;
  }
  
  if (!player.activeCombat) {
    callback({ success: false, error: 'Not in combat' });
    return;
  }
  
  // NPC combat resolution
  const result = resolveCombatRound(player, player.activeCombat, action);
  
  if (!result.success) {
    callback({ success: false, error: result.error });
    return;
  }
  
  // Update player and combat state
  updatePlayer(socket.id, result.playerState);
  const updatedPlayer = getPlayer(socket.id);
  
  // Clear activeCombat if combat is resolved (unless there's pending loot), otherwise update it
  if (result.combatState.resolved && !result.combatState.pendingLoot) {
    updatedPlayer.activeCombat = null;
  } else {
    updatedPlayer.activeCombat = result.combatState;
  }
  
  updatePlayer(socket.id, updatedPlayer);
  
  // Check for death
  const deathCheck = checkDeath(result.playerState);
  if (deathCheck.isDead) {
    updatePlayer(socket.id, deathCheck.playerState);
    
    callback({
      success: true,
      playerState: getPlayer(socket.id),
      combatState: result.combatState,
      isDead: true
    });
    return;
  }
  
  callback({
    success: true,
    playerState: getPlayer(socket.id),
    combatState: result.combatState
  });

  // Try to advance tick if combat is resolved
  if (result.combatState.resolved) {
    tryAdvanceTick();
  }
}

/**
 * Handle accept loot
 */
function handleAcceptLoot(socket, data, callback, io) {
  const player = getPlayer(socket.id);
  
  if (!player) {
    callback({ success: false, error: 'Player not found' });
    return;
  }
  
  if (!player.activeCombat) {
    callback({ success: false, error: 'No combat state found' });
    return;
  }
  
  const result = acceptLoot(player, player.activeCombat);
  
  if (!result.success) {
    callback({ success: false, error: result.error });
    return;
  }
  
  updatePlayer(socket.id, result.playerState);
  
  // Clear combat state after accepting loot
  const updatedPlayer = getPlayer(socket.id);
  updatedPlayer.activeCombat = null;
  updatePlayer(socket.id, updatedPlayer);
  
  // Don't log to activity feed - player's local log already shows this
  
  io.emit('playerUpdate', { 
    socketId: socket.id, 
    player: getPublicPlayerInfo(socket.id) 
  });
  
  callback({ 
    success: true, 
    playerState: getPlayer(socket.id),
    message: result.message
  });
  
  // Try to advance tick
  tryAdvanceTick();
}

/**
 * Handle inspection action
 */
function handleInspectionAction(socket, data, callback, io) {
  const { action } = data;
  const player = getPlayer(socket.id);
  
  if (!player) {
    callback({ success: false, error: 'Player not found' });
    return;
  }
  
  if (!player.inspection) {
    callback({ success: false, error: 'Not being inspected' });
    return;
  }
  
  const result = resolveInspection(player, action);
  
  if (!result.success) {
    callback({ success: false, error: result.error });
    return;
  }
  
  updatePlayer(socket.id, result.playerState);
  
  // Clear inspection state
  const updatedPlayer = getPlayer(socket.id);
  updatedPlayer.inspection = null;
  updatePlayer(socket.id, updatedPlayer);
  
  // Only log successful resistance to activity feed (interesting event)
  if (action === 'resist' && result.outcome === 'success') {
    addActivity({
      type: 'inspection',
      playerName: player.name,
      message: `${player.name} successfully resisted inspection!`
    });
    io.emit('activityUpdate', { activities: getServerState().recentActivity });
  }
  
  io.emit('playerUpdate', { 
    socketId: socket.id, 
    player: getPublicPlayerInfo(socket.id) 
  });
  
  callback({ 
    success: true, 
    playerState: getPlayer(socket.id),
    outcome: result.outcome,
    message: result.message
  });
  
  // Try to advance tick
  tryAdvanceTick();
}

/**
 * Handle respawn
 */
function handleRespawn(socket, data, callback, io) {
  const player = getPlayer(socket.id);
  
  if (!player) {
    callback({ success: false, error: 'Player not found' });
    return;
  }
  
  const result = respawn(player);
  
  if (!result.success) {
    callback({ success: false, error: result.error, gameOver: result.gameOver });
    return;
  }
  
  updatePlayer(socket.id, result.playerState);
  
  // Add to activity
  addActivity({
    type: 'respawn',
    playerName: player.name,
    message: `${player.name} respawned at ${result.respawnLocation}`
  });
  
  io.emit('playerUpdate', { 
    socketId: socket.id, 
    player: getPublicPlayerInfo(socket.id) 
  });
  io.emit('activityUpdate', { activities: getServerState().recentActivity });
  
  callback({ 
    success: true, 
    playerState: getPlayer(socket.id),
    respawnLocation: result.respawnLocation
  });
}

/**
 * Handle get leaderboard
 */
function handleGetLeaderboard(callback) {
  const leaderboard = getLeaderboard(10);
  callback({ leaderboard });
}

/**
 * Handle get tick info
 */
function handleGetTickInfo(callback) {
  const tickInfo = getTimeUntilNextTick();
  callback({ 
    tick: getServerState().tick,
    ...tickInfo 
  });
}

/**
 * Handle disconnect
 */
function handleDisconnect(socket, io) {
  const player = getPlayer(socket.id);
  
  if (player) {
    // Add to activity
    addActivity({
      type: 'leave',
      playerName: player.name,
      message: `${player.name} left the system`
    });
    
    // Remove player
    removePlayer(socket.id);
    
    // Broadcast to all players
    io.emit('playerLeft', { socketId: socket.id });
    io.emit('activityUpdate', { activities: getServerState().recentActivity });
    
    console.log(`Player disconnected: ${player.name} (${socket.id})`);
  } else {
    console.log(`Client disconnected: ${socket.id}`);
  }
}

/**
 * Handle clear combat (debug/fix for stuck combat states)
 */
function handleClearCombat(socket, callback) {
  const player = getPlayer(socket.id);
  
  if (!player) {
    return callback({ success: false, error: 'Player not found' });
  }
  
  if (!player.activeCombat) {
    return callback({ success: false, error: 'Not in combat' });
  }
  
  console.log(`Clearing stuck combat state for ${player.name}`);
  
  player.activeCombat = null;
  updatePlayer(socket.id, player);
  
  callback({ success: true, message: 'Combat state cleared' });
}

/**
 * Setup debug panel handlers
 */
function setupDebugHandlers(socket, io) {
  console.log('[DEBUG] Setting up debug handlers for socket:', socket.id);
  
  // Trigger specific event type
  socket.on('debug:triggerEvent', (data, callback) => {
    console.log('[DEBUG] Received debug:triggerEvent from', socket.id, 'with data:', data);
    try {
      const { eventType } = data;
      const state = getServerState();
      
      if (!eventType) {
        return callback({ success: false, error: 'Event type required' });
      }
      
      // Generate the specific event
      const result = generateSpecificEvent(
        eventType,
        state.markets,
        state.activeEvents,
        state.stationInventories,
        state.tick
      );
      
      if (!result) {
        return callback({ success: false, error: 'Failed to generate event' });
      }
      
      // Add event to active events (only the event part, not the description)
      state.activeEvents.push(result.event);
      
      console.log(`[DEBUG] Triggered ${eventType} event:`, result);
      
      // Broadcast the new event to all players (send only description, like processTick does)
      io.emit('tick', {
        tick: state.tick,
        newEvent: result.description,
        markets: state.markets,
        stationInventories: state.stationInventories,
        activeEvents: state.activeEvents
      });
      
      callback({ success: true, event: result });
    } catch (error) {
      console.error('Debug trigger event error:', error);
      callback({ success: false, error: error.message });
    }
  });
  
  // Force tick advancement
  socket.on('debug:forceTick', (data, callback) => {
    try {
      const state = getServerState();
      
      // Mark player as traveled if not already (so they don't get stuck)
      if (!hasPlayerTraveled(socket.id)) {
        markPlayerTraveled(socket.id);
      }
      
      // Force tick immediately, bypassing all checks
      forceAdvanceTick();
      
      console.log('[DEBUG] Forced tick advancement');
      callback({ success: true, newTick: state.tick });
    } catch (error) {
      console.error('Debug force tick error:', error);
      callback({ success: false, error: error.message });
    }
  });
  
  // Add credits
  socket.on('debug:addCredits', (data, callback) => {
    try {
      const { amount } = data;
      const player = getPlayer(socket.id);
      
      if (!player) {
        return callback({ success: false, error: 'Player not found' });
      }
      
      if (!amount || amount <= 0) {
        return callback({ success: false, error: 'Invalid amount' });
      }
      
      player.credits += amount;
      updatePlayer(socket.id, player);
      
      console.log(`[DEBUG] Added ${amount} credits to ${player.name}`);
      
      callback({ success: true, newCredits: player.credits });
      
      // Send updated player state directly to the player
      socket.emit('playerState', player);
      
      // Broadcast player update
      io.emit('playerUpdate', { 
        socketId: socket.id, 
        player: getPublicPlayerInfo(socket.id) 
      });
    } catch (error) {
      console.error('Debug add credits error:', error);
      callback({ success: false, error: error.message });
    }
  });
  
  // Restore full hull
  socket.on('debug:fullHull', (data, callback) => {
    try {
      const player = getPlayer(socket.id);
      
      if (!player) {
        return callback({ success: false, error: 'Player not found' });
      }
      
      player.hull = player.hullMax;
      updatePlayer(socket.id, player);
      
      console.log(`[DEBUG] Restored full hull for ${player.name}`);
      
      callback({ success: true, newHull: player.hull });
      
      // Send updated player state directly to the player
      socket.emit('playerState', player);
      
      // Broadcast player update
      io.emit('playerUpdate', { 
        socketId: socket.id, 
        player: getPublicPlayerInfo(socket.id) 
      });
    } catch (error) {
      console.error('Debug full hull error:', error);
      callback({ success: false, error: error.message });
    }
  });
  
  // Max cargo upgrade
  socket.on('debug:maxCargo', (data, callback) => {
    try {
      const player = getPlayer(socket.id);
      
      if (!player) {
        return callback({ success: false, error: 'Player not found' });
      }
      
      player.upgrades.cargo = 5; // Max tier
      player.cargoMax = getPlayerMaxCargo(player); // Recalculate cargoMax
      updatePlayer(socket.id, player);
      
      console.log(`[DEBUG] Maxed cargo for ${player.name}, new cargoMax: ${player.cargoMax}`);
      
      callback({ success: true, newCargoUpgrade: player.upgrades.cargo });
      
      // Send updated player state directly to the player
      socket.emit('playerState', player);
      
      // Broadcast player update
      io.emit('playerUpdate', { 
        socketId: socket.id, 
        player: getPublicPlayerInfo(socket.id) 
      });
    } catch (error) {
      console.error('Debug max cargo error:', error);
      callback({ success: false, error: error.message });
    }
  });
  
  // Teleport to station
  socket.on('debug:teleport', (data, callback) => {
    try {
      const { stationId } = data;
      const player = getPlayer(socket.id);
      
      if (!player) {
        return callback({ success: false, error: 'Player not found' });
      }
      
      if (!stationId) {
        return callback({ success: false, error: 'Station ID required' });
      }
      
      const station = STATIONS.find(s => s.id === stationId);
      if (!station) {
        return callback({ success: false, error: 'Invalid station ID' });
      }
      
      // Cancel any active travel
      player.traveling = null;
      player.location = stationId;
      updatePlayer(socket.id, player);
      
      console.log(`[DEBUG] Teleported ${player.name} to ${station.name}`);
      
      callback({ success: true, playerState: player });
      
      // Send updated player state directly to the player
      socket.emit('playerState', player);
      
      // Broadcast player update to all clients (for leaderboard/map)
      io.emit('playerUpdate', { 
        socketId: socket.id, 
        player: getPublicPlayerInfo(socket.id) 
      });
    } catch (error) {
      console.error('Debug teleport error:', error);
      callback({ success: false, error: error.message });
    }
  });
}


