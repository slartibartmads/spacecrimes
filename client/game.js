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
let lastCombatLogLength = 0; // Track combat messages already shown
let previousLocation = null; // Track previous location for animation
let isAnimating = false; // Track if marker is currently animating

// === HELPER FUNCTIONS ===

function getStationName(stationId) {
  const station = STATIONS.find(s => s.id === stationId);
  return station ? station.name : stationId;
}

function calculateCargoValue() {
  if (!playerState || !gameState || !gameState.markets) return 0;
  
  let total = 0;
  const currentMarket = gameState.markets[playerState.location];
  if (!currentMarket) return 0;
  
  Object.keys(playerState.cargo).forEach(commodityId => {
    const quantity = playerState.cargo[commodityId];
    const marketData = currentMarket[commodityId];
    if (marketData) {
      total += quantity * marketData.currentPrice;
    }
  });
  
  return total;
}

function calculateTollFee(route) {
  const baseToll = route.tollFee || 0;
  if (baseToll === 0) return 0;
  
  const cargoValue = calculateCargoValue();
  const cargoFee = Math.floor(cargoValue * CONSTANTS.TOLL_CARGO_PERCENTAGE);
  
  return baseToll + cargoFee;
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
  
  // Initialize debug panel
  initializeDebugPanel();
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
  
  // Update page title with player name
  document.title = `${player.name} - SPACECRIMES`;
  
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
  // Track location change for animation
  const locationChanged = playerState && playerState.location !== player.location;
  if (locationChanged) {
    previousLocation = playerState.location;
    console.log('Location changed from', previousLocation, 'to', player.location);
  }
  
  playerState = player;
  renderStatus();
  renderStation();
  renderMap(locationChanged); // Pass flag to trigger animation
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
  
  // Also update gameState.players if it exists (to keep it in sync)
  if (gameState && gameState.players) {
    const gsIndex = gameState.players.findIndex(p => p && p.socketId === data.socketId);
    if (gsIndex !== -1) {
      gameState.players[gsIndex] = data.player;
    } else {
      gameState.players.push(data.player);
    }
    gameState.players = gameState.players.filter(p => p != null);
  }
  
  // Re-render map to show updated positions
  renderMap();
  
  // Re-render players here list in case they moved to/from our station
  renderPlayersHere();
}

