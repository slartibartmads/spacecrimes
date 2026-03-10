// Space Drugwars - Multiplayer Client
// UI rendering and server communication only

import * as MP from './multiplayer.js';
import { STATIONS, COMMODITIES, ROUTES, UPGRADES, CONSTANTS } from '/shared/data.js';

// === CLIENT STATE ===
let playerState = null;
let gameState = null; // markets, events, tick
let allPlayers = []; // Other players in the system
let activities = [];
let pendingTravel = null;

// === HELPER FUNCTIONS ===

function getStationName(stationId) {
  const station = STATIONS.find(s => s.id === stationId);
  return station ? station.name : stationId;
}

// === INITIALIZATION ===

document.addEventListener('DOMContentLoaded', () => {
  // Initialize connection to server
  MP.initMultiplayer();
  
  // Set up multiplayer callbacks
  MP.setCallbacks({
    onConnected: handleConnected,
    onDisconnected: handleDisconnected,
    onMarketUpdate: handleMarketUpdate,
    onPlayerUpdate: handlePlayerUpdate,
    onOtherPlayerUpdate: handleOtherPlayerUpdate,
    onTick: handleTick,
    onActivityUpdate: handleActivityUpdate,
    onPlayerJoined: handlePlayerJoined,
    onPlayerLeft: handlePlayerLeft,
    onCombatEncounter: handleCombatEncounter,
    onInspection: handleInspection,
    onDeath: handleDeath,
    onOpponentReady: handleOpponentReady,
    onCombatRoundResolved: handleCombatRoundResolved,
    onCombatResolved: handleCombatResolved,
    onPvpDefeated: handlePvpDefeated,
    onPvpVictory: handlePvpVictory,
    onPvpEscaped: handlePvpEscaped
  });
  
  // Set up login screen
  setupLoginScreen();
  
  // Start tick timer update loop
  setInterval(updateTickTimer, 1000);
  
  // Update leaderboard every 5 seconds
  setInterval(() => {
    if (playerState && gameState) {
      updateLeaderboard();
    }
  }, 5000);
});

// === LOGIN ===

function setupLoginScreen() {
  const joinBtn = document.getElementById('join-btn');
  const usernameInput = document.getElementById('username-input');
  const loginError = document.getElementById('login-error');
  
  joinBtn.addEventListener('click', async () => {
    const username = usernameInput.value.trim();
    
    if (!username) {
      loginError.textContent = 'Please enter a username';
      loginError.style.display = 'block';
      return;
    }
    
    try {
      const result = await MP.joinGame(username);
      // Connection successful, callbacks will handle the rest
    } catch (error) {
      loginError.textContent = error.message;
      loginError.style.display = 'block';
    }
  });
  
  usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      joinBtn.click();
    }
  });
}

function handleConnected(player, state) {
  playerState = player;
  gameState = state;
  allPlayers = state.players || [];
  
  // Hide login screen, show game
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'grid';
  
  // Initialize UI
  renderMap();
  renderStation();
  renderStatus();
  renderPlayersHere(); // Show other players at current location
  renderLeaderboard();
  
  addLog(`Welcome to Space Drugwars, ${player.name}!`);
  addLog(`You are docked at ${getStationName(player.location)}`);
}

function handleDisconnected() {
  addLog('Disconnected from server', 'danger');
  // Could show reconnect screen here
}

// === MULTIPLAYER EVENT HANDLERS ===

function handleMarketUpdate(markets) {
  gameState.markets = markets;
  renderStation(); // Re-render market prices
}

function handlePlayerUpdate(player) {
  playerState = player;
  renderStatus();
  renderStation();
  renderPlayersHere(); // Update players here when our location changes
}

function handleOtherPlayerUpdate(data) {
  if (!data || !data.player) return;
  
  // Update the player in the allPlayers array
  const index = allPlayers.findIndex(p => p && p.socketId === data.socketId);
  if (index !== -1) {
    allPlayers[index] = data.player;
  } else {
    // Player not in list yet, add them
    allPlayers.push(data.player);
  }
  
  // Clean up any undefined entries
  allPlayers = allPlayers.filter(p => p != null);
  
  // Re-render map to show updated positions
  renderMap();
  
  // Re-render players here list in case they moved to/from our station
  renderPlayersHere();
}

function handleTick(data) {
  gameState.tick = data.tick;
  gameState.markets = data.markets;
  gameState.activeEvents = data.activeEvents;
  
  // Log new events
  if (data.newEvent) {
    addLog(`MARKET EVENT: ${data.newEvent.description}`, 'warning');
  }
  
  // Log expired events
  if (data.expiredEvents && data.expiredEvents.length > 0) {
    data.expiredEvents.forEach(event => {
      addLog(`Market stabilized: ${event.description} ended`);
    });
  }
  
  renderStation();
  renderStatus();
}

