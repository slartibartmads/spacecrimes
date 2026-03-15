/**
 * Multiplayer client module - handles Socket.IO connection and events
 */

let socket = null;
let connected = false;
let playerState = null;
let gameState = null; // markets, events, tick

// Callbacks that game.js will set
let callbacks = {
  onConnected: null,
  onDisconnected: null,
  onStateUpdate: null,
  onMarketUpdate: null,
  onPlayerUpdate: null,
  onTick: null,
  onActivityUpdate: null,
  onPlayerJoined: null,
  onPlayerLeft: null,
  onCombatEncounter: null,
  onInspection: null,
  onDeath: null
};

/**
 * Initialize multiplayer connection
 */
export function initMultiplayer(serverUrl = 'http://localhost:3000') {
  socket = io(serverUrl);
  
  // Connection events
  socket.on('connect', () => {
    console.log('Connected to server');
    connected = true;
  });
  
  socket.on('disconnect', () => {
    console.log('Disconnected from server');
    connected = false;
    if (callbacks.onDisconnected) {
      callbacks.onDisconnected();
    }
  });
  
  // Game state events
  socket.on('marketUpdate', (data) => {
    gameState.markets = data.markets;
    if (callbacks.onMarketUpdate) {
      callbacks.onMarketUpdate(data.markets);
    }
  });
  
  socket.on('playerState', (data) => {
    // Direct player state update (e.g., from debug teleport)
    playerState = data;
    if (callbacks.onPlayerUpdate) {
      callbacks.onPlayerUpdate(data);
    }
  });
  
  socket.on('playerUpdate', (data) => {
    // Update if it's our player
    if (data.socketId === socket.id) {
      playerState = data.player;
      if (callbacks.onPlayerUpdate) {
        callbacks.onPlayerUpdate(data.player);
      }
    } else {
      // Update other players' positions
      if (callbacks.onOtherPlayerUpdate) {
        callbacks.onOtherPlayerUpdate(data);
      }
    }
  });
  
  socket.on('tick', (data) => {
    gameState.tick = data.tick;
    gameState.markets = data.markets;
    gameState.activeEvents = data.activeEvents;
    
    if (callbacks.onTick) {
      callbacks.onTick(data);
    }
  });
  
  socket.on('activityUpdate', (data) => {
    if (callbacks.onActivityUpdate) {
      callbacks.onActivityUpdate(data.activities);
    }
  });
  
  socket.on('playerJoined', (data) => {
    if (callbacks.onPlayerJoined) {
      callbacks.onPlayerJoined(data.player);
    }
  });
  
  socket.on('playerLeft', (data) => {
    if (callbacks.onPlayerLeft) {
      callbacks.onPlayerLeft(data.socketId);
    }
  });
  
}

/**
 * Set callback functions
 */
export function setCallbacks(newCallbacks) {
  callbacks = { ...callbacks, ...newCallbacks };
}

/**
 * Join game with username
 */
export function joinGame(username) {
  return new Promise((resolve, reject) => {
    if (!socket || !connected) {
      reject(new Error('Not connected to server'));
      return;
    }
    
    socket.emit('join', { username }, (response) => {
      if (response.success) {
        playerState = response.playerState;
        gameState = {
          markets: response.markets,
          activeEvents: response.activeEvents,
          tick: response.tick,
          players: response.players
        };
        
        if (callbacks.onConnected) {
          callbacks.onConnected(playerState, gameState);
        }
        
        resolve({ playerState, gameState });
      } else {
        reject(new Error(response.error));
      }
    });
  });
}

/**
 * Buy commodity
 */
export function buyCommodity(commodity, quantity) {
  return new Promise((resolve, reject) => {
    if (!socket || !connected) {
      reject(new Error('Not connected to server'));
      return;
    }
    
    console.log('Sending buy request:', { commodity, quantity });
    
    socket.emit('buy', { commodity, quantity }, (response) => {
      console.log('Received buy response:', response);
      
      if (response && response.success) {
        playerState = response.playerState;
        gameState.markets = response.markets;
        resolve(response);
      } else {
        const errorMsg = response?.error || 'Unknown error';
        console.error('Buy failed:', errorMsg);
        reject(new Error(errorMsg));
      }
    });
  });
}

/**
 * Sell commodity
 */
export function sellCommodity(commodity, quantity) {
  return new Promise((resolve, reject) => {
    if (!socket || !connected) {
      reject(new Error('Not connected to server'));
      return;
    }
    
    socket.emit('sell', { commodity, quantity }, (response) => {
      if (response && response.success) {
        playerState = response.playerState;
        gameState.markets = response.markets;
        resolve(response);
      } else {
        reject(new Error(response?.error || 'Unknown error'));
      }
    });
  });
}