function handleTick(data) {
  gameState.tick = data.tick;
  gameState.markets = data.markets;
  gameState.activeEvents = data.activeEvents;
  
  // Show event modal for new events
  if (data.newEvent) {
    showEventModal(data.newEvent);
    addLog(`MARKET EVENT: ${data.newEvent.message}`, 'warning');
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

function showEventModal(eventData) {
  const modal = document.getElementById('event-modal');
  const overlay = document.getElementById('modal-overlay');
  const title = document.getElementById('event-title');
  const description = document.getElementById('event-description');
  const details = document.getElementById('event-details');
  
  // Set title based on event type
  const titleMap = {
    'surge': 'DEMAND SURGE',
    'shortage': 'SUPPLY SHORTAGE',
    'glut': 'SUPPLY GLUT',
    'commodity_reroll': 'MARKET SHIFT',
    'spike': 'PRICE SPIKE',
    'drop': 'PRICE DROP',
    'boom': 'STATION BOOM',
    'recession': 'STATION RECESSION',
    'crackdown': 'SECURITY ALERT',
    'safe_passage': 'ALL CLEAR'
  };
  
  title.textContent = titleMap[eventData.type] || 'MARKET EVENT';
  
  // Special handling for commodity reroll - show commodities inline
  if (eventData.type === 'commodity_reroll' && eventData.newCommodities) {
    const commoditiesList = eventData.newCommodities.map(c => `<strong>${c}</strong>`).join('<br>');
    description.innerHTML = `New commodities available at <strong>${eventData.stationName}</strong>:<br>${commoditiesList}`;
    details.innerHTML = '';
  } else {
    description.innerHTML = eventData.message;
    details.innerHTML = '';
  }
  
  // Show modal
  modal.classList.add('active');
  overlay.classList.add('active');
  
  // Set up acknowledge button
  const acknowledgeBtn = document.getElementById('event-acknowledge');
  acknowledgeBtn.onclick = () => {
    modal.classList.remove('active');
    overlay.classList.remove('active');
  };
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

function renderMap(animateTravel = false) {
  if (!playerState) return; // Safety check
  
  console.log('renderMap called, animateTravel:', animateTravel, 'previousLocation:', previousLocation, 'isAnimating:', isAnimating);
  
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
    line.setAttribute('stroke', isToll ? '#FF5A41' : '#17D773');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('opacity', isToll ? '0.25' : '0.3');
    routesLayer.appendChild(line);
    
    // Add toll fee label
    if (isToll) {
      const midX = (from.position.x + to.position.x) / 2;
      const midY = (from.position.y + to.position.y) / 2;
      
      const actualToll = calculateTollFee(route);
      
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', midX);
      label.setAttribute('y', midY);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('fill', '#FF5A41');
      label.setAttribute('font-size', '10');
      label.setAttribute('font-weight', '900');
      label.setAttribute('font-family', 'Source Code Pro, monospace');
      label.textContent = `${actualToll}cr`;
      routesLayer.appendChild(label);
    }
  });
  
  // Station icon mapping
  const stationIcons = {
    'fort_attrition': 'img/icon_fort.svg',
    'caveat_emptor': 'img/icon_caveat.svg',
    'vice_berth': 'img/icon_vice.svg',
    'disruptive_smelting': 'img/icon_disruptive.svg',
    'nuevo_eden': 'img/icon_nuevo_eden.svg',
    'makinen_tanaka': 'img/icon_institute.svg'
  };
  
  // Draw stations
  STATIONS.forEach(station => {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'station');
    group.style.cursor = 'pointer';
    
    const isMajor = station.type === 'military' || station.type === 'trading' || 
                    station.type === 'entertainment' || station.type === 'industrial' || 
                    station.type === 'agricultural' || station.type === 'research';
    const size = isMajor ? 17 : 10; // Major: 34px diameter, Minor: 20px diameter
    
    // Render icon for major stations, hexagon for minor stations
    if (isMajor && stationIcons[station.id]) {
      // Major station: use icon (which includes hexagon background)
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'image');
      icon.setAttributeNS('http://www.w3.org/1999/xlink', 'href', stationIcons[station.id]);
      icon.setAttribute('width', '35');
      icon.setAttribute('height', '35');
      icon.setAttribute('x', station.position.x - 17.5);
      icon.setAttribute('y', station.position.y - 17.5);
      group.appendChild(icon);
    } else {
      // Minor station: use hexagon
      const hexagon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      const points = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6; // Flat-top hexagon
        const x = station.position.x + size * Math.cos(angle);
        const y = station.position.y + size * Math.sin(angle);
        points.push(`${x},${y}`);
      }
      hexagon.setAttribute('points', points.join(' '));
      hexagon.setAttribute('fill', '#105626');
      hexagon.setAttribute('stroke', '#17D773');
      hexagon.setAttribute('stroke-width', '2.4');
      group.appendChild(hexagon);
    }
    
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', station.position.x);
    text.setAttribute('y', station.position.y + size + (isMajor ? 14 : 12));
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', isMajor ? '#F2FFC5' : '#17D773');
    text.setAttribute('font-size', isMajor ? '10' : '9');
    text.setAttribute('font-weight', '900');
    text.setAttribute('font-family', 'Source Code Pro, monospace');
    text.setAttribute('text-transform', 'uppercase');
    
    // Split station name into lines if needed (for major stations)
    if (isMajor && station.name.includes(' ')) {
      const words = station.name.toUpperCase().split(' ');
      const tspan1 = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
      tspan1.setAttribute('x', station.position.x);
      tspan1.setAttribute('dy', '0');
      tspan1.textContent = words[0];
      text.appendChild(tspan1);
      
      const tspan2 = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
      tspan2.setAttribute('x', station.position.x);
      tspan2.setAttribute('dy', '10');
      tspan2.textContent = words.slice(1).join(' ');
      text.appendChild(tspan2);
    } else {
      text.textContent = station.name.toUpperCase();
    }
    
    group.appendChild(text);
    
    // Add location marker if this is the current location (after text so it renders on top)
    if (station.id === playerState.location) {
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'image');
      marker.setAttributeNS('http://www.w3.org/1999/xlink', 'href', 'img/player_marker.svg');
      marker.setAttribute('width', '32');
      marker.setAttribute('height', '32');
      marker.setAttribute('id', 'player-marker'); // Add ID for animation
      
      // If we should animate and we have a previous location, animate the transition
      if (animateTravel && previousLocation && !isAnimating) {
        const fromStation = STATIONS.find(s => s.id === previousLocation);
        const toStation = station;
        
        console.log('Attempting animation from', fromStation?.name, 'to', toStation?.name);
        
        if (fromStation) {
          isAnimating = true;
          
          // Start at previous position
          const startX = fromStation.position.x - 16;
          const startY = fromStation.position.y - 16;
          const endX = toStation.position.x - 16;
          const endY = toStation.position.y - 16;
          
          marker.setAttribute('x', startX);
          marker.setAttribute('y', startY);
          
          // Animate using requestAnimationFrame
          const duration = 800; // 0.8 seconds
          const startTime = performance.now();
          
          function animate(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease-in-out)
            const eased = progress < 0.5 
              ? 2 * progress * progress 
              : 1 - Math.pow(-2 * progress + 2, 2) / 2;
            
            const currentX = startX + (endX - startX) * eased;
            const currentY = startY + (endY - startY) * eased;
            
            marker.setAttribute('x', currentX);
            marker.setAttribute('y', currentY);
            
            if (progress < 1) {
              requestAnimationFrame(animate);
            } else {
              isAnimating = false;
              previousLocation = null;
            }
          }
          
          requestAnimationFrame(animate);
        } else {
          // No previous station found, just position normally
          marker.setAttribute('x', station.position.x - 16);
          marker.setAttribute('y', station.position.y - 16);
        }
      } else {
        // No animation needed, position normally
        marker.setAttribute('x', station.position.x - 16);
        marker.setAttribute('y', station.position.y - 16);
      }
      
      group.appendChild(marker);
    }
    
    // Click to travel
    group.addEventListener('click', () => {
      if (station.id !== playerState.location) {
        attemptTravel(station.id);
      }
    });
    
    stationsLayer.appendChild(group);
  });
  
  // Draw other players (ship markers in grid)
  const validPlayers = allPlayers.filter(p => p != null && p.socketId);
  
  // Group players by station, excluding self
  const playersByStation = {};
  validPlayers.forEach(player => {
    if (!playerState || player.socketId === playerState.socketId) return; // Skip self
    if (!playersByStation[player.location]) {
      playersByStation[player.location] = [];
    }
    playersByStation[player.location].push(player);
  });
  
  // Render player grids for each station
  Object.keys(playersByStation).forEach(stationId => {
    const players = playersByStation[stationId];
    const station = STATIONS.find(s => s.id === stationId);
    if (!station) return;
    
    // Sort: bounties first, then others
    players.sort((a, b) => {
      const aBounty = (a.reputation?.currentBounty || 0) > 0;
      const bBounty = (b.reputation?.currentBounty || 0) > 0;
      if (aBounty && !bBounty) return -1;
      if (!aBounty && bBounty) return 1;
      return 0;
    });
    
    // Grid layout constants
    const SHIP_SIZE = 7;
    const SPACING = 0;
    const SHIPS_PER_ROW = 4;
    
    // Determine station type and offset
    const isMajor = station.type === 'military' || station.type === 'trading' || 
                    station.type === 'entertainment' || station.type === 'industrial' || 
                    station.type === 'agricultural' || station.type === 'research';
    const GRID_OFFSET_Y = isMajor ? 20 : 15; // Distance above station
    
    // Calculate grid dimensions
    const numRows = Math.ceil(players.length / SHIPS_PER_ROW);
    const numCols = Math.min(players.length, SHIPS_PER_ROW);
    const gridWidth = (numCols * SHIP_SIZE) + ((numCols - 1) * SPACING);
    const gridHeight = (numRows * SHIP_SIZE) + ((numRows - 1) * SPACING);
    
    // Starting position (centered above station)
    const startX = station.position.x - (gridWidth / 2);
    const startY = station.position.y - GRID_OFFSET_Y - gridHeight;
    
    // Place each ship in grid
    players.forEach((player, index) => {
      const row = Math.floor(index / SHIPS_PER_ROW);
      const col = index % SHIPS_PER_ROW;
      
      // Calculate how many ships are in this row
      const shipsInThisRow = (row === numRows - 1) 
        ? players.length - (row * SHIPS_PER_ROW) 
        : SHIPS_PER_ROW;
      
      // Center this row if it has fewer than SHIPS_PER_ROW
      const rowWidth = (shipsInThisRow * SHIP_SIZE) + ((shipsInThisRow - 1) * SPACING);
      const rowStartX = station.position.x - (rowWidth / 2);
      
      const shipX = rowStartX + (col * (SHIP_SIZE + SPACING));
      const shipY = startY + (row * (SHIP_SIZE + SPACING));
      
      const hasBounty = (player.reputation?.currentBounty || 0) > 0;
      
      // Create SVG image element for ship
      const ship = document.createElementNS('http://www.w3.org/2000/svg', 'image');
      ship.setAttributeNS('http://www.w3.org/1999/xlink', 'href', hasBounty ? 'img/player_ship_red.svg' : 'img/player_ship_yellow.svg');
      ship.setAttribute('x', shipX);
      ship.setAttribute('y', shipY);
      ship.setAttribute('width', SHIP_SIZE);
      ship.setAttribute('height', SHIP_SIZE);
      ship.setAttribute('class', 'player-ship');
      
      playersLayer.appendChild(ship);
    });
  });
}