function handleActivityUpdate(newActivities) {
  activities = newActivities;
  renderActivityFeed();
}

function handlePlayerJoined(player) {
  // Add player to allPlayers list
  if (!allPlayers.find(p => p.socketId === player.socketId)) {
    allPlayers.push(player);
  }
  
  // Update gameState.players if it exists
  if (gameState && gameState.players) {
    if (!gameState.players.find(p => p.socketId === player.socketId)) {
      gameState.players.push(player);
    }
  }
  
  // Re-render players here list in case they're at same station
  renderPlayersHere();
  
  // Activity feed will show this
  updateLeaderboard();
}

function handlePlayerLeft(socketId) {
  // Activity feed will show this
  allPlayers = allPlayers.filter(p => p && p.socketId !== socketId);
  
  // Update gameState.players if it exists
  if (gameState && gameState.players) {
    gameState.players = gameState.players.filter(p => p && p.socketId !== socketId);
  }
  
  // Re-render players here list
  renderPlayersHere();
  
  updateLeaderboard();
}

function handleCombatEncounter(combat) {
  showCombatModal(combat);
}

function handleInspection(inspectionState) {
  showInspectionModal(inspectionState);
}

function handleDeath() {
  showDeathModal();
}

// === RENDERING ===

function renderMap() {
  const routesLayer = document.getElementById('routes-layer');
  const stationsLayer = document.getElementById('stations-layer');
  const playersLayer = document.getElementById('players-layer');
  
  routesLayer.innerHTML = '';
  stationsLayer.innerHTML = '';
  playersLayer.innerHTML = '';
  
  // Draw routes
  ROUTES.forEach(route => {
    const from = STATIONS.find(s => s.id === route.from);
    const to = STATIONS.find(s => s.id === route.to);
    const isToll = route.tollFee && route.tollFee > 0;
    
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', from.position.x);
    line.setAttribute('y1', from.position.y);
    line.setAttribute('x2', to.position.x);
    line.setAttribute('y2', to.position.y);
    line.setAttribute('stroke', isToll ? '#863C23' : '#17D773');
    line.setAttribute('stroke-width', isToll ? '2' : '1');
    line.setAttribute('opacity', isToll ? '0.5' : '0.3');
    routesLayer.appendChild(line);
    
    // Add toll fee label
    if (isToll) {
      const midX = (from.position.x + to.position.x) / 2;
      const midY = (from.position.y + to.position.y) / 2;
      
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', midX);
      label.setAttribute('y', midY);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('fill', '#FF5A41');
      label.setAttribute('font-size', '10');
      label.setAttribute('font-weight', 'bold');
      label.setAttribute('font-family', 'Source Code Pro, monospace');
      label.textContent = `${route.tollFee}cr`;
      routesLayer.appendChild(label);
    }
  });
  
  // Draw stations
  STATIONS.forEach(station => {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'station');
    group.style.cursor = 'pointer';
    
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', station.position.x);
    circle.setAttribute('cy', station.position.y);
    circle.setAttribute('r', '8');
    circle.setAttribute('fill', station.id === playerState.location ? '#F2FFC5' : '#17D773');
    circle.setAttribute('stroke', '#0D1E06');
    circle.setAttribute('stroke-width', '1');
    
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', station.position.x);
    text.setAttribute('y', station.position.y + 23);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', '#17D773');
    text.setAttribute('font-size', '10');
    text.setAttribute('font-weight', 'bold');
    text.setAttribute('font-family', 'Source Code Pro, monospace');
    text.textContent = station.name;
    
    group.appendChild(circle);
    group.appendChild(text);
    
    // Click to travel
    group.addEventListener('click', () => {
      if (station.id !== playerState.location) {
        attemptTravel(station.id);
      }
    });
    
    stationsLayer.appendChild(group);
  });
  
  // Draw other players (small dots)
  const validPlayers = allPlayers.filter(p => p != null && p.socketId);
  
  validPlayers.forEach(player => {
    if (!playerState || player.socketId === playerState.socketId) return; // Skip self
    
    const station = STATIONS.find(s => s.id === player.location);
    if (!station) return;
    
    // Offset slightly so multiple players at same station are visible
    const offsetX = (Math.random() - 0.5) * 15;
    const offsetY = (Math.random() - 0.5) * 15;
    
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', station.position.x + offsetX);
    dot.setAttribute('cy', station.position.y + offsetY);
    dot.setAttribute('r', '3');
    dot.setAttribute('class', 'player-dot');
    
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', station.position.x + offsetX);
    label.setAttribute('y', station.position.y + offsetY + 10);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('class', 'player-label');
    label.textContent = player.name;
    
    playersLayer.appendChild(dot);
    playersLayer.appendChild(label);
  });
}