/**
 * Jettison cargo
 */
export function jettisonCargo(commodity, quantity) {
  return new Promise((resolve, reject) => {
    if (!socket || !connected) {
      reject(new Error('Not connected to server'));
      return;
    }
    
    socket.emit('jettison', { commodity, quantity }, (response) => {
      if (response && response.success) {
        playerState = response.playerState;
        resolve(response);
      } else {
        reject(new Error(response?.error || 'Unknown error'));
      }
    });
  });
}

/**
 * Travel to destination
 */
export function travel(destination) {
  return new Promise((resolve, reject) => {
    if (!socket || !connected) {
      reject(new Error('Not connected to server'));
      return;
    }
    
    socket.emit('travel', { destination }, (response) => {
      if (response && response.success) {
        playerState = response.playerState;
        
        // Handle special cases
        if (response.pirateEncounter) {
          if (callbacks.onCombatEncounter) {
            callbacks.onCombatEncounter(response.combat);
          }
        } else if (response.copEncounter) {
          if (callbacks.onCombatEncounter) {
            callbacks.onCombatEncounter(response.combat);
          }
        } else if (response.inspection) {
          if (callbacks.onInspection) {
            callbacks.onInspection(response.inspectionState);
          }
        }
        
        resolve(response);
      } else {
        reject(new Error(response?.error || 'Unknown error'));
      }
    });
  });
}

/**
 * Deposit credits to bank
 */
export function depositCredits(amount) {
  return new Promise((resolve, reject) => {
    if (!socket || !connected) {
      reject(new Error('Not connected to server'));
      return;
    }
    
    socket.emit('bank:deposit', { amount }, (response) => {
      if (response && response.success) {
        playerState = response.playerState;
        resolve(response);
      } else {
        reject(new Error(response?.error || 'Unknown error'));
      }
    });
  });
}

/**
 * Withdraw credits from bank
 */
export function withdrawCredits(amount) {
  return new Promise((resolve, reject) => {
    if (!socket || !connected) {
      reject(new Error('Not connected to server'));
      return;
    }
    
    socket.emit('bank:withdraw', { amount }, (response) => {
      if (response && response.success) {
        playerState = response.playerState;
        resolve(response);
      } else {
        reject(new Error(response?.error || 'Unknown error'));
      }
    });
  });
}

/**
 * Buy upgrade
 */
export function buyUpgrade(upgradeId) {
  return new Promise((resolve, reject) => {
    socket.emit('buyUpgrade', { upgradeId }, (response) => {
      if (response.success) {
        playerState = response.playerState;
        resolve(response);
      } else {
        reject(new Error(response.error));
      }
    });
  });
}

/**
 * Repair hull
 */
export function repairHull() {
  return new Promise((resolve, reject) => {
    socket.emit('repair', {}, (response) => {
      if (response.success) {
        playerState = response.playerState;
        resolve(response);
      } else {
        reject(new Error(response.error));
      }
    });
  });
}

/**
 * Do desperate work
 */
export function doDesperateWork() {
  return new Promise((resolve, reject) => {
    socket.emit('desperateWork', {}, (response) => {
      if (response.success) {
        playerState = response.playerState;
        resolve(response);
      } else {
        reject(new Error(response.error));
      }
    });
  });
}

/**
 * Combat action
 */
export function combatAction(action) {
  return new Promise((resolve, reject) => {
    socket.emit('combatAction', { action }, (response) => {
      if (response.success) {
        playerState = response.playerState;
        
        if (response.isDead && callbacks.onDeath) {
          callbacks.onDeath();
        }
        
        resolve(response);
      } else {
        reject(new Error(response.error));
      }
    });
  });
}

/**
 * Accept loot after combat victory
 */
export function acceptLoot() {
  return new Promise((resolve, reject) => {
    socket.emit('acceptLoot', {}, (response) => {
      if (response.success) {
        playerState = response.playerState;
        resolve(response);
      } else {
        reject(new Error(response.error));
      }
    });
  });
}

/**
 * Inspection action
 */
export function inspectionAction(action) {
  return new Promise((resolve, reject) => {
    socket.emit('inspectionAction', { action }, (response) => {
      if (response.success) {
        playerState = response.playerState;
        resolve(response);
      } else {
        reject(new Error(response.error));
      }
    });
  });
}

/**
 * Respawn after death
 */