function renderStation() {
  if (!playerState || !gameState) return;
  
  const station = STATIONS.find(s => s.id === playerState.location);
  if (!station) return;
  
  // Station icon mapping (same as in renderMap)
  const stationIcons = {
    'fort_attrition': 'img/icon_fort.svg',
    'caveat_emptor': 'img/icon_caveat.svg',
    'vice_berth': 'img/icon_vice.svg',
    'disruptive_smelting': 'img/icon_disruptive.svg',
    'nuevo_eden': 'img/icon_nuevo_eden.svg',
    'makinen_tanaka': 'img/icon_institute.svg'
  };
  
  // Update station header icon
  const iconContainer = document.getElementById('station-icon-container');
  const isMajor = station.type === 'military' || station.type === 'trading' || 
                  station.type === 'entertainment' || station.type === 'industrial' || 
                  station.type === 'agricultural' || station.type === 'research';
  
  iconContainer.innerHTML = ''; // Clear existing content
  
  if (isMajor && stationIcons[station.id]) {
    // Major station: use icon image
    const img = document.createElement('img');
    img.src = stationIcons[station.id];
    img.alt = station.name;
    iconContainer.appendChild(img);
  } else {
    // Minor station: create hexagon with initials
    const initials = station.name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2); // Max 2 characters
    
    // Create SVG hexagon
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '80');
    svg.setAttribute('height', '80');
    svg.setAttribute('viewBox', '0 0 80 80');
    
    // Create hexagon polygon (flat-top orientation)
    const hexagon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    const centerX = 40;
    const centerY = 40;
    const radius = 35;
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      points.push(`${x},${y}`);
    }
    hexagon.setAttribute('points', points.join(' '));
    hexagon.setAttribute('fill', '#105626');
    hexagon.setAttribute('stroke', '#17D773');
    hexagon.setAttribute('stroke-width', '5.7');
    
    // Create text for initials
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', '40');
    text.setAttribute('y', '43');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('fill', '#17D773');
    text.setAttribute('font-family', 'Source Code Pro, monospace');
    text.setAttribute('font-weight', '900');
    text.setAttribute('font-size', '25');
    text.textContent = initials;
    
    svg.appendChild(hexagon);
    svg.appendChild(text);
    iconContainer.appendChild(svg);
  }
  
  document.getElementById('station-name').textContent = station.name;
  document.getElementById('station-description').textContent = station.description;
  
  // Render commodities
  const commodityList = document.getElementById('commodity-list');
  commodityList.innerHTML = '';
  
  // Commodity icon mapping
  const commodityIcons = {
    'croakers': 'img/icon_cigs.svg',
    'booze': 'img/icon_swill.svg',
    'cognex': 'img/icon_stims.svg',
    'credentials': 'img/icon_cores.svg',
    'weapons': 'img/icon_atrocities.svg',
    'crank': 'img/icon_meth.svg',
    'organs': 'img/icon_organs.svg',
    'ai_chips': 'img/icon_ai_chips.svg'
  };
  
  COMMODITIES.forEach(commodity => {
    // Skip if commodity not available at this station
    const marketData = gameState.markets[station.id]?.[commodity.id];
    if (!marketData) {
      return;
    }
    
    const playerQuantity = playerState.cargo[commodity.id] || 0;
    
    const row = document.createElement('tr');
    
    // Name with icon
    const nameCell = document.createElement('td');
    
    // Add icon if available
    if (commodityIcons[commodity.id]) {
      const icon = document.createElement('img');
      icon.src = commodityIcons[commodity.id];
      icon.alt = commodity.name;
      icon.title = commodity.description; // Tooltip with flavor text
      icon.classList.add('commodity-icon');
      nameCell.appendChild(icon);
    }
    
    // Add commodity name text
    const nameText = document.createTextNode(commodity.name);
    nameCell.appendChild(nameText);
    
    row.appendChild(nameCell);
    
    // Price with arrow indicator
    const priceCell = document.createElement('td');
    
    // Calculate price difference from base
    const priceDiff = marketData.currentPrice - commodity.basePrice;
    const pricePercent = Math.round((priceDiff / commodity.basePrice) * 100);
    
    // Determine price indicators with SVG icons
    let svgPath = null;
    let arrowColor = '#17D773'; // Default green
    
    if (pricePercent < -15) {
      svgPath = 'M13.7782 7.22182L7.99998 13L2.2218 7.22182M13.7782 1.44365L7.99998 7.22182L2.2218 1.44365'; // lowest
      arrowColor = '#17D773'; // Green for down arrows
    } else if (pricePercent < -5) {
      svgPath = 'M2.22185 5.22182L8.00002 11L13.7782 5.22182'; // low
      arrowColor = '#17D773'; // Green for down arrows
    } else if (pricePercent > 15) {
      svgPath = 'M13.7782 8.77818L7.99998 3L2.2218 8.77818M13.7782 14.5564L7.99998 8.77818L2.2218 14.5564'; // highest
      arrowColor = '#FF5A41'; // Red for up arrows
    } else if (pricePercent > 5) {
      svgPath = 'M13.7782 10.7782L7.99998 5L2.2218 10.7782'; // high
      arrowColor = '#FF5A41'; // Red for up arrows
    }
    
    // Create wrapper for price text
    const priceWrapper = document.createElement('span');
    priceWrapper.textContent = `${marketData.currentPrice}cr`;
    priceCell.appendChild(priceWrapper);
    
    if (svgPath) {
      const arrowWrapper = document.createElement('span');
      arrowWrapper.style.float = 'right';
      arrowWrapper.style.lineHeight = '1';
      arrowWrapper.style.marginTop = '3px';
      
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '10');
      svg.setAttribute('height', '10');
      svg.setAttribute('viewBox', '0 0 16 16');
      svg.classList.add('price-arrow');
      svg.style.display = 'block';
      
      const paths = svgPath.split('M').filter(p => p.trim());
      paths.forEach(pathData => {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M' + pathData);
        path.setAttribute('stroke', arrowColor);
        path.setAttribute('stroke-width', '2.88909');
        path.setAttribute('fill', 'none');
        svg.appendChild(path);
      });
      
      arrowWrapper.appendChild(svg);
      priceCell.appendChild(arrowWrapper);
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
  repairBtn.textContent = `REPAIR SHIELDS (${repairCost}cr)`;
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
    playerDiv.style.cssText = 'background: rgba(23, 215, 115, 0.05); padding: 8px; margin: 5px 0; border: 1px solid rgba(23, 215, 115, 0.3); display: flex; justify-content: space-between; align-items: center;';
    
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
    
    // Always show attack button - no safe zones for PVP
    const attackBtn = document.createElement('button');
    attackBtn.textContent = 'ATTACK';
    attackBtn.style.fontSize = '10px';
    attackBtn.style.padding = '2px 8px';
    attackBtn.className = 'warning';
    attackBtn.onclick = () => attackPlayer(player.socketId, player.name);
    playerDiv.appendChild(attackBtn);
    
    playersHereList.appendChild(playerDiv);
  });
}