function renderStation() {
  if (!playerState || !gameState) return;
  
  const station = STATIONS.find(s => s.id === playerState.location);
  if (!station) return;
  
  document.getElementById('station-name').textContent = `DOCKED AT: ${station.name}`;
  document.getElementById('station-description').textContent = station.description;
  
  // Render commodities
  const commodityList = document.getElementById('commodity-list');
  commodityList.innerHTML = '';
  
  COMMODITIES.forEach(commodity => {
    const marketData = gameState.markets[station.id][commodity.id];
    const playerQuantity = playerState.cargo[commodity.id] || 0;
    
    const row = document.createElement('tr');
    
    // Name
    const nameCell = document.createElement('td');
    nameCell.textContent = commodity.name;
    row.appendChild(nameCell);
    
    // Price with arrow indicator
    const priceCell = document.createElement('td');
    
    // Calculate price difference from base
    const priceDiff = marketData.currentPrice - commodity.basePrice;
    const pricePercent = Math.round((priceDiff / commodity.basePrice) * 100);
    
    // Determine price indicators with SVG icons
    let svgPath = null;
    
    if (pricePercent < -15) {
      svgPath = 'M13.7782 7.22182L7.99998 13L2.2218 7.22182M13.7782 1.44365L7.99998 7.22182L2.2218 1.44365'; // lowest
    } else if (pricePercent < -5) {
      svgPath = 'M2.22185 5.22182L8.00002 11L13.7782 5.22182'; // low
    } else if (pricePercent > 15) {
      svgPath = 'M13.7782 8.77818L7.99998 3L2.2218 8.77818M13.7782 14.5564L7.99998 8.77818L2.2218 14.5564'; // highest
    } else if (pricePercent > 5) {
      svgPath = 'M13.7782 10.7782L7.99998 5L2.2218 10.7782'; // high
    }
    
    priceCell.textContent = `${marketData.currentPrice}cr `;
    
    if (svgPath) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '10');
      svg.setAttribute('height', '10');
      svg.setAttribute('viewBox', '0 0 16 16');
      svg.classList.add('price-arrow');
      svg.style.display = 'inline-block';
      svg.style.verticalAlign = 'middle';
      svg.style.marginLeft = '4px';
      
      const paths = svgPath.split('M').filter(p => p.trim());
      paths.forEach(pathData => {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M' + pathData);
        path.setAttribute('stroke', '#17D773');
        path.setAttribute('stroke-width', '2.88909');
        path.setAttribute('fill', 'none');
        svg.appendChild(path);
      });
      
      priceCell.appendChild(svg);
    }
    row.appendChild(priceCell);
    
    // Have
    const haveCell = document.createElement('td');
    haveCell.textContent = playerQuantity;
    row.appendChild(haveCell);
    
    // Buy/Sell buttons
    const actionsCell = document.createElement('td');
    actionsCell.classList.add('quantity-controls');
    
    const buyBtn = document.createElement('button');
    buyBtn.textContent = 'BUY';
    buyBtn.disabled = playerState.credits < marketData.currentPrice || playerState.cargoUsed >= playerState.cargoMax;
    buyBtn.addEventListener('click', () => buyCommodity(commodity.id, 1));
    actionsCell.appendChild(buyBtn);
    
    const sellBtn = document.createElement('button');
    sellBtn.textContent = 'SELL';
    sellBtn.disabled = playerQuantity === 0;
    sellBtn.addEventListener('click', () => sellCommodity(commodity.id, 1));
    actionsCell.appendChild(sellBtn);
    
    row.appendChild(actionsCell);
    commodityList.appendChild(row);
  });
  
  // Repair button
  const repairBtn = document.getElementById('repair-btn');
  const repairCost = Math.round((playerState.hullMax - playerState.hull) * 2);
  repairBtn.textContent = `REPAIR HULL (${repairCost}cr)`;
  repairBtn.disabled = playerState.hull >= playerState.hullMax || playerState.credits < repairCost;
  repairBtn.onclick = handleRepair;
  
  // Desperate work button
  const desperateBtn = document.getElementById('desperate-work-btn');
  if (playerState.credits < 50) {
    desperateBtn.style.display = 'block';
  } else {
    desperateBtn.style.display = 'none';
  }
  
  // Render upgrades
  renderUpgrades();
  
  // Render players here
  renderPlayersHere();
}

