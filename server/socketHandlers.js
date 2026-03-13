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
  resolvePvpRound,
  acceptLoot,
  resolveInspection,
  checkDeath,
  respawn,
  initiatePvpCombat,
  handlePvpVictory,
  handlePvpDefeat,
  calculateTotalCargoValue,
  getPlayerAttackBonus,
  generateSpecificEvent,
  getPlayerMaxCargo,
  shouldTimeoutCombat
} from './gameLogic.js';
import { STATIONS } from '../shared/data.js';
import { tryAdvanceTick, getTimeUntilNextTick, forceAdvanceTick } from './tickSystem.js';

// Track active combat timeouts: Map<socketId, timeoutId>
const combatTimeouts = new Map();

/**
 * Setup a combat timeout for PVP combat
 * After 20 seconds, auto-resolve combat with both players attacking
 */
function setupCombatTimeout(attackerSocketId, defenderSocketId, io) {
  const timeoutDuration = 20000; // 20 seconds
  
  // Clear any existing timeouts for these players
  clearCombatTimeout(attackerSocketId);
  clearCombatTimeout(defenderSocketId);
  
  console.log(`Setting up combat timeout for ${attackerSocketId} vs ${defenderSocketId}`);
  
  const timeoutId = setTimeout(() => {
    console.log(`Combat timeout expired for ${attackerSocketId} vs ${defenderSocketId}`);
    
    // Get both players
    const attackerPlayer = getPlayer(attackerSocketId);
    const defenderPlayer = getPlayer(defenderSocketId);
    
    // Verify both players still exist and are in combat
    if (!attackerPlayer || !defenderPlayer) {
      console.log(`Timeout: One or both players no longer exist`);
      return;
    }
    
    if (!attackerPlayer.activeCombat || !defenderPlayer.activeCombat) {
      console.log(`Timeout: One or both players no longer in combat`);
      return;
    }
    
    const attackerCombat = attackerPlayer.activeCombat;
    
    // Check if timeout already triggered (shouldn't happen, but safety check)
    if (attackerCombat.timeoutTriggered) {
      console.log(`Timeout: Already triggered for this round`);
      return;
    }
    
    // Mark timeout as triggered
    attackerCombat.timeoutTriggered = true;
    
    // Auto-fill missing actions with 'attack'
    if (!attackerCombat.attackerReady) {
      attackerCombat.attackerAction = 'attack';
      attackerCombat.attackerReady = true;
    }
    if (!attackerCombat.defenderReady) {
      attackerCombat.defenderAction = 'attack';
      attackerCombat.defenderReady = true;
    }
    
    // Add timeout message to combat log
    if (!attackerCombat.combatLog) {
      attackerCombat.combatLog = [];
    }
    attackerCombat.combatLog.push('⏱️ Combat timeout - both players auto-attacking');
    
    // Resolve the round
    const result = resolvePvpRound(
      attackerPlayer,
      defenderPlayer,
      attackerCombat,
      attackerCombat.attackerAction,
      attackerCombat.defenderAction
    );
    
    if (!result.success) {
      console.error(`Timeout: Combat resolution failed`);
      return;
    }
    
    // Update both players' states
    const newAttacker = result.attacker;
    const newDefender = result.defender;
    const newCombat = result.combatState;
    
    // Create defender's combat state (mirror of attacker's)
    const defenderCombat = {
      enemyType: newCombat.enemyType,
      currentRound: newCombat.currentRound,
      combatLog: newCombat.combatLog,
      resolved: newCombat.resolved,
      outcome: newCombat.outcome,
      opponentSocketId: attackerSocketId,
      opponentName: attackerPlayer.name,
      opponentHull: newAttacker.hull,
      opponentHullMax: attackerPlayer.hullMax,
      opponentAttackBonus: newAttacker.upgrades.weapons ? 5 : 0,
      roundStartTime: newCombat.roundStartTime,
      timeoutTriggered: newCombat.timeoutTriggered
    };
    
    newAttacker.activeCombat = newCombat;
    newDefender.activeCombat = defenderCombat;
    
    // Handle combat resolution
    if (!newCombat.resolved) {
      // Combat continues - update states and set up new timeout
      updatePlayer(attackerSocketId, newAttacker);
      updatePlayer(defenderSocketId, newDefender);
      
      // Emit updated combat state to both players
      io.to(attackerSocketId).emit('combatRoundResolved', {
        playerState: newAttacker,
        combatState: newCombat
      });
      
      io.to(defenderSocketId).emit('combatRoundResolved', {
        playerState: newDefender,
        combatState: defenderCombat
      });
      
      // Set up timeout for the next round
      setupCombatTimeout(attackerSocketId, defenderSocketId, io);
    } else {
      // Combat ended
      clearCombatTimeout(attackerSocketId);
      clearCombatTimeout(defenderSocketId);
      
      if (newCombat.outcome === 'victory') {
        const pvpResult = handlePvpVictory(newAttacker, newDefender, getServerState().markets);
        updatePlayer(attackerSocketId, pvpResult.attacker);
        updatePlayer(defenderSocketId, pvpResult.defender);
        
        io.to(attackerSocketId).emit('combatResolved', {
          playerState: pvpResult.attacker,
          combatState: newCombat
        });
        
        io.to(defenderSocketId).emit('combatResolved', {
          playerState: pvpResult.defender,
          combatState: defenderCombat
        });
      } else if (newCombat.outcome === 'defeat') {
        const pvpResult = handlePvpDefeat(newAttacker, newDefender, getServerState().markets);
        updatePlayer(attackerSocketId, pvpResult.attacker);
        updatePlayer(defenderSocketId, pvpResult.defender);
        
        io.to(attackerSocketId).emit('combatResolved', {
          playerState: pvpResult.attacker,
          combatState: newCombat
        });
        
        io.to(defenderSocketId).emit('combatResolved', {
          playerState: pvpResult.defender,
          combatState: defenderCombat
        });
      } else if (newCombat.outcome === 'escaped') {
        updatePlayer(attackerSocketId, newAttacker);
        updatePlayer(defenderSocketId, newDefender);
        
        io.to(attackerSocketId).emit('combatResolved', {
          playerState: newAttacker,
          combatState: newCombat
        });
        
        io.to(defenderSocketId).emit('combatResolved', {
          playerState: newDefender,
          combatState: defenderCombat
        });
      }
    }
  }, timeoutDuration);
  
  // Store the timeout IDs for both players
  combatTimeouts.set(attackerSocketId, timeoutId);
  combatTimeouts.set(defenderSocketId, timeoutId);
}