export function respawn() {
  return new Promise((resolve, reject) => {
    socket.emit('respawn', {}, (response) => {
      if (response.success) {
        playerState = response.playerState;
        resolve(response);
      } else {
        reject(new Error(response.error));
      }
    });
  });
}

/**
 * Get leaderboard
 */
export function getLeaderboard() {
  return new Promise((resolve, reject) => {
    socket.emit('getLeaderboard', (response) => {
      resolve(response.leaderboard);
    });
  });
}

/**
 * Get tick info
 */
export function getTickInfo() {
  return new Promise((resolve, reject) => {
    socket.emit('getTickInfo', (response) => {
      resolve(response);
    });
  });
}

/**
 * Clear stuck combat state (debug function)
 */
export function clearCombat() {
  return new Promise((resolve, reject) => {
    if (!socket || !connected) {
      reject(new Error('Not connected to server'));
      return;
    }
    
    socket.emit('clearCombat', {}, (response) => {
      if (response && response.success) {
        playerState.activeCombat = null;
        resolve(response);
      } else {
        reject(new Error(response?.error || 'Unknown error'));
      }
    });
  });
}

/**
 * Get current player state
 */
export function getPlayerState() {
  return playerState;
}

/**
 * Get current game state
 */
export function getGameState() {
  return gameState;
}

/**
 * Check if connected
 */
export function isConnected() {
  return connected;
}

// === DEBUG FUNCTIONS ===

/**
 * Trigger a specific event type (for debug panel)
 */
export function debugTriggerEvent(eventType) {
  return new Promise((resolve, reject) => {
    console.log('debugTriggerEvent: checking socket connection');
    if (!socket || !connected) {
      console.error('debugTriggerEvent: not connected');
      reject(new Error('Not connected to server'));
      return;
    }
    
    console.log('debugTriggerEvent: emitting debug:triggerEvent with', eventType);
    socket.emit('debug:triggerEvent', { eventType }, (response) => {
      console.log('debugTriggerEvent: received response', response);
      if (response && response.success) {
        resolve(response);
      } else {
        reject(new Error(response?.error || 'Failed to trigger event'));
      }
    });
  });
}

/**
 * Force tick advancement (for debug panel)
 */
export function debugForceTick() {
  return new Promise((resolve, reject) => {
    if (!socket || !connected) {
      reject(new Error('Not connected to server'));
      return;
    }
    
    socket.emit('debug:forceTick', {}, (response) => {
      if (response && response.success) {
        resolve(response);
      } else {
        reject(new Error(response?.error || 'Failed to force tick'));
      }
    });
  });
}

/**
 * Add credits to player (for debug panel)
 */
export function debugAddCredits(amount) {
  return new Promise((resolve, reject) => {
    if (!socket || !connected) {
      reject(new Error('Not connected to server'));
      return;
    }
    
    socket.emit('debug:addCredits', { amount }, (response) => {
      if (response && response.success) {
        playerState.credits = response.newCredits;
        resolve(response);
      } else {
        reject(new Error(response?.error || 'Failed to add credits'));
      }
    });
  });
}

/**
 * Restore hull to maximum (for debug panel)
 */
export function debugFullHull() {
  return new Promise((resolve, reject) => {
    if (!socket || !connected) {
      reject(new Error('Not connected to server'));
      return;
    }
    
    socket.emit('debug:fullHull', {}, (response) => {
      if (response && response.success) {
        playerState.hull = response.newHull;
        resolve(response);
      } else {
        reject(new Error(response?.error || 'Failed to restore hull'));
      }
    });
  });
}

/**
 * Upgrade cargo to maximum (for debug panel)
 */
export function debugMaxCargo() {
  return new Promise((resolve, reject) => {
    if (!socket || !connected) {
      reject(new Error('Not connected to server'));
      return;
    }
    
    socket.emit('debug:maxCargo', {}, (response) => {
      if (response && response.success) {
        // Player state will be updated via playerState event
        resolve(response);
      } else {
        reject(new Error(response?.error || 'Failed to upgrade cargo'));
      }
    });
  });
}

/**
 * Teleport to a station (for debug panel)
 */
export function debugTeleport(stationId) {
  return new Promise((resolve, reject) => {
    if (!socket || !connected) {
      reject(new Error('Not connected to server'));
      return;
    }
    
    socket.emit('debug:teleport', { stationId }, (response) => {
      if (response && response.success) {
        // Update full player state
        playerState = response.playerState;
        resolve(response);
      } else {
        reject(new Error(response?.error || 'Failed to teleport'));
      }
    });
  });
}