function renderPlayersHere() {
  const playersHereSection = document.getElementById('players-here-section');
  const playersHereList = document.getElementById('players-here-list');
  
  if (!playerState) {
    playersHereSection.style.display = 'none';
    return;
  }
  
  // Use gameState.players if available, otherwise use allPlayers
  const playersList = (gameState && gameState.players) ? gameState.players : allPlayers;
  
  // Filter out null/undefined and find players at same location (excluding self)
  const playersHere = playersList
    .filter(p => p != null && p.socketId && p.socketId !== playerState.socketId && p.location === playerState.location);
  
  if (playersHere.length === 0) {
    playersHereSection.style.display = 'none';
    return;
  }
  
  playersHereSection.style.display = 'block';
  playersHereList.innerHTML = '';
  
  playersHere.forEach(player => {
    const playerDiv = document.createElement('div');
    playerDiv.style.cssText = 'background: #1a1a1a; padding: 8px; margin: 5px 0; border: 1px solid #333;';
    
    // Player name and bounty
    const nameSpan = document.createElement('span');
    nameSpan.style.cssText = 'font-weight: bold; color: #17D773;';
    nameSpan.textContent = player.name;
    
    if (player.reputation && player.reputation.currentBounty > 0) {
      const bountySpan = document.createElement('span');
      bountySpan.style.cssText = 'color: #FF5A41; margin-left: 8px;';
      bountySpan.textContent = `[BOUNTY: ${player.reputation.currentBounty}cr]`;
      nameSpan.appendChild(bountySpan);
    }
    
    playerDiv.appendChild(nameSpan);
    playerDiv.appendChild(document.createElement('br'));
    
    // Basic info
    const infoSpan = document.createElement('span');
    infoSpan.style.fontSize = '12px';
    infoSpan.textContent = `Hull: ${player.hull}/${player.hullMax} | Cargo: ${player.cargoUsed || 0}/${player.cargoMax}`;
    playerDiv.appendChild(infoSpan);
    playerDiv.appendChild(document.createElement('br'));
    
    // Action buttons
    const btnDiv = document.createElement('div');
    btnDiv.style.marginTop = '5px';
    
    const scanBtn = document.createElement('button');
    scanBtn.textContent = 'SCAN';
    scanBtn.style.fontSize = '10px';
    scanBtn.style.padding = '2px 8px';
    scanBtn.onclick = () => scanPlayer(player.socketId);
    btnDiv.appendChild(scanBtn);
    
    // Always show attack button - no safe zones for PVP
    const attackBtn = document.createElement('button');
    attackBtn.textContent = 'ATTACK';
    attackBtn.style.fontSize = '10px';
    attackBtn.style.padding = '2px 8px';
    attackBtn.style.marginLeft = '5px';
    attackBtn.className = 'warning';
    attackBtn.onclick = () => attackPlayer(player.socketId, player.name);
    btnDiv.appendChild(attackBtn);
    
    playerDiv.appendChild(btnDiv);
    playersHereList.appendChild(playerDiv);
  });
}

function renderUpgrades() {
  const upgradeList = document.getElementById('upgrade-list');
  upgradeList.innerHTML = '';
  
  UPGRADES.forEach(upgrade => {
    const currentTier = playerState.upgrades[upgrade.id] || 0;
    const isMaxTier = currentTier >= upgrade.maxTier;
    const nextTierCost = upgrade.baseCost * Math.pow(upgrade.multiplier, currentTier);
    
    const div = document.createElement('div');
    div.classList.add('upgrade-item');
    if (isMaxTier) div.classList.add('max-tier');
    
    const header = document.createElement('div');
    header.classList.add('upgrade-header');
    
    const name = document.createElement('div');
    name.classList.add('upgrade-name');
    name.innerHTML = `${upgrade.name}<br>(Tier ${currentTier}/${upgrade.maxTier})`;
    header.appendChild(name);
    
    div.appendChild(header);
    
    const description = document.createElement('div');
    description.classList.add('upgrade-description');
    
    // Show cumulative effect based on upgrade type
    if (upgrade.effectType === 'capacity') {
      const totalBonus = currentTier * upgrade.effectPerTier;
      description.textContent = `${upgrade.description}${currentTier > 0 ? ` (current: +${totalBonus} capacity)` : ''}`;
    } else if (upgrade.effectType === 'hull') {
      const totalHull = currentTier * upgrade.effectPerTier;
      description.textContent = `${upgrade.description}${currentTier > 0 ? ` (current: +${totalHull} hull)` : ''}`;
    } else if (upgrade.effectType === 'weapon') {
      const totalBonus = currentTier * upgrade.effectPerTier;
      description.textContent = `${upgrade.description}${currentTier > 0 ? ` (current: +${totalBonus} damage)` : ''}`;
    }
    
    div.appendChild(description);
    
    const button = document.createElement('button');
    button.textContent = isMaxTier ? 'MAX TIER' : `BUY: ${nextTierCost}cr`;
    button.disabled = isMaxTier || playerState.credits < nextTierCost;
    button.addEventListener('click', () => handleBuyUpgrade(upgrade.id));
    div.appendChild(button);
    
    upgradeList.appendChild(div);
  });
}