function renderUpgrades() {
  const upgradeList = document.getElementById('upgrade-list');
  upgradeList.innerHTML = '';
  
  // Icon mapping for upgrades
  const upgradeIcons = {
    'cargo': 'img/icon_cargo.svg',
    'shields': 'img/icon_shields.svg',
    'weapon': 'img/icon_weapons.svg'
  };
  
  UPGRADES.forEach(upgrade => {
    const currentTier = playerState.upgrades[upgrade.id] || 0;
    const isMaxTier = currentTier >= upgrade.maxTier;
    const nextTierCost = upgrade.baseCost * Math.pow(upgrade.multiplier, currentTier);
    
    const div = document.createElement('div');
    div.classList.add('upgrade-item');
    if (isMaxTier) div.classList.add('max-tier');
    
    // Icon
    if (upgradeIcons[upgrade.id]) {
      const icon = document.createElement('img');
      icon.src = upgradeIcons[upgrade.id];
      icon.alt = upgrade.name;
      icon.classList.add('upgrade-icon');
      div.appendChild(icon);
    }
    
    // Tier label
    const tier = document.createElement('div');
    tier.classList.add('upgrade-tier');
    tier.textContent = `TIER ${currentTier} OF ${upgrade.maxTier}`;
    div.appendChild(tier);
    
    // Title
    const name = document.createElement('div');
    name.classList.add('upgrade-name');
    name.textContent = upgrade.name;
    div.appendChild(name);
    
    // Description
    const description = document.createElement('div');
    description.classList.add('upgrade-description');
    description.textContent = upgrade.description;
    div.appendChild(description);
    
    // Button
    const button = document.createElement('button');
    button.textContent = isMaxTier ? 'MAX TIER' : `BUY (${nextTierCost}cr)`;
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
  
  // Calculate damage (base 25-40 + weapon upgrades * 5)
  const weaponTier = playerState.upgrades.weapon || 0;
  const baseDamageMin = CONSTANTS.ATTACK_DAMAGE_MIN;
  const baseDamageMax = CONSTANTS.ATTACK_DAMAGE_MAX;
  const weaponBonus = weaponTier * 5;
  const damageMin = baseDamageMin + weaponBonus;
  const damageMax = baseDamageMax + weaponBonus;
  document.getElementById('status-damage').textContent = `${damageMin}-${damageMax}`;
  
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
  
  // Add activity feed entries at the top (already in newest-first order from server)
  // Reverse the iteration so newest ends up at top after all insertBefore calls
  activities.slice(0, 20).reverse().forEach(activity => {
    const div = document.createElement('div');
    div.classList.add('log-entry', 'activity-entry');
    div.classList.add(activity.type);
    div.innerHTML = `[ACTIVITY] ${activity.message}`;
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
    addLog('Shields repaired');
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
  const encounterType = document.getElementById('combat-encounter-type');
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
    encounterType.textContent = 'PVP COMBAT';
    enemyLabelSpan.textContent = enemyName.toUpperCase();
    if (combat.isDefender) {
      title.textContent = enemyName;
      description.textContent = `${enemyName} is attacking you!`;
    } else {
      title.textContent = enemyName;
      description.textContent = `You're attacking ${enemyName}`;
    }
  } else if (isCop) {
    encounterType.textContent = 'COP ENCOUNTER';
    enemyLabelSpan.textContent = 'COP';
    title.textContent = enemyName;
    description.textContent = enemyDescription;
  } else {
    encounterType.textContent = 'PIRATE ENCOUNTER';
    enemyLabelSpan.textContent = 'PIRATE';
    title.textContent = enemyName;
    description.textContent = enemyDescription;
  }
  
  playerHullSpan.textContent = playerState.hull;
  pirateHullSpan.textContent = enemyHull;
  
  // Update HP distribution bar
  updateHPDistribution(playerState.hull, enemyHull);
  
  // Reset combat log tracker for new combat
  lastCombatLogLength = 0;
  document.getElementById('combat-log').innerHTML = '';
  updateCombatLog(combat.combatLog);
  
  // Show action buttons, hide continue/loot
  combatActions.style.display = 'flex';
  combatContinue.style.display = 'none';
  lootSection.style.display = 'none';
  
  // Set up event handlers
  document.getElementById('combat-attack').onclick = () => handleCombatAction('attack');
  document.getElementById('combat-bribe').onclick = () => handleCombatAction('bribe');
  document.getElementById('combat-flee').onclick = () => handleCombatAction('flee');
  
  // Show/hide bribe button (only for NPCs, not PVP)
  const bribeBtn = document.getElementById('combat-bribe');
  const bribeCostSpan = document.getElementById('bribe-cost');
  if (isPvp) {
    bribeBtn.style.display = 'none';
  } else {
    bribeBtn.style.display = 'inline-block';
    // Show estimated bribe cost range
    bribeCostSpan.textContent = `${CONSTANTS.BRIBE_COST_MIN}-${CONSTANTS.BRIBE_COST_MAX}`;
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

function updateHPDistribution(playerHull, enemyHull) {
  const totalHP = playerHull + enemyHull;
  const playerPercentage = totalHP > 0 ? (playerHull / totalHP) * 100 : 50;
  
  // The hp_distribution bar represents the player's portion of total HP
  // Container width is 516px (modal 520px - 4px for margins)
  const containerWidth = 516;
  const barWidth = (containerWidth * playerPercentage / 100);
  
  const hpDistBar = document.getElementById('hp-distribution');
  hpDistBar.style.width = `${barWidth}px`;
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
  
  // Close combat modal if it's open
  const combatModal = document.getElementById('combat-modal');
  combatModal.style.display = 'none';
  
  const modal = document.getElementById('death-modal');
  const overlay = document.getElementById('modal-overlay');
  const stats = document.getElementById('death-stats');
  
  // Check if player died in combat
  const diedInCombat = playerState.activeCombat !== null;
  
  if (diedInCombat) {
    stats.textContent = `You were destroyed in combat! You will respawn at a random station.`;
  } else {
    stats.textContent = `You will respawn at a random station.`;
  }
  
  // Set up event handler
  document.getElementById('death-respawn').onclick = handleRespawn;
  
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
  
  // Update HP distribution bar
  updateHPDistribution(playerState.hull, enemyHull);
  
  // Update combat log (prepend new messages)
  updateCombatLog(combat.combatLog);
  
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
  
  // Reset combat log tracker for next combat
  lastCombatLogLength = 0;
  
  // Update map, status, and station UI to reflect final state after combat
  renderMap();
  renderStatus();
  renderStation(); // Update repair button cost after hull changes from combat
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
  
  // Add waiting message to combat log (prepend at top)
  const waitingMsg = document.createElement('div');
  waitingMsg.id = 'waiting-message';
  waitingMsg.style.color = '#ffcc00';
  waitingMsg.style.fontStyle = 'italic';
  waitingMsg.style.marginBottom = '4px';
  waitingMsg.textContent = 'Waiting for opponent to choose their action...';
  combatLog.insertBefore(waitingMsg, combatLog.firstChild);
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

// === COMBAT LOG ===

function updateCombatLog(combatLogArray) {
  const combatLogElement = document.getElementById('combat-log');
  if (!combatLogElement || !combatLogArray) return;
  
  // Check if we need to reset (combat log is shorter than last time = new combat)
  if (combatLogArray.length < lastCombatLogLength) {
    combatLogElement.innerHTML = '';
    lastCombatLogLength = 0;
  }
  
  // Only add new messages (from lastCombatLogLength to end)
  const newMessages = combatLogArray.slice(lastCombatLogLength);
  
  newMessages.forEach(message => {
    // Check if this is a round header
    const roundMatch = message.match(/^--- ROUND (\d+) ---$/);
    
    if (roundMatch) {
      // Create round header
      const header = document.createElement('div');
      header.className = 'combat-round-header';
      header.textContent = message;
      combatLogElement.insertBefore(header, combatLogElement.firstChild);
    } else {
      // Create round text
      const entry = document.createElement('div');
      entry.className = 'combat-round-text';
      entry.textContent = message;
      combatLogElement.insertBefore(entry, combatLogElement.firstChild);
    }
  });
  
  // Update tracker
  lastCombatLogLength = combatLogArray.length;
  
  // Keep only last 100 messages (rounds can have multiple entries)
  while (combatLogElement.children.length > 100) {
    combatLogElement.removeChild(combatLogElement.lastChild);
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

// === DEBUG PANEL ===

function initializeDebugPanel() {
  const debugPanel = document.getElementById('debug-panel');
  if (!debugPanel) {
    console.error('Debug panel not found in DOM');
    return;
  }
  
  console.log('Initializing debug panel...');
  
  // Toggle debug panel with pipe key
  document.addEventListener('keydown', (e) => {
    if (e.key === '|') {
      e.preventDefault();
      const isVisible = debugPanel.style.display === 'block';
      debugPanel.style.display = isVisible ? 'none' : 'block';
      if (!isVisible) {
        updateDebugPanel();
      }
    }
  });
  
  // Populate teleport dropdown with stations
  const teleportSelect = document.getElementById('debug-teleport-select');
  if (teleportSelect && STATIONS) {
    STATIONS.forEach(station => {
      const option = document.createElement('option');
      option.value = station.id;
      option.textContent = station.name;
      teleportSelect.appendChild(option);
    });
    console.log('Populated teleport dropdown with', STATIONS.length, 'stations');
  }
  
  // Event trigger buttons
  const surgeBtn = document.getElementById('debug-surge');
  console.log('debug-surge button:', surgeBtn);
  
  document.getElementById('debug-surge')?.addEventListener('click', () => {
    console.log('Surge button clicked');
    triggerDebugEvent('price_surge');
  });
  document.getElementById('debug-shortage')?.addEventListener('click', () => {
    console.log('Shortage button clicked');
    triggerDebugEvent('shortage');
  });
  document.getElementById('debug-glut')?.addEventListener('click', () => {
    console.log('Glut button clicked');
    triggerDebugEvent('glut');
  });
  document.getElementById('debug-reroll')?.addEventListener('click', () => {
    console.log('Reroll button clicked');
    triggerDebugEvent('commodity_reroll');
  });
  document.getElementById('debug-spike')?.addEventListener('click', () => {
    console.log('Spike button clicked');
    triggerDebugEvent('price_spike');
  });
  document.getElementById('debug-drop')?.addEventListener('click', () => {
    console.log('Drop button clicked');
    triggerDebugEvent('price_drop');
  });
  document.getElementById('debug-boom')?.addEventListener('click', () => {
    console.log('Boom button clicked');
    triggerDebugEvent('station_boom');
  });
  document.getElementById('debug-recession')?.addEventListener('click', () => {
    console.log('Recession button clicked');
    triggerDebugEvent('station_recession');
  });
  document.getElementById('debug-crackdown')?.addEventListener('click', () => {
    console.log('Crackdown button clicked');
    triggerDebugEvent('security_crackdown');
  });
  document.getElementById('debug-safe')?.addEventListener('click', () => {
    console.log('Safe passage button clicked');
    triggerDebugEvent('safe_passage');
  });
  
  // Tick control
  document.getElementById('debug-force-tick')?.addEventListener('click', async () => {
    try {
      const result = await MP.debugForceTick();
      if (result.success) {
        addLog('Forced tick advancement', 'info');
      }
    } catch (error) {
      addLog('Failed to force tick: ' + error.message, 'danger');
    }
  });
  
  // Cheat buttons
  document.getElementById('debug-add-credits')?.addEventListener('click', async () => {
    try {
      const result = await MP.debugAddCredits(1000);
      if (result.success) {
        addLog('Added 1000 credits', 'success');
        
        // Update UI immediately
        const updatedState = MP.getPlayerState();
        if (updatedState) {
          playerState = updatedState;
          renderStatus();
        }
      }
    } catch (error) {
      addLog('Failed to add credits: ' + error.message, 'danger');
    }
  });
  
  document.getElementById('debug-full-hull')?.addEventListener('click', async () => {
    try {
      const result = await MP.debugFullHull();
      if (result.success) {
        addLog('Hull fully restored', 'success');
        
        // Update UI immediately
        const updatedState = MP.getPlayerState();
        if (updatedState) {
          playerState = updatedState;
          renderStatus();
        }
      }
    } catch (error) {
      addLog('Failed to restore hull: ' + error.message, 'danger');
    }
  });
  
  document.getElementById('debug-clear-bounty')?.addEventListener('click', async () => {
    try {
      const result = await MP.debugClearBounty();
      if (result.success) {
        addLog('Bounty cleared', 'success');
        
        // Update UI immediately
        const updatedState = MP.getPlayerState();
        if (updatedState) {
          playerState = updatedState;
          renderStatus();
        }
      }
    } catch (error) {
      addLog('Failed to clear bounty: ' + error.message, 'danger');
    }
  });
  
  document.getElementById('debug-add-bounty')?.addEventListener('click', async () => {
    try {
      const result = await MP.debugAddBounty();
      if (result.success) {
        addLog('Added 1000cr bounty', 'warning');
        
        // Update UI immediately
        const updatedState = MP.getPlayerState();
        if (updatedState) {
          playerState = updatedState;
          renderStatus();
          renderMap(); // Refresh map to show red ship marker
        }
      }
    } catch (error) {
      addLog('Failed to add bounty: ' + error.message, 'danger');
    }
  });
  
  document.getElementById('debug-max-cargo')?.addEventListener('click', async () => {
    try {
      const result = await MP.debugMaxCargo();
      if (result.success) {
        addLog('Cargo upgraded to maximum', 'success');
        
        // Update UI immediately
        const updatedState = MP.getPlayerState();
        if (updatedState) {
          playerState = updatedState;
          renderStatus();
        }
      }
    } catch (error) {
      addLog('Failed to upgrade cargo: ' + error.message, 'danger');
    }
  });
  
  // Teleport
  document.getElementById('debug-teleport')?.addEventListener('click', async () => {
    const stationId = teleportSelect.value;
    if (!stationId) return;
    
    try {
      const result = await MP.debugTeleport(stationId);
      if (result.success) {
        const station = STATIONS.find(s => s.id === stationId);
        
        // Get updated player state from multiplayer module
        const updatedState = MP.getPlayerState();
        if (updatedState) {
          playerState = updatedState;
          gameState = MP.getGameState();
          
          // Full UI refresh
          renderMap();
          renderStation();
          renderStatus();
          renderPlayersHere();
          updateDebugPanel();
          
          addLog(`Teleported to ${station?.name || stationId}`, 'success');
        }
      }
    } catch (error) {
      addLog('Failed to teleport: ' + error.message, 'danger');
    }
  });
  
  console.log('Debug panel initialized successfully');
}

async function triggerDebugEvent(eventType) {
  console.log('triggerDebugEvent called with:', eventType);
  try {
    console.log('Calling MP.debugTriggerEvent...');
    const result = await MP.debugTriggerEvent(eventType);
    console.log('Result:', result);
    if (result.success) {
      addLog(`Triggered ${eventType} event`, 'info');
    }
  } catch (error) {
    console.error('Error triggering event:', error);
    addLog(`Failed to trigger ${eventType}: ` + error.message, 'danger');
  }
}

function updateDebugPanel() {
  if (!playerState || !gameState) return;
  
  // Update individual elements
  const tickElem = document.getElementById('debug-tick');
  const eventCountElem = document.getElementById('debug-event-count');
  const locationElem = document.getElementById('debug-location');
  
  if (tickElem) {
    tickElem.textContent = gameState.currentTick || 0;
  }
  
  if (eventCountElem) {
    eventCountElem.textContent = gameState.activeEvents?.length || 0;
  }
  
  if (locationElem) {
    const location = STATIONS.find(s => s.id === playerState.location);
    locationElem.textContent = location?.name || playerState.location;
  }
}