/**
 * Clear combat timeout for a player
 */
function clearCombatTimeout(socketId) {
  const timeoutId = combatTimeouts.get(socketId);
  if (timeoutId) {
    clearTimeout(timeoutId);
    combatTimeouts.delete(socketId);
    console.log(`Cleared combat timeout for ${socketId}`);
  }
}

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
    
    // PVP actions
    socket.on('attackPlayer', (data, callback) => {
      handleAttackPlayer(socket, data, callback, io);
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
  
  const isPvp = player.activeCombat.enemyType === 'player';
  
  console.log(`Combat type: ${isPvp ? 'PVP' : 'NPC'}`);
  
  // PVP combat: wait for both players' actions
  if (isPvp) {
    // Bribe is not allowed in PVP combat
    if (action === 'bribe') {
      callback({ success: false, error: 'Cannot bribe another player' });
      return;
    }
    
    const opponent = getPlayer(player.activeCombat.opponentSocketId);
    
    console.log(`Opponent found: ${!!opponent}, Opponent in combat: ${!!(opponent && opponent.activeCombat)}`);
    
    if (!opponent || !opponent.activeCombat) {
      callback({ success: false, error: 'Opponent not found or not in combat' });
      return;
    }
    
    // Find which combat state is the "master" (attacker's combat state)
    // The attacker's combat state has attackerAction/defenderAction fields
    let attackerCombat, attackerPlayer, defenderPlayer, attackerSocketId, defenderSocketId;
    
    if (player.activeCombat.hasOwnProperty('attackerAction')) {
      // This player initiated the attack (is the attacker)
      console.log(`${player.name} is the attacker`);
      attackerCombat = player.activeCombat;
      attackerPlayer = player;
      defenderPlayer = opponent;
      attackerSocketId = socket.id;
      defenderSocketId = opponent.socketId;
      
      // Store attacker's action
      attackerCombat.attackerAction = action;
      attackerCombat.attackerReady = true;
    } else if (opponent.activeCombat.hasOwnProperty('attackerAction')) {
      // Opponent initiated the attack (opponent is the attacker)
      console.log(`${opponent.name} is the attacker, ${player.name} is defender`);
      attackerCombat = opponent.activeCombat;
      attackerPlayer = opponent;
      defenderPlayer = player;
      attackerSocketId = opponent.socketId;
      defenderSocketId = socket.id;
      
      // Store defender's action
      attackerCombat.defenderAction = action;
      attackerCombat.defenderReady = true;
    } else {
      // Neither has the fields - this shouldn't happen
      console.error(`ERROR: Neither player has attackerAction field!`);
      callback({ success: false, error: 'Invalid PVP combat state' });
      return;
    }
    
    console.log(`Ready status: attacker=${attackerCombat.attackerReady}, defender=${attackerCombat.defenderReady}`);
    
    // Update the combat state
    const updatedAttacker = getPlayer(attackerSocketId);
    updatedAttacker.activeCombat = attackerCombat;
    updatePlayer(attackerSocketId, updatedAttacker);
    
    // Check for combat timeout
    const hasTimedOut = shouldTimeoutCombat(attackerCombat);
    
    if (hasTimedOut && !attackerCombat.timeoutTriggered) {
      console.log(`Combat timeout triggered! Auto-attacking for both players.`);
      
      // Mark timeout as triggered to prevent multiple timeout triggers
      attackerCombat.timeoutTriggered = true;
      
      // Auto-fill missing actions with 'attack'
      if (!attackerCombat.attackerReady) {
        attackerCombat.attackerAction = 'attack';
        attackerCombat.attackerReady = true;
      }
      if (!attackerCombat.defenderReady) {
        attackerCombat.defenderAction = 'attack';
        attackerCombat.defenderReady = true;
      }
      
      // Add timeout message to combat log
      if (!attackerCombat.combatLog) {
        attackerCombat.combatLog = [];
      }
      attackerCombat.combatLog.push('⏱️ Combat timeout - both players auto-attacking');
      
      // Update the combat state with timeout changes
      const timeoutUpdatedAttacker = getPlayer(attackerSocketId);
      timeoutUpdatedAttacker.activeCombat = attackerCombat;
      updatePlayer(attackerSocketId, timeoutUpdatedAttacker);
    }
    
    // If both players haven't chosen yet, just wait
    if (!attackerCombat.attackerReady || !attackerCombat.defenderReady) {
      console.log(`Waiting for other player...`);
      // Notify current player that they're waiting
      callback({
        success: true,
        waiting: true,
        playerState: getPlayer(socket.id),
        combatState: socket.id === attackerSocketId ? attackerCombat : defenderPlayer.activeCombat
      });
      
      // Notify opponent that this player has chosen
      io.to(socket.id === attackerSocketId ? defenderSocketId : attackerSocketId).emit('opponentReady', {
        opponentName: player.name
      });
      
      return;
    }
    
    console.log(`Both players ready! Resolving round...`);
    
    // Clear combat timeout since both players acted before timeout
    clearCombatTimeout(attackerSocketId);
    clearCombatTimeout(defenderSocketId);
    
    // Both players ready - resolve the round!
    const result = resolvePvpRound(
      attackerPlayer,
      defenderPlayer,
      attackerCombat,
      attackerCombat.attackerAction,
      attackerCombat.defenderAction
    );
    
    if (!result.success) {
      callback({ success: false, error: 'Combat resolution failed' });
      return;
    }
    
    // Update both players' states
    const newAttacker = result.attacker;
    const newDefender = result.defender;
    const newCombat = result.combatState;
    
    // Create defender's combat state (mirror of attacker's)
    // IMPORTANT: Don't copy turn-tracking fields (attackerAction, defenderAction, etc.)
    const defenderCombat = {
      enemyType: newCombat.enemyType,
      currentRound: newCombat.currentRound,
      combatLog: newCombat.combatLog,
      resolved: newCombat.resolved,
      outcome: newCombat.outcome,
      opponentSocketId: attackerSocketId,
      opponentName: attackerPlayer.name,
      opponentHull: newAttacker.hull,
      opponentHullMax: attackerPlayer.hullMax,
      opponentAttackBonus: newAttacker.upgrades.weapons ? 5 : 0,
      roundStartTime: newCombat.roundStartTime,
      timeoutTriggered: newCombat.timeoutTriggered
    };
    
    newAttacker.activeCombat = newCombat;
    newDefender.activeCombat = defenderCombat;
    
    // Only update player states now if combat is NOT resolved
    // If resolved, we'll update after handlePvpVictory/handlePvpDefeat to avoid saving negative hull
    if (!newCombat.resolved) {
      updatePlayer(attackerSocketId, newAttacker);
      updatePlayer(defenderSocketId, newDefender);
    }
    
    // Handle combat resolution
    if (newCombat.resolved) {
      if (newCombat.outcome === 'victory') {
        // Attacker won - handle loot
        const pvpResult = handlePvpVictory(newAttacker, newDefender, getServerState().markets);
        
        updatePlayer(attackerSocketId, pvpResult.attacker);
        updatePlayer(defenderSocketId, pvpResult.defender);
        
        // Add activity
        const station = STATIONS.find(s => s.id === attackerPlayer.location);
        addActivity({
          type: 'pvp_victory',
          playerName: attackerPlayer.name,
          targetName: defenderPlayer.name,
          loot: pvpResult.loot,
          stationName: station.name,
          message: `${attackerPlayer.name} defeated ${defenderPlayer.name} and stole ${pvpResult.loot.credits}cr + cargo worth ${Math.round(pvpResult.loot.cargoValue)}cr!`
        });
        
        // Notify both players
        io.to(defenderSocketId).emit('pvpDefeated', {
          attacker: attackerPlayer.name,
          lostCredits: pvpResult.loot.credits,
          lostCargo: pvpResult.loot.cargo,
          combatState: defenderCombat
        });
        
        io.to(attackerSocketId).emit('combatResolved', {
          playerState: getPlayer(attackerSocketId),
          combatState: newCombat,
          pvpLoot: pvpResult.loot
        });
        
        // Broadcast updates
        io.emit('activityUpdate', { activities: getServerState().recentActivity });
        io.emit('playerUpdate', { 
          socketId: attackerSocketId, 
          player: getPublicPlayerInfo(attackerSocketId) 
        });
        io.emit('playerUpdate', { 
          socketId: defenderSocketId, 
          player: getPublicPlayerInfo(defenderSocketId) 
        });
        
      } else if (newCombat.outcome === 'defeat') {
        // Check for mutual destruction (both died)
        const mutualDestruction = newAttacker.hull <= 0 && newDefender.hull <= 0;
        
        if (mutualDestruction) {
          // Both died - handle death for both players
          const attackerDeath = checkDeath(newAttacker);
          const defenderDeath = checkDeath(newDefender);
          
          updatePlayer(attackerSocketId, attackerDeath.playerState);
          updatePlayer(defenderSocketId, defenderDeath.playerState);
          
          // Add activity
          const station = STATIONS.find(s => s.id === attackerPlayer.location);
          addActivity({
            type: 'pvp_mutual',
            playerName: attackerPlayer.name,
            targetName: defenderPlayer.name,
            stationName: station.name,
            message: `${attackerPlayer.name} and ${defenderPlayer.name} destroyed each other in combat!`
          });
          
          // Notify both players of death
          io.to(attackerSocketId).emit('combatResolved', {
            playerState: getPlayer(attackerSocketId),
            combatState: newCombat,
            isDead: true
          });
          
          io.to(defenderSocketId).emit('combatResolved', {
            playerState: getPlayer(defenderSocketId),
            combatState: defenderCombat,
            isDead: true
          });
          
          // Broadcast updates
          io.emit('activityUpdate', { activities: getServerState().recentActivity });
          io.emit('playerUpdate', { 
            socketId: attackerSocketId, 
            player: getPublicPlayerInfo(attackerSocketId) 
          });
          io.emit('playerUpdate', { 
            socketId: defenderSocketId, 
            player: getPublicPlayerInfo(defenderSocketId) 
          });
          
        } else {
          // Attacker lost - handle death penalty and bounty reward
          const pvpResult = handlePvpDefeat(newAttacker, newDefender);
          
          updatePlayer(defenderSocketId, pvpResult.defender);
          
          // Attacker gets death penalty
          const deathCheck = checkDeath(pvpResult.attacker);
          updatePlayer(attackerSocketId, deathCheck.playerState);
          
          // Add activity
          const station = STATIONS.find(s => s.id === attackerPlayer.location);
          const bountyMsg = pvpResult.bountyReward > 0 ? ` and claimed ${pvpResult.bountyReward}cr bounty` : '';
          addActivity({
            type: 'pvp_defeat',
            playerName: defenderPlayer.name,
            targetName: attackerPlayer.name,
            bountyReward: pvpResult.bountyReward,
            stationName: station.name,
            message: `${defenderPlayer.name} defended against ${attackerPlayer.name}${bountyMsg}!`
          });
          
          // Notify both players
          io.to(defenderSocketId).emit('pvpVictory', {
            defender: defenderPlayer.name,
            bountyReward: pvpResult.bountyReward,
            combatState: defenderCombat
          });
          
          io.to(attackerSocketId).emit('combatResolved', {
            playerState: getPlayer(attackerSocketId),
            combatState: newCombat,
            isDead: deathCheck.isDead
          });
          
          // Broadcast updates
          io.emit('activityUpdate', { activities: getServerState().recentActivity });
          io.emit('playerUpdate', { 
            socketId: attackerSocketId, 
            player: getPublicPlayerInfo(attackerSocketId) 
          });
          io.emit('playerUpdate', { 
            socketId: defenderSocketId, 
            player: getPublicPlayerInfo(defenderSocketId) 
          });
        }
        
      } else if (newCombat.outcome === 'escaped') {
        // Combat ended via flee or bribe - clear combat state for both players
        newAttacker.activeCombat = null;
        newDefender.activeCombat = null;
        
        updatePlayer(attackerSocketId, newAttacker);
        updatePlayer(defenderSocketId, newDefender);
        
        io.to(defenderSocketId).emit('pvpEscaped', {
          escapee: attackerPlayer.name,
          combatState: defenderCombat
        });
        
        io.to(attackerSocketId).emit('combatResolved', {
          playerState: getPlayer(attackerSocketId),
          combatState: newCombat
        });
      }
      
      // Send callback to whoever submitted last
      callback({
        success: true,
        playerState: getPlayer(socket.id),
        combatState: socket.id === attackerSocketId ? newCombat : defenderCombat
      });
      
      return;
    }
    
    // Combat not resolved - send updated state to both players
    io.to(attackerSocketId).emit('combatRoundResolved', {
      playerState: getPlayer(attackerSocketId),
      combatState: newCombat
    });
    
    io.to(defenderSocketId).emit('combatRoundResolved', {
      playerState: getPlayer(defenderSocketId),
      combatState: defenderCombat
    });
    
    // Set up timeout for the next round
    setupCombatTimeout(attackerSocketId, defenderSocketId, io);
    
    callback({
      success: true,
      playerState: getPlayer(socket.id),
      combatState: socket.id === attackerSocketId ? newCombat : defenderCombat
    });
    
    return;
  }
  
  // Non-PVP combat - use old logic
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
    // If player was in PVP combat, clear opponent's combat state
    if (player.activeCombat && player.activeCombat.enemyType === 'player') {
      const opponentId = player.activeCombat.opponentSocketId;
      const opponent = getPlayer(opponentId);
      if (opponent) {
        opponent.activeCombat = null;
        updatePlayer(opponentId, opponent);
        
        // Notify opponent
        io.to(opponentId).emit('pvpEscaped', {
          escapee: player.name,
          reason: 'disconnected'
        });
      }
    }
    
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
 * Handle attack player
 */
function handleAttackPlayer(socket, data, callback, io) {
  const { targetSocketId } = data;
  const attacker = getPlayer(socket.id);
  const defender = getPlayer(targetSocketId);
  const state = getServerState();
  
  console.log(`PVP Attack: ${socket.id} attacking ${targetSocketId}`);
  console.log(`Attacker found: ${!!attacker}, Defender found: ${!!defender}`);
  
  if (!attacker) {
    return callback({ success: false, error: 'Player not found' });
  }
  
  if (!defender) {
    console.log(`Target not found. Available players:`, Object.keys(state.players));
    return callback({ success: false, error: 'Target not found (player may have disconnected)' });
  }
  
  // Validation checks
  if (attacker.location !== defender.location) {
    return callback({ success: false, error: 'Target not at same location' });
  }
  
  if (attacker.activeCombat) {
    return callback({ success: false, error: 'Already in combat' });
  }
  
  if (defender.activeCombat) {
    return callback({ success: false, error: 'Target already in combat' });
  }
  
  // Safe zones removed - PVP allowed everywhere
  
  // Check cooldown for this specific target
  if (attacker.pvpCooldowns[targetSocketId]) {
    const cooldownExpiry = attacker.pvpCooldowns[targetSocketId] + 5;
    if (state.tick < cooldownExpiry) {
      const ticksRemaining = cooldownExpiry - state.tick;
      return callback({ 
        success: false, 
        error: `Must wait ${ticksRemaining} more ticks before attacking this player again` 
      });
    }
  }
  
  console.log(`PVP combat initiated: ${attacker.name} vs ${defender.name}`);
  
  // Initiate PVP combat
  const combat = initiatePvpCombat(attacker, defender);
  
  // Set combat state for both players
  attacker.activeCombat = combat;
  
  // Create defender's combat state WITHOUT the turn tracking fields
  defender.activeCombat = {
    enemyType: 'player',
    opponentSocketId: socket.id,
    opponentName: attacker.name,
    opponentHull: attacker.hull,
    opponentHullMax: attacker.hullMax,
    opponentAttackBonus: getPlayerAttackBonus(attacker),
    currentRound: combat.currentRound,
    maxRounds: combat.maxRounds,
    combatLog: combat.combatLog,
    pendingLoot: null,
    resolved: false,
    outcome: null,
    isDefender: true, // Flag to indicate they're being attacked
    roundStartTime: combat.roundStartTime, // Add timeout timestamp
    timeoutTriggered: combat.timeoutTriggered // Add timeout flag
    // NOTE: We do NOT copy attackerAction/defenderAction/attackerReady/defenderReady
    // because only the attacker's combat state should have these fields
  };
  
  // Set cooldown
  attacker.pvpCooldowns[targetSocketId] = state.tick;
  
  updatePlayer(socket.id, attacker);
  updatePlayer(targetSocketId, defender);
  
  // Set up combat timeout (20 seconds)
  setupCombatTimeout(socket.id, targetSocketId, io);
  
  // Add activity
  const station = STATIONS.find(s => s.id === attacker.location);
  addActivity({
    type: 'pvp_attack',
    playerName: attacker.name,
    targetName: defender.name,
    stationName: station.name,
    message: `${attacker.name} attacked ${defender.name} at ${station.name}!`
  });
  
  // Notify both players
  callback({ success: true, combat: attacker.activeCombat });
  
  io.to(targetSocketId).emit('pvpCombatStarted', { 
    combat: defender.activeCombat,
    attacker: {
      name: attacker.name,
      socketId: socket.id
    }
  });
  
  // Broadcast activity update
  io.emit('activityUpdate', { activities: state.recentActivity });
  io.emit('playerUpdate', { 
    socketId: socket.id, 
    player: getPublicPlayerInfo(socket.id) 
  });
  io.emit('playerUpdate', { 
    socketId: targetSocketId, 
    player: getPublicPlayerInfo(targetSocketId) 
  });
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
  
  // Clear bounty
  socket.on('debug:clearBounty', (data, callback) => {
    try {
      const player = getPlayer(socket.id);
      
      if (!player) {
        return callback({ success: false, error: 'Player not found' });
      }
      
      player.reputation.currentBounty = 0;
      updatePlayer(socket.id, player);
      
      console.log(`[DEBUG] Cleared bounty for ${player.name}`);
      
      callback({ success: true });
      
      // Send updated player state directly to the player
      socket.emit('playerState', player);
      
      // Broadcast player update
      io.emit('playerUpdate', { 
        socketId: socket.id, 
        player: getPublicPlayerInfo(socket.id) 
      });
    } catch (error) {
      console.error('Debug clear bounty error:', error);
      callback({ success: false, error: error.message });
    }
  });
  
  // Add bounty
  socket.on('debug:addBounty', (data, callback) => {
    try {
      const player = getPlayer(socket.id);
      
      if (!player) {
        return callback({ success: false, error: 'Player not found' });
      }
      
      if (!player.reputation) {
        player.reputation = {
          kills: 0,
          timesKilled: 0,
          copKills: 0,
          bountyKills: 0,
          currentBounty: 0
        };
      }
      
      player.reputation.currentBounty += 1000;
      updatePlayer(socket.id, player);
      
      console.log(`[DEBUG] Added 1000cr bounty to ${player.name}, total: ${player.reputation.currentBounty}`);
      
      callback({ success: true, playerState: player });
      
      // Send updated player state directly to the player
      socket.emit('playerState', player);
      
      // Broadcast player update
      io.emit('playerUpdate', { 
        socketId: socket.id, 
        player: getPublicPlayerInfo(socket.id) 
      });
    } catch (error) {
      console.error('Debug add bounty error:', error);
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