function renderStatus() {
  if (!playerState || !gameState) return;
  
  document.getElementById('status-username').textContent = playerState.name;
  document.getElementById('status-credits').textContent = playerState.credits;
  document.getElementById('status-hull').textContent = playerState.hull;
  
  const cargoUsed = Object.values(playerState.cargo).reduce((sum, qty) => sum + qty, 0);
  document.getElementById('status-cargo').textContent = cargoUsed;
  document.getElementById('status-cargo-max').textContent = playerState.cargoMax;
  document.getElementById('status-tick').textContent = gameState.tick;
  
  // Show bounty if player has one
  if (playerState.reputation && playerState.reputation.currentBounty > 0) {
    document.getElementById('status-bounty').style.display = 'inline';
    document.getElementById('status-bounty-amount').textContent = playerState.reputation.currentBounty;
  } else {
    document.getElementById('status-bounty').style.display = 'none';
  }
}

function renderLeaderboard() {
  updateLeaderboard();
}

async function updateLeaderboard() {
  const leaderboard = await MP.getLeaderboard();
  const leaderboardList = document.getElementById('leaderboard-list');
  leaderboardList.innerHTML = '';
  
  leaderboard.forEach((entry, index) => {
    const div = document.createElement('div');
    div.classList.add('leaderboard-entry');
    if (entry.name === playerState.name) {
      div.classList.add('self');
    }
    
    const rank = document.createElement('span');
    rank.classList.add('leaderboard-rank');
    rank.textContent = `#${index + 1}`;
    div.appendChild(rank);
    
    const name = document.createElement('span');
    name.classList.add('leaderboard-name');
    name.textContent = entry.name;
    div.appendChild(name);
    
    // Show bounty right after name if they have one
    if (entry.bounty && entry.bounty >= 1000) {
      const bounty = document.createElement('span');
      bounty.style.cssText = 'color: #FF5A41; font-size: 11px; margin-left: 8px;';
      bounty.textContent = `[${entry.bounty}cr]`;
      div.appendChild(bounty);
    }
    
    const worth = document.createElement('span');
    worth.classList.add('leaderboard-credits');
    worth.textContent = `${entry.netWorth}cr`;
    div.appendChild(worth);
    
    leaderboardList.appendChild(div);
  });
  
  // Update player count
  document.getElementById('player-count').textContent = leaderboard.length;
}

function renderActivityFeed() {
  const activityLogContent = document.getElementById('activity-log-content');
  if (!activityLogContent) return;
  
  // Clear existing activity entries (but keep event log entries)
  const existingEntries = Array.from(activityLogContent.children);
  existingEntries.forEach(entry => {
    if (entry.classList.contains('activity-entry')) {
      entry.remove();
    }
  });
  
  // Add activity feed entries at the top
  activities.slice(0, 20).forEach(activity => {
    const div = document.createElement('div');
    div.classList.add('log-entry', 'activity-entry');
    div.classList.add(activity.type);
    div.textContent = `[ACTIVITY] ${activity.message}`;
    activityLogContent.insertBefore(div, activityLogContent.firstChild);
  });
  
  // Keep only last 50 entries total
  while (activityLogContent.children.length > 50) {
    activityLogContent.removeChild(activityLogContent.lastChild);
  }
}

async function updateTickTimer() {
  if (!gameState) return;
  
  try {
    const tickInfo = await MP.getTickInfo();
    const tickTimer = document.getElementById('tick-timer');
    
    const secondsUntilMax = Math.ceil(tickInfo.timeUntilMaxTick / 1000);
    tickTimer.textContent = `${secondsUntilMax}s`;
  } catch (error) {
    console.error('Error updating tick timer:', error);
  }
}

// === ACTIONS ===

async function buyCommodity(commodityId, quantity) {
  try {
    await MP.buyCommodity(commodityId, quantity);
    // Activity feed will show this action
  } catch (error) {
    console.error('Buy error:', error);
    addLog(error.message || String(error) || 'Unknown error', 'danger');
  }
}

async function sellCommodity(commodityId, quantity) {
  try {
    await MP.sellCommodity(commodityId, quantity);
    // Activity feed will show this action
  } catch (error) {
    console.error('Sell error:', error);
    addLog(error.message || String(error) || 'Unknown error', 'danger');
  }
}

async function attemptTravel(destination) {
  try {
    const result = await MP.travel(destination);
    // Activity feed will show successful travel
    // Combat/inspection will show their own modals
    if (result.pirateEncounter || result.inspection) {
      // Modal will be shown
    } else {
      renderMap(); // Update player location on map
      renderPlayersHere(); // Update list of players at new location
    }
  } catch (error) {
    console.error('Travel error:', error);
    addLog(error.message || String(error) || 'Unknown error', 'danger');
  }
}

async function handleBuyUpgrade(upgradeId) {
  try {
    await MP.buyUpgrade(upgradeId);
    addLog(`Purchased ${upgradeId} upgrade`);
  } catch (error) {
    addLog(error.message, 'danger');
  }
}

async function handleRepair() {
  try {
    await MP.repairHull();
    addLog('Hull repaired');
  } catch (error) {
    addLog(error.message, 'danger');
  }
}

async function handleDesperateWork() {
  try {
    const result = await MP.doDesperateWork();
    addLog(result.message, 'warning');
  } catch (error) {
    addLog(error.message, 'danger');
  }
}

// === MODALS (Simplified versions - full implementation needed) ===

function showCombatModal(combat) {
  const isCop = combat.enemyType === 'cop';
  const isPvp = combat.enemyType === 'player';
  const enemyName = isCop ? combat.copTypeName : (isPvp ? combat.opponentName : combat.pirateName);
  const enemyHull = isCop ? combat.copHull : (isPvp ? combat.opponentHull : combat.pirateHull);
  const enemyDescription = isCop ? combat.copFlavorText : (isPvp ? `PVP COMBAT` : combat.pirateFlavorText);
  
  addLog(`Combat with ${enemyName}!`, 'danger');
  
  const modal = document.getElementById('combat-modal');
  const overlay = document.getElementById('modal-overlay');
  const title = document.getElementById('combat-title');
  const description = document.getElementById('combat-description');
  const playerHullSpan = document.getElementById('combat-player-hull');
  const pirateHullSpan = document.getElementById('combat-pirate-hull');
  const enemyLabelSpan = document.getElementById('combat-enemy-label');
  const combatLog = document.getElementById('combat-log');
  const combatActions = document.getElementById('combat-actions');
  const combatContinue = document.getElementById('combat-continue-section');
  const lootSection = document.getElementById('combat-loot');
  
  // Set up initial display
  if (isPvp) {
    enemyLabelSpan.textContent = enemyName.toUpperCase();
    if (combat.isDefender) {
      title.textContent = `UNDER ATTACK: ${enemyName}`;
      description.textContent = `${enemyName} is attacking you!`;
    } else {
      title.textContent = `ATTACKING: ${enemyName}`;
      description.textContent = `You're attacking ${enemyName}`;
    }
  } else if (isCop) {
    enemyLabelSpan.textContent = 'COP';
    title.textContent = `COP ENCOUNTER: ${enemyName}`;
    description.textContent = `${enemyDescription}`;
  } else {
    enemyLabelSpan.textContent = 'PIRATE';
    title.textContent = `PIRATE ENCOUNTER: ${enemyName}`;
    description.textContent = `${enemyDescription}`;
  }
  
  playerHullSpan.textContent = playerState.hull;
  pirateHullSpan.textContent = enemyHull;
  combatLog.innerHTML = combat.combatLog.join('\n');
  
  // Show action buttons, hide continue/loot
  combatActions.style.display = 'flex';
  combatContinue.style.display = 'none';
  lootSection.style.display = 'none';
  
  // Set up event handlers
  document.getElementById('combat-attack').onclick = () => handleCombatAction('attack');
  document.getElementById('combat-defend').onclick = () => handleCombatAction('defend');
  document.getElementById('combat-bribe').onclick = () => handleCombatAction('bribe');
  document.getElementById('combat-flee').onclick = () => handleCombatAction('flee');
  
  // Show/hide bribe button (only for NPCs, not PVP)
  const bribeBtn = document.getElementById('combat-bribe');
  if (isPvp) {
    bribeBtn.style.display = 'none';
  } else {
    bribeBtn.style.display = 'inline-block';
  }
  
  // Show/hide surrender button based on enemy type (only for cops, not PVP)
  const surrenderBtn = document.getElementById('combat-surrender');
  if (isCop && !isPvp) {
    surrenderBtn.style.display = 'inline-block';
    surrenderBtn.onclick = () => handleCombatAction('surrender');
  } else {
    surrenderBtn.style.display = 'none';
  }
  
  // Show modal
  overlay.style.display = 'block';
  modal.style.display = 'block';
}

function showInspectionModal(inspectionState) {
  addLog('Customs inspection!', 'warning');
  
  const modal = document.getElementById('inspection-modal');
  const overlay = document.getElementById('modal-overlay');
  const description = document.getElementById('inspection-description');
  const fineCost = document.getElementById('fine-cost');
  
  description.textContent = `Contraband detected! Value: ${inspectionState.contrabandValue}cr`;
  fineCost.textContent = inspectionState.fine;
  
  // Set up event handlers
  document.getElementById('inspection-pay').onclick = () => handleInspectionAction('pay');
  document.getElementById('inspection-dump').onclick = () => handleInspectionAction('dump');
  document.getElementById('inspection-resist').onclick = () => handleInspectionAction('resist');
  
  // Show modal
  overlay.style.display = 'block';
  modal.style.display = 'block';
}

function showDeathModal() {
  addLog('Your ship was destroyed!', 'danger');
  
  const modal = document.getElementById('death-modal');
  const overlay = document.getElementById('modal-overlay');
  const stats = document.getElementById('death-stats');
  const respawnCost = document.getElementById('respawn-cost');
  
  stats.textContent = `Net worth: ${playerState.credits}cr`;
  respawnCost.textContent = CONSTANTS.RESPAWN_SHIP_COST;
  
  // Set up event handlers
  document.getElementById('death-respawn').onclick = handleRespawn;
  document.getElementById('death-gameover').onclick = () => {
    window.location.reload();
  };
  
  // Show modal
  overlay.style.display = 'block';
  modal.style.display = 'block';
}

// === COMBAT HANDLERS ===

async function handleCombatAction(action) {
  try {
    const result = await MP.combatAction(action);
    playerState = result.playerState;  // Sync global playerState with fresh data
    
    // Check if we're waiting for opponent in PVP
    if (result.waiting) {
      showWaitingForOpponent();
      return;
    }
    
    updateCombatDisplay(result.combatState);
    renderStatus();  // Update main status bar (hull percentage, etc.)
    
    if (result.isDead) {
      handleDeath();
    }
  } catch (error) {
    console.error('Combat action error:', error);
    addLog(error.message, 'danger');
  }
}

function updateCombatDisplay(combat) {
  const isCop = combat.enemyType === 'cop';
  const isPvp = combat.enemyType === 'player';
  const enemyHull = isCop ? combat.copHull : (isPvp ? combat.opponentHull : combat.pirateHull);
  
  const playerHullSpan = document.getElementById('combat-player-hull');
  const pirateHullSpan = document.getElementById('combat-pirate-hull');
  const combatLog = document.getElementById('combat-log');
  const combatActions = document.getElementById('combat-actions');
  const combatContinue = document.getElementById('combat-continue-section');
  const lootSection = document.getElementById('combat-loot');
  
  // Update hulls
  playerHullSpan.textContent = playerState.hull;
  pirateHullSpan.textContent = enemyHull;
  
  // Update combat log
  combatLog.innerHTML = combat.combatLog.join('\n');
  combatLog.scrollTop = combatLog.scrollHeight;
  
  // Check if combat is resolved
  if (combat.resolved) {
    combatActions.style.display = 'none';
    
    // PVP victory - special handling
    if (isPvp && combat.outcome === 'victory') {
      combatContinue.style.display = 'flex';
      document.getElementById('combat-continue').onclick = () => {
        closeCombatModal();
        addLog('PVP victory! Check activity log for loot details.', 'success');
      };
    } else if (combat.outcome === 'victory' && combat.pendingLoot) {
      // NPC loot options
      const lootDesc = document.getElementById('loot-description');
      lootDesc.textContent = `Found: ${combat.pendingLoot.amount}x ${combat.pendingLoot.commodityName}`;
      lootSection.style.display = 'block';
      
      document.getElementById('loot-take').onclick = async () => {
        try {
          const result = await MP.acceptLoot();
          playerState = result.playerState;  // Sync global playerState
          closeCombatModal();
          addLog(`Collected ${combat.pendingLoot.amount}x ${combat.pendingLoot.commodityName}`, 'success');
        } catch (error) {
          addLog(error.message, 'danger');
        }
      };
      
      document.getElementById('loot-leave').onclick = () => {
        closeCombatModal();
        addLog('Left the salvage behind', 'info');
      };
    } else {
      // Show continue button for other outcomes
      combatContinue.style.display = 'flex';
      document.getElementById('combat-continue').onclick = () => {
        closeCombatModal();
      };
    }
  }
}

function closeCombatModal() {
  document.getElementById('combat-modal').style.display = 'none';
  document.getElementById('modal-overlay').style.display = 'none';
  
  // Update map and status to reflect final state after combat
  renderMap();
  renderStatus();
}

// === INSPECTION HANDLERS ===

async function handleInspectionAction(action) {
  try {
    const result = await MP.inspectionAction(action);
    closeInspectionModal();
    addLog(result.message, action === 'resist' && result.outcome === 'failure' ? 'danger' : 'warning');
  } catch (error) {
    console.error('Inspection action error:', error);
    addLog(error.message, 'danger');
  }
}

function closeInspectionModal() {
  document.getElementById('inspection-modal').style.display = 'none';
  document.getElementById('modal-overlay').style.display = 'none';
}

// === DEATH/RESPAWN HANDLERS ===

async function handleRespawn() {
  try {
    const result = await MP.respawn();
    closeDeathModal();
    addLog(`Respawned at ${result.respawnLocation}`, 'warning');
  } catch (error) {
    addLog(error.message, 'danger');
  }
}

function closeDeathModal() {
  document.getElementById('death-modal').style.display = 'none';
  document.getElementById('modal-overlay').style.display = 'none';
}

// === PVP HANDLERS ===

async function scanPlayer(targetSocketId) {
  try {
    const result = await MP.scanPlayer(targetSocketId);
    const target = result.targetInfo;
    
    const msg = `SCAN: ${target.name} | Hull: ${target.hull}/${target.hullMax} | Cargo: ${target.cargoUsed}/${target.cargoMax} (${Math.round(target.cargoValue)}cr) | Bounty: ${target.reputation.currentBounty}cr`;
    addLog(msg, 'info');
  } catch (error) {
    addLog(error.message, 'danger');
  }
}

async function attackPlayer(targetSocketId, targetName) {
  if (!confirm(`Attack ${targetName}? This will initiate PVP combat!`)) {
    return;
  }
  
  try {
    const result = await MP.attackPlayer(targetSocketId);
    addLog(`Attacking ${targetName}!`, 'warning');
    
    // Combat modal will be shown by handleCombatEncounter
  } catch (error) {
    addLog(error.message, 'danger');
  }
}

function showWaitingForOpponent() {
  const combatActions = document.getElementById('combat-actions');
  const combatLog = document.getElementById('combat-log');
  
  // Disable combat buttons
  combatActions.style.display = 'none';
  
  // Add waiting message to combat log
  const waitingMsg = document.createElement('div');
  waitingMsg.id = 'waiting-message';
  waitingMsg.style.color = '#ffcc00';
  waitingMsg.style.fontStyle = 'italic';
  waitingMsg.style.marginTop = '10px';
  waitingMsg.textContent = 'Waiting for opponent to choose their action...';
  combatLog.appendChild(waitingMsg);
}

function handleOpponentReady(data) {
  // Opponent chose their action but we're still waiting for resolution
  const waitingMsg = document.getElementById('waiting-message');
  if (waitingMsg) {
    waitingMsg.textContent = `${data.opponentName} is ready! Resolving combat...`;
  }
}

function handleCombatRoundResolved(data) {
  // Remove waiting message
  const waitingMsg = document.getElementById('waiting-message');
  if (waitingMsg) {
    waitingMsg.remove();
  }
  
  // Update display with new combat state
  playerState = data.playerState;
  updateCombatDisplay(data.combatState);
  renderStatus();
  
  // Re-enable combat actions if combat isn't resolved
  if (!data.combatState.resolved) {
    document.getElementById('combat-actions').style.display = 'flex';
  }
}

function handleCombatResolved(data) {
  // Remove waiting message
  const waitingMsg = document.getElementById('waiting-message');
  if (waitingMsg) {
    waitingMsg.remove();
  }
  
  // Update display with final combat state
  playerState = data.playerState;
  updateCombatDisplay(data.combatState);
  renderStatus();
  
  if (data.isDead) {
    handleDeath();
  }
}

function handlePvpDefeated(data) {
  // Update combat state if provided
  if (data.combatState) {
    updateCombatDisplay(data.combatState);
  }
  
  // Close combat modal and show defeat message
  setTimeout(() => {
    closeCombatModal();
    addLog(`Defeated by ${data.attacker}! Lost ${data.lostCredits}cr and cargo.`, 'danger');
  }, 2000);
}

function handlePvpVictory(data) {
  // Update combat state if provided
  if (data.combatState) {
    updateCombatDisplay(data.combatState);
  }
  
  // Close combat modal and show victory message
  setTimeout(() => {
    closeCombatModal();
    const bountyMsg = data.bountyReward > 0 ? ` and claimed ${data.bountyReward}cr bounty` : '';
    addLog(`Successfully defended against attacker${bountyMsg}!`, 'success');
  }, 2000);
}

function handlePvpEscaped(data) {
  // Update combat state if provided
  if (data.combatState) {
    updateCombatDisplay(data.combatState);
  }
  
  // Close combat modal and show escape message
  setTimeout(() => {
    closeCombatModal();
    addLog(`${data.escapee} escaped from combat.`, 'info');
  }, 2000);
}

// === EVENT LOG ===

function addLog(message, type = 'success') {
  const logContent = document.getElementById('activity-log-content');
  if (!logContent) return;
  
  const entry = document.createElement('div');
  entry.classList.add('log-entry');
  if (type) entry.classList.add(type);
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  
  logContent.insertBefore(entry, logContent.firstChild);
  
  // Keep only last 50 entries
  while (logContent.children.length > 50) {
    logContent.removeChild(logContent.lastChild);
  }
}

// Make handleDesperateWork global for onclick
window.handleDesperateWork = handleDesperateWork;

// Debug function to clear stuck combat state
window.clearStuckCombat = async function() {
  try {
    const result = await MP.clearCombat();
    addLog(result.message, 'success');
    console.log('Combat state cleared');
  } catch (error) {
    addLog(error.message, 'danger');
    console.error('Clear combat error:', error);
  }
};
