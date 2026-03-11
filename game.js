// Space Drugwars - Game Logic
// All state management, game systems, and UI rendering

// === GLOBAL STATE ===
let gameState = null;
let pendingTravel = null; // For travel warning modal

// === UTILITY FUNCTIONS ===

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// === PURE GAME LOGIC FUNCTIONS ===

function createInitialState() {
  const startingStation = randomChoice(STATIONS);
  
  const state = {
    player: {
      credits: CONSTANTS.STARTING_CREDITS,
      hull: CONSTANTS.STARTING_HULL,
      hullMax: CONSTANTS.STARTING_HULL,
      cargoMax: CONSTANTS.STARTING_CARGO_MAX,
      cargoUsed: 0,
      location: startingStation.id,
      cargo: {},
      upgrades: {},
      stats: {
        totalProfit: 0,
        successfulTrades: 0,
        piratesDefeated: 0,
        stationsVisited: 1,
        contrabandRuns: 0
      }
    },
    markets: {},
    activeEvents: [],
    tick: 0,
    log: []
  };

  // Initialize markets
  STATIONS.forEach(station => {
    state.markets[station.id] = {};
    COMMODITIES.forEach(commodity => {
      const basePrice = commodity.basePrice;
      const stationModifier = station.priceModifiers[commodity.id] || 1.0;
      const variance = 1 + randomFloat(-0.1, 0.1);
      
      state.markets[station.id][commodity.id] = {
        currentPrice: Math.round(basePrice * stationModifier * variance),
        supply: "normal",
        demand: "normal",
        variance: variance
      };
    });
  });

  // Add 2-3 initial market anomalies
  addInitialAnomalies(state);

  return state;
}

function addInitialAnomalies(state) {
  // Shortage
  const shortageStation = randomChoice(STATIONS);
  const shortageCommodity = randomChoice(COMMODITIES);
  state.markets[shortageStation.id][shortageCommodity.id].supply = "low";
  state.markets[shortageStation.id][shortageCommodity.id].currentPrice = 
    Math.round(state.markets[shortageStation.id][shortageCommodity.id].currentPrice * CONSTANTS.SHORTAGE_PRICE_MULT);
  state.activeEvents.push({
    type: "shortage",
    stationId: shortageStation.id,
    commodityId: shortageCommodity.id,
    expiryTick: state.tick + randomInt(5, 7)
  });

  // Surplus
  const surplusStation = randomChoice(STATIONS);
  const surplusCommodity = randomChoice(COMMODITIES);
  state.markets[surplusStation.id][surplusCommodity.id].supply = "high";
  state.markets[surplusStation.id][surplusCommodity.id].currentPrice = 
    Math.round(state.markets[surplusStation.id][surplusCommodity.id].currentPrice * CONSTANTS.SURPLUS_PRICE_MULT);
  state.activeEvents.push({
    type: "glut",
    stationId: surplusStation.id,
    commodityId: surplusCommodity.id,
    expiryTick: state.tick + randomInt(5, 7)
  });

  // Maybe a price surge
  if (Math.random() > 0.5) {
    const surgeStation = randomChoice(STATIONS);
    const surgeCommodity = randomChoice(COMMODITIES);
    state.markets[surgeStation.id][surgeCommodity.id].demand = "high";
    state.markets[surgeStation.id][surgeCommodity.id].currentPrice = 
      Math.round(state.markets[surgeStation.id][surgeCommodity.id].currentPrice * CONSTANTS.SURGE_PRICE_MULT);
    state.activeEvents.push({
      type: "surge",
      stationId: surgeStation.id,
      commodityId: surgeCommodity.id,
      expiryTick: state.tick + randomInt(3, 5)
    });
  }
}

function tick(state, triggerContext = "general") {
  const newState = deepClone(state);
  newState.tick += 1;

  // Expire old events
  newState.activeEvents = newState.activeEvents.filter(event => {
    if (event.expiryTick <= newState.tick) {
      // Restore market to normal
      if (event.type === "shortage" || event.type === "glut") {
        newState.markets[event.stationId][event.commodityId].supply = "normal";
      } else if (event.type === "surge") {
        newState.markets[event.stationId][event.commodityId].demand = "normal";
      }
      return false;
    }
    return true;
  });

  // Price drift toward baseline
  STATIONS.forEach(station => {
    COMMODITIES.forEach(commodity => {
      const market = newState.markets[station.id][commodity.id];
      const basePrice = commodity.basePrice;
      const stationModifier = station.priceModifiers[commodity.id] || 1.0;
      const targetPrice = basePrice * stationModifier * market.variance;
      
      // Drift 5% toward target
      const drift = (targetPrice - market.currentPrice) * CONSTANTS.PRICE_DRIFT_RATE;
      market.currentPrice = Math.round(market.currentPrice + drift);
    });
  });

  // Random event (15% chance)
  if (Math.random() < CONSTANTS.TICK_EVENT_CHANCE) {
    const event = generateRandomEvent(newState, triggerContext);
    if (event) {
      return { state: newState, event };
    }
  }

  return { state: newState, event: null };
}

function generateRandomEvent(state, triggerContext) {
  const roll = Math.random();
  
  // Market events only (pirates now handled in travel function)
  if (roll < 0.40) {
    // Price surge
    const station = randomChoice(STATIONS);
    const commodity = randomChoice(COMMODITIES);
    state.markets[station.id][commodity.id].demand = "high";
    state.markets[station.id][commodity.id].currentPrice = 
      Math.round(state.markets[station.id][commodity.id].currentPrice * CONSTANTS.SURGE_PRICE_MULT);
    state.activeEvents.push({
      type: "surge",
      stationId: station.id,
      commodityId: commodity.id,
      expiryTick: state.tick + randomInt(3, 5)
    });
    return {
      type: "surge",
      description: `Price surge: ${commodity.name} at ${station.name}!`
    };
  } else if (roll < 0.65) {
    // Shortage
    const station = randomChoice(STATIONS);
    const commodity = randomChoice(COMMODITIES);
    state.markets[station.id][commodity.id].supply = "low";
    state.markets[station.id][commodity.id].currentPrice = 
      Math.round(state.markets[station.id][commodity.id].currentPrice * CONSTANTS.SHORTAGE_PRICE_MULT);
    state.activeEvents.push({
      type: "shortage",
      stationId: station.id,
      commodityId: commodity.id,
      expiryTick: state.tick + randomInt(5, 7)
    });
    return {
      type: "shortage",
      description: `Shortage: ${commodity.name} supply low at ${station.name}!`
    };
  } else {
    // Glut
    const station = randomChoice(STATIONS);
    const commodity = randomChoice(COMMODITIES);
    state.markets[station.id][commodity.id].supply = "high";
    state.markets[station.id][commodity.id].currentPrice = 
      Math.round(state.markets[station.id][commodity.id].currentPrice * CONSTANTS.SURPLUS_PRICE_MULT);
    state.activeEvents.push({
      type: "glut",
      stationId: station.id,
      commodityId: commodity.id,
      expiryTick: state.tick + randomInt(5, 7)
    });
    return {
      type: "glut",
      description: `Market glut: ${commodity.name} prices crash at ${station.name}!`
    };
  }
}

function buyCommodity(state, commodityId, quantity) {
  const newState = deepClone(state);
  const commodity = COMMODITIES.find(c => c.id === commodityId);
  const currentStation = STATIONS.find(s => s.id === newState.player.location);
  const market = newState.markets[currentStation.id][commodityId];
  
  const totalCost = market.currentPrice * quantity;
  
  // Deduct credits
  newState.player.credits -= totalCost;
  
  // Add cargo
  if (!newState.player.cargo[commodityId]) {
    newState.player.cargo[commodityId] = 0;
  }
  newState.player.cargo[commodityId] += quantity;
  newState.player.cargoUsed += quantity;
  
  // Increase price at current station
  market.currentPrice = Math.round(market.currentPrice * (1 + CONSTANTS.PLAYER_BUY_PRICE_INCREASE));
  
  // Decrease price at connected stations
  const connectedStations = getConnectedStations(currentStation.id);
  connectedStations.forEach(stationId => {
    newState.markets[stationId][commodityId].currentPrice = 
      Math.round(newState.markets[stationId][commodityId].currentPrice * (1 - CONSTANTS.ADJACENT_PRICE_CHANGE));
  });
  
  // Stats
  newState.player.stats.successfulTrades++;
  if (commodity.contraband) {
    newState.player.stats.contrabandRuns++;
  }
  
  // Maybe tick
  if (Math.random() < 0.5) {
    const tickResult = tick(newState, "buy");
    if (tickResult.event && tickResult.event.type !== "pirate") {
      return { state: tickResult.state, event: tickResult.event };
    }
    return { state: tickResult.state, event: null };
  }
  
  return { state: newState, event: null };
}

function sellCommodity(state, commodityId, quantity) {
  const newState = deepClone(state);
  const commodity = COMMODITIES.find(c => c.id === commodityId);
  const currentStation = STATIONS.find(s => s.id === newState.player.location);
  const market = newState.markets[currentStation.id][commodityId];
  
  const totalRevenue = market.currentPrice * quantity;
  
  // Add credits
  newState.player.credits += totalRevenue;
  
  // Remove cargo
  newState.player.cargo[commodityId] -= quantity;
  if (newState.player.cargo[commodityId] <= 0) {
    delete newState.player.cargo[commodityId];
  }
  newState.player.cargoUsed -= quantity;
  
  // Decrease price at current station
  market.currentPrice = Math.round(market.currentPrice * (1 - CONSTANTS.PLAYER_SELL_PRICE_DECREASE));
  
  // Increase price at connected stations
  const connectedStations = getConnectedStations(currentStation.id);
  connectedStations.forEach(stationId => {
    newState.markets[stationId][commodityId].currentPrice = 
      Math.round(newState.markets[stationId][commodityId].currentPrice * (1 + CONSTANTS.ADJACENT_PRICE_CHANGE));
  });
  
  // Stats
  newState.player.stats.successfulTrades++;
  newState.player.stats.totalProfit += totalRevenue;
  
  // Maybe tick
  if (Math.random() < 0.5) {
    const tickResult = tick(newState, "sell");
    if (tickResult.event && tickResult.event.type !== "pirate") {
      return { state: tickResult.state, event: tickResult.event };
    }
    return { state: tickResult.state, event: null };
  }
  
  return { state: newState, event: null };
}

function travel(state, destinationId) {
  const newState = deepClone(state);
  const route = findRoute(newState.player.location, destinationId);
  
  if (!route) {
    return { state: newState, event: null, error: "No route found" };
  }
  
  // Deduct toll fee if route has one
  const tollFee = route.tollFee || 0;
  newState.player.credits -= tollFee;
  
  // Update location
  newState.player.location = destinationId;
  newState.player.stats.stationsVisited++;
  
  // Check for pirate encounter (BEFORE tick)
  const hasContraband = Object.keys(newState.player.cargo).some(id => 
    COMMODITIES.find(c => c.id === id && c.contraband)
  );
  const pirateChance = CONSTANTS.BASE_PIRATE_CHANCE + 
    (hasContraband ? CONSTANTS.CONTRABAND_PIRATE_BONUS : 0);
  
  if (Math.random() < pirateChance) {
    // Tick without events (just price drift and event expiry)
    const tickResult = tick(newState, "none");
    return {
      state: tickResult.state,
      event: {
        type: "pirate",
        description: "Pirates have intercepted your ship!"
      },
      tollFee: tollFee
    };
  }
  
  // Tick (may trigger market events)
  const tickResult = tick(newState, "travel");
  
  return {
    state: tickResult.state,
    event: tickResult.event,
    tollFee: tollFee
  };
}

// === COMBAT SYSTEM (Multi-Round) ===

function rollPirateType(contrabandValue) {
  // Scale difficulty based on contraband value
  if (contrabandValue < CONSTANTS.PIRATE_SCOUT_THRESHOLD) {
    // Mostly scouts, some raiders
    const roll = Math.random();
    if (roll < 0.70) return PIRATE_TYPES[0]; // scout
    else return PIRATE_TYPES[1]; // raider
  } else if (contrabandValue < CONSTANTS.PIRATE_RAIDER_THRESHOLD) {
    // Mostly raiders, some scouts/battleships
    const roll = Math.random();
    if (roll < 0.20) return PIRATE_TYPES[0]; // scout
    else if (roll < 0.80) return PIRATE_TYPES[1]; // raider
    else return PIRATE_TYPES[2]; // battleship
  } else {
    // Mostly battleships and raiders
    const roll = Math.random();
    if (roll < 0.30) return PIRATE_TYPES[1]; // raider
    else return PIRATE_TYPES[2]; // battleship
  }
}

function initiateCombat(state) {
  const contrabandValue = calculateContrabandValue(state);
  const pirateType = rollPirateType(contrabandValue);
  const pirateName = randomChoice(PIRATE_NAMES);
  const pirateHull = randomInt(pirateType.hullMin, pirateType.hullMax);
  const maxRounds = randomInt(CONSTANTS.COMBAT_ROUNDS_MIN, CONSTANTS.COMBAT_ROUNDS_MAX);
  
  return {
    pirateName,
    pirateType: pirateType.id,
    pirateTypeName: pirateType.name,
    pirateFlavorText: pirateType.flavorText,
    pirateHull,
    pirateHullMax: pirateHull,
    currentRound: 1,
    maxRounds,
    combatLog: [],
    pendingLoot: null, // Will hold loot if victory occurs
    resolved: false,
    outcome: null // 'victory', 'defeat', 'escaped'
  };
}

function resolveCombatRound(state, combatState, action) {
  const newState = deepClone(state);
  const newCombat = deepClone(combatState);
  
  let logEntry = `--- ROUND ${newCombat.currentRound} ---\n`;
  
  if (action === "attack") {
    // Player attacks
    const playerDamage = randomInt(CONSTANTS.ATTACK_DAMAGE_MIN, CONSTANTS.ATTACK_DAMAGE_MAX);
    
    // Apply weapon upgrade bonus
    const weaponBonus = newState.player.upgrades.weapon ? 10 : 0;
    const finalPlayerDamage = playerDamage + weaponBonus;
    
    newCombat.pirateHull -= finalPlayerDamage;
    logEntry += randomChoice(COMBAT_FLAVOR.attack_hit) + ` (-${finalPlayerDamage} pirate hull)\n`;
    
    // Pirate counterattacks (if still alive)
    if (newCombat.pirateHull > 0) {
      let pirateDamage = randomInt(CONSTANTS.ATTACK_DAMAGE_TAKEN_MIN, CONSTANTS.ATTACK_DAMAGE_TAKEN_MAX);
      
      // Apply damage reduction from upgrades
      let damageReduction = 0;
      if (newState.player.upgrades.hull) damageReduction += 0.25;
      if (newState.player.upgrades.shields) damageReduction += 0.40;
      
      pirateDamage = Math.round(pirateDamage * (1 - damageReduction));
      newState.player.hull = Math.max(0, newState.player.hull - pirateDamage);
      
      logEntry += randomChoice(COMBAT_FLAVOR.attack_return) + ` (-${pirateDamage} your hull)\n`;
    }
    
  } else if (action === "defend") {
    // Player defends
    const playerDamage = randomInt(CONSTANTS.DEFEND_DAMAGE_MIN, CONSTANTS.DEFEND_DAMAGE_MAX);
    newCombat.pirateHull -= playerDamage;
    logEntry += randomChoice(COMBAT_FLAVOR.defend_chip) + ` (-${playerDamage} pirate hull)\n`;
    
    // Pirate attacks but reduced damage
    if (newCombat.pirateHull > 0) {
      let pirateDamage = randomInt(CONSTANTS.DEFEND_DAMAGE_TAKEN_MIN, CONSTANTS.DEFEND_DAMAGE_TAKEN_MAX);
      
      // Apply damage reduction from upgrades
      let damageReduction = 0;
      if (newState.player.upgrades.hull) damageReduction += 0.25;
      if (newState.player.upgrades.shields) damageReduction += 0.40;
      
      pirateDamage = Math.round(pirateDamage * (1 - damageReduction));
      newState.player.hull = Math.max(0, newState.player.hull - pirateDamage);
      
      logEntry += randomChoice(COMBAT_FLAVOR.defend_success) + ` (-${pirateDamage} your hull)\n`;
    }
    
  } else if (action === "bribe") {
    const bribeCost = randomInt(CONSTANTS.BRIBE_COST_MIN, CONSTANTS.BRIBE_COST_MAX);
    
    if (Math.random() < CONSTANTS.BRIBE_SUCCESS_CHANCE) {
      // Success
      newState.player.credits -= bribeCost;
      logEntry += randomChoice(COMBAT_FLAVOR.bribe_success) + ` (-${bribeCost}cr)\n`;
      newCombat.resolved = true;
      newCombat.outcome = 'escaped';
    } else {
      // Fail - they take money and attack anyway
      newState.player.credits -= bribeCost;
      let pirateDamage = randomInt(CONSTANTS.ATTACK_DAMAGE_TAKEN_MIN, CONSTANTS.ATTACK_DAMAGE_TAKEN_MAX);
      
      // Apply damage reduction
      let damageReduction = 0;
      if (newState.player.upgrades.hull) damageReduction += 0.25;
      if (newState.player.upgrades.shields) damageReduction += 0.40;
      
      pirateDamage = Math.round(pirateDamage * (1 - damageReduction));
      newState.player.hull = Math.max(0, newState.player.hull - pirateDamage);
      
      logEntry += randomChoice(COMBAT_FLAVOR.bribe_fail) + ` (-${bribeCost}cr, -${pirateDamage} hull)\n`;
    }
    
  } else if (action === "flee") {
    if (Math.random() < CONSTANTS.FLEE_SUCCESS_BASE) {
      // Success - clean escape, no cost
      logEntry += randomChoice(COMBAT_FLAVOR.flee_success) + "\n";
      newCombat.resolved = true;
      newCombat.outcome = 'escaped';
    } else {
      // Fail - substantial hull damage (they catch you while you're vulnerable)
      let pirateDamage = randomInt(CONSTANTS.FLEE_FAIL_DAMAGE_MIN, CONSTANTS.FLEE_FAIL_DAMAGE_MAX);
      
      // Apply damage reduction (but still more than normal since you're fleeing)
      let damageReduction = 0;
      if (newState.player.upgrades.hull) damageReduction += 0.25;
      if (newState.player.upgrades.shields) damageReduction += 0.40;
      
      pirateDamage = Math.round(pirateDamage * (1 - damageReduction));
      newState.player.hull = Math.max(0, newState.player.hull - pirateDamage);
      
      logEntry += randomChoice(COMBAT_FLAVOR.flee_fail) + ` (-${pirateDamage} hull!)\n`;
    }
  }
  
  newCombat.combatLog.push(logEntry);
  
  // Check for victory/defeat
  if (newCombat.pirateHull <= 0 && !newCombat.resolved) {
    // Player victory!
    newCombat.combatLog.push(randomChoice(COMBAT_FLAVOR.victory));
    newCombat.resolved = true;
    newCombat.outcome = 'victory';
    newState.player.stats.piratesDefeated++;
    
    // Generate rewards
    const creditReward = randomInt(CONSTANTS.VICTORY_CREDITS_MIN, CONSTANTS.VICTORY_CREDITS_MAX);
    newState.player.credits += creditReward;
    
    // Chance for salvage loot
    if (Math.random() < CONSTANTS.SALVAGE_CHANCE) {
      const salvageAmount = randomInt(CONSTANTS.SALVAGE_AMOUNT_MIN, CONSTANTS.SALVAGE_AMOUNT_MAX);
      const salvageCommodity = randomChoice(COMMODITIES);
      newCombat.pendingLoot = {
        commodityId: salvageCommodity.id,
        commodityName: salvageCommodity.name,
        amount: salvageAmount
      };
    }
    
    newCombat.combatLog.push(`\nVICTORY! Earned ${creditReward}cr.`);
    if (newCombat.pendingLoot) {
      newCombat.combatLog.push(`Salvage detected: ${newCombat.pendingLoot.amount}x ${newCombat.pendingLoot.commodityName}`);
    }
  }
  
  if (newState.player.hull <= 0 && !newCombat.resolved) {
    // Player defeat
    newCombat.combatLog.push(randomChoice(COMBAT_FLAVOR.defeat));
    newCombat.resolved = true;
    newCombat.outcome = 'defeat';
  }
  
  // Increment round
  if (!newCombat.resolved) {
    newCombat.currentRound++;
  }
  
  return {
    state: newState,
    combat: newCombat
  };
}

function acceptLoot(state, combatState) {
  const newState = deepClone(state);
  
  if (!combatState.pendingLoot) return newState;
  
  const loot = combatState.pendingLoot;
  if (!newState.player.cargo[loot.commodityId]) {
    newState.player.cargo[loot.commodityId] = 0;
  }
  newState.player.cargo[loot.commodityId] += loot.amount;
  newState.player.cargoUsed += loot.amount;
  
  return newState;
}

// Legacy function kept for compatibility (if needed elsewhere)
function resolveCombat(state, action) {
  // This is now deprecated - use multi-round combat system instead
  console.warn("resolveCombat called - use initiateCombat/resolveCombatRound instead");
  const newState = deepClone(state);
  return {
    state: newState,
    outcome: "error",
    message: "Old combat system deprecated"
  };
}

function resolveInspection(state, action) {
  const newState = deepClone(state);
  const contrabandValue = calculateContrabandValue(newState);
  
  if (action === "pay") {
    const fine = Math.round(contrabandValue * CONSTANTS.INSPECTION_FINE_RATE);
    newState.player.credits -= fine;
    return {
      state: newState,
      outcome: "paid",
      message: `Paid fine of ${fine}cr. Kept contraband.`
    };
  } else if (action === "dump") {
    removeAllContraband(newState);
    return {
      state: newState,
      outcome: "dumped",
      message: "Dumped all contraband. No fine."
    };
  } else if (action === "resist") {
    if (Math.random() < 0.6) {
      // Success
      return {
        state: newState,
        outcome: "success",
        message: "Resisted inspection! Escaped with contraband."
      };
    } else {
      // Failure = combat + fine
      const fine = Math.round(contrabandValue * CONSTANTS.INSPECTION_FINE_RATE);
      newState.player.credits -= fine;
      
      const hullDamage = randomInt(15, 30);
      newState.player.hull = Math.max(0, newState.player.hull - hullDamage);
      
      return {
        state: newState,
        outcome: "failure",
        message: `Resist failed! Took ${hullDamage} hull damage and ${fine}cr fine.`
      };
    }
  }
}

function buyUpgrade(state, upgradeId) {
  const newState = deepClone(state);
  const upgrade = UPGRADES.find(u => u.id === upgradeId);
  
  newState.player.credits -= upgrade.price;
  newState.player.upgrades[upgradeId] = true;
  
  // Apply upgrade effects
  if (upgrade.effect.cargoBonus) {
    newState.player.cargoMax += upgrade.effect.cargoBonus;
  }
  
  return newState;
}

function repairHull(state, amount) {
  const newState = deepClone(state);
  const cost = amount * CONSTANTS.HULL_REPAIR_COST_PER_POINT;
  
  newState.player.credits -= cost;
  newState.player.hull += amount;
  
  return newState;
}

function doDesperateWork(state) {
  const payout = randomInt(CONSTANTS.DESPERATE_WORK_PAYOUT.min, CONSTANTS.DESPERATE_WORK_PAYOUT.max);
  const message = randomChoice(DESPERATE_WORK_MESSAGES);
  
  return {
    ...state,
    player: {
      ...state.player,
      credits: state.player.credits + payout
    },
    log: [...state.log.slice(-99), {
      turn: state.tick,
      message: `DESPERATE WORK: ${message} Earned ${payout}cr.`,
      type: "warning"
    }]
  };
}

function checkDeath(state) {
  return state.player.hull <= 0;
}

function respawn(state) {
  const newState = deepClone(state);
  const nearestStation = findNearestStation(newState.player.location);
  
  // Calculate credits after penalty
  const retainedCredits = Math.floor(newState.player.credits * CONSTANTS.DEATH_CREDIT_RETENTION);
  const finalCredits = Math.max(retainedCredits, CONSTANTS.RESPAWN_SHIP_COST);
  
  if (finalCredits < CONSTANTS.RESPAWN_SHIP_COST) {
    return { state: null, gameOver: true };
  }
  
  // Reset player
  newState.player.credits = finalCredits - CONSTANTS.RESPAWN_SHIP_COST;
  newState.player.hull = CONSTANTS.STARTING_HULL;
  newState.player.hullMax = CONSTANTS.STARTING_HULL;
  newState.player.cargoMax = CONSTANTS.STARTING_CARGO_MAX;
  newState.player.cargoUsed = 0;
  newState.player.cargo = {};
  newState.player.upgrades = {};
  newState.player.location = nearestStation.id;
  
  return { state: newState, gameOver: false, respawnLocation: nearestStation.name };
}

// === HELPER FUNCTIONS ===

function getConnectedStations(stationId) {
  const connected = [];
  ROUTES.forEach(route => {
    if (route.from === stationId) {
      connected.push(route.to);
    } else if (route.to === stationId) {
      connected.push(route.from);
    }
  });
  return connected;
}

function findRoute(fromId, toId) {
  // Direct route
  const direct = ROUTES.find(r => 
    (r.from === fromId && r.to === toId) || 
    (r.to === fromId && r.from === toId)
  );
  if (direct) return direct;
  return null;
}

function findNearestStation(fromId) {
  // BFS to find nearest station
  const queue = [[fromId, 0]];
  const visited = new Set([fromId]);
  
  while (queue.length > 0) {
    const [currentId, distance] = queue.shift();
    const connected = getConnectedStations(currentId);
    
    for (const neighborId of connected) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        if (neighborId !== fromId) {
          return STATIONS.find(s => s.id === neighborId);
        }
        queue.push([neighborId, distance + 1]);
      }
    }
  }
  
  return STATIONS[0]; // Fallback
}

function loseRandomCargo(state, amount) {
  const cargoItems = Object.keys(state.player.cargo);
  let remaining = amount;
  
  while (remaining > 0 && cargoItems.length > 0) {
    const randomItem = randomChoice(cargoItems);
    const available = state.player.cargo[randomItem];
    const toLose = Math.min(remaining, available);
    
    state.player.cargo[randomItem] -= toLose;
    state.player.cargoUsed -= toLose;
    remaining -= toLose;
    
    if (state.player.cargo[randomItem] <= 0) {
      delete state.player.cargo[randomItem];
      cargoItems.splice(cargoItems.indexOf(randomItem), 1);
    }
  }
}

function calculateContrabandValue(state) {
  let total = 0;
  const currentStation = STATIONS.find(s => s.id === state.player.location);
  
  Object.keys(state.player.cargo).forEach(commodityId => {
    const commodity = COMMODITIES.find(c => c.id === commodityId);
    if (commodity.contraband) {
      const quantity = state.player.cargo[commodityId];
      const price = state.markets[currentStation.id][commodityId].currentPrice;
      total += quantity * price;
    }
  });
  
  return total;
}

function removeAllContraband(state) {
  Object.keys(state.player.cargo).forEach(commodityId => {
    const commodity = COMMODITIES.find(c => c.id === commodityId);
    if (commodity.contraband) {
      const quantity = state.player.cargo[commodityId];
      state.player.cargoUsed -= quantity;
      delete state.player.cargo[commodityId];
    }
  });
}

function hasContraband(state) {
  return Object.keys(state.player.cargo).some(commodityId => {
    const commodity = COMMODITIES.find(c => c.id === commodityId);
    return commodity.contraband;
  });
}

function getInspectionChance(state) {
  let chance = CONSTANTS.BASE_INSPECTION_CHANCE;
  
  if (state.player.upgrades.scanner) {
    chance -= UPGRADES.find(u => u.id === "scanner").effect.inspectionReduction;
  }
  if (state.player.upgrades.fakemanifest) {
    chance -= UPGRADES.find(u => u.id === "fakemanifest").effect.inspectionReduction;
  }
  
  return Math.max(chance, 0.05); // Minimum 5%
}

function calculateNetWorth(state) {
  let worth = state.player.credits;
  
  // Add cargo value
  const currentStation = STATIONS.find(s => s.id === state.player.location);
  Object.keys(state.player.cargo).forEach(commodityId => {
    const quantity = state.player.cargo[commodityId];
    const price = state.markets[currentStation.id][commodityId].currentPrice;
    worth += quantity * price;
  });
  
  // Add upgrade value
  Object.keys(state.player.upgrades).forEach(upgradeId => {
    const upgrade = UPGRADES.find(u => u.id === upgradeId);
    worth += upgrade.price;
  });
  
  return worth;
}

// === UI RENDERING ===

function render() {
  renderMap();
  renderStation();
  renderStatus();
  renderLog();
}

function renderMap() {
  const routesLayer = document.getElementById("routes-layer");
  const stationsLayer = document.getElementById("stations-layer");
  
  routesLayer.innerHTML = "";
  stationsLayer.innerHTML = "";
  
  // Render routes
  ROUTES.forEach(route => {
    const fromStation = STATIONS.find(s => s.id === route.from);
    const toStation = STATIONS.find(s => s.id === route.to);
    
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("class", route.tollFee ? "route-line toll" : "route-line");
    line.setAttribute("x1", fromStation.position.x);
    line.setAttribute("y1", fromStation.position.y);
    line.setAttribute("x2", toStation.position.x);
    line.setAttribute("y2", toStation.position.y);
    routesLayer.appendChild(line);
    
    // Label with toll fee (if any)
    if (route.tollFee) {
      const midX = (fromStation.position.x + toStation.position.x) / 2;
      const midY = (fromStation.position.y + toStation.position.y) / 2;
      
      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("class", "route-label toll");
      label.setAttribute("x", midX);
      label.setAttribute("y", midY - 5);
      label.textContent = `${route.tollFee}cr`;
      routesLayer.appendChild(label);
    }
  });
  
  // Render stations
  STATIONS.forEach(station => {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("class", "station-node");
    if (station.id === gameState.player.location) {
      circle.classList.add("current");
    }
    circle.setAttribute("cx", station.position.x);
    circle.setAttribute("cy", station.position.y);
    circle.setAttribute("r", 20);
    circle.setAttribute("data-station-id", station.id);
    circle.addEventListener("click", () => handleStationClick(station.id));
    stationsLayer.appendChild(circle);
    
    // Station name label
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("class", "station-label");
    label.setAttribute("x", station.position.x);
    label.setAttribute("y", station.position.y + 35);
    label.textContent = station.name.replace("Station ", "");
    stationsLayer.appendChild(label);
  });
}

function renderScannerData(currentStation) {
  const scannerSection = document.getElementById("scanner-data");
  
  if (!gameState.player.upgrades.scanner) {
    scannerSection.style.display = "none";
    return;
  }
  
  scannerSection.style.display = "block";
  const scannerContent = document.getElementById("scanner-content");
  scannerContent.innerHTML = "";
  
  const connectedStations = getConnectedStations(currentStation.id);
  
  connectedStations.forEach(stationId => {
    const station = STATIONS.find(s => s.id === stationId);
    const route = findRoute(currentStation.id, stationId);
    
    const stationDiv = document.createElement("div");
    stationDiv.className = "scanner-station";
    const tollLabel = route.tollFee ? ` (${route.tollFee}cr toll)` : '';
    stationDiv.innerHTML = `<strong>${station.name}${tollLabel}</strong>`;
    
    // Show top 3 best price differences
    const opportunities = [];
    COMMODITIES.forEach(commodity => {
      const currentPrice = gameState.markets[currentStation.id][commodity.id].currentPrice;
      const adjacentPrice = gameState.markets[stationId][commodity.id].currentPrice;
      const diff = adjacentPrice - currentPrice;
      const margin = diff > 0 ? ((diff / currentPrice) * 100).toFixed(0) : 0;
      
      if (diff > 0) {
        opportunities.push({
          commodity: commodity,
          diff: diff,
          margin: margin,
          adjacentPrice: adjacentPrice
        });
      }
    });
    
    opportunities.sort((a, b) => b.margin - a.margin);
    const top3 = opportunities.slice(0, 3);
    
    if (top3.length > 0) {
      const oppList = document.createElement("div");
      oppList.className = "scanner-opportunities";
      oppList.innerHTML = top3.map(opp => {
        const className = opp.commodity.contraband ? 'contraband' : '';
        return `<span class="${className}">${opp.commodity.name}: ${opp.adjacentPrice}cr (+${opp.margin}%)</span>`;
      }).join(" | ");
      stationDiv.appendChild(oppList);
    } else {
      stationDiv.innerHTML += `<span style="opacity: 0.5"> - No profitable opportunities</span>`;
    }
    
    scannerContent.appendChild(stationDiv);
  });
}

function renderStation() {
  const currentStation = STATIONS.find(s => s.id === gameState.player.location);
  document.getElementById("station-name").textContent = `DOCKED AT: ${currentStation.name}`;
  document.getElementById("station-description").textContent = currentStation.description;
  
  // Render commodities
  const tbody = document.getElementById("commodity-list");
  tbody.innerHTML = "";
  
  COMMODITIES.forEach(commodity => {
    const market = gameState.markets[currentStation.id][commodity.id];
    
    const playerHas = gameState.player.cargo[commodity.id] || 0;
    
    const tr = document.createElement("tr");
    if (commodity.contraband) {
      tr.classList.add("contraband");
    }
    
    // Calculate price difference from base
    const priceDiff = market.currentPrice - commodity.basePrice;
    const pricePercent = Math.round((priceDiff / commodity.basePrice) * 100);
    
    // Determine price indicators (arrows only, no color changes)
    let priceIndicator = '';
    if (pricePercent < -15) {
      priceIndicator = '↓↓'; // Very good buy
    } else if (pricePercent < -5) {
      priceIndicator = '↓'; // Good buy
    } else if (pricePercent > 15) {
      priceIndicator = '↑↑'; // Very good sell
    } else if (pricePercent > 5) {
      priceIndicator = '↑'; // Good sell
    }
    
    const canBuy = gameState.player.credits >= market.currentPrice && 
                   gameState.player.cargoUsed < gameState.player.cargoMax;
    const canSell = playerHas > 0;
    
    const arrowSpan = priceIndicator ? `<span class="price-arrow">${priceIndicator}</span>` : '';
    
    tr.innerHTML = `
      <td>${commodity.name}</td>
      <td>${market.currentPrice}cr ${arrowSpan}</td>
      <td>${playerHas}</td>
      <td>
        <button class="small" onclick="handleBuy('${commodity.id}', 1)" ${!canBuy ? 'disabled' : ''}>+1</button>
        <button class="small" onclick="handleBuy('${commodity.id}', 5)" ${!canBuy ? 'disabled' : ''}>+5</button>
        <button class="small" onclick="handleSell('${commodity.id}', 1)" ${!canSell ? 'disabled' : ''}>-1</button>
        <button class="small" onclick="handleSell('${commodity.id}', 5)" ${!canSell ? 'disabled' : ''}>-5</button>
      </td>
    `;
    
    tbody.appendChild(tr);
  });
  
  // Render scanner data if owned
  renderScannerData(currentStation);
  
  // Render repair button
  const hullNeeded = gameState.player.hullMax - gameState.player.hull;
  const repairCost = hullNeeded * CONSTANTS.HULL_REPAIR_COST_PER_POINT;
  const repairBtn = document.getElementById("repair-btn");
  repairBtn.textContent = `REPAIR HULL (${repairCost}cr)`;
  repairBtn.disabled = hullNeeded === 0 || gameState.player.credits < repairCost;
  repairBtn.onclick = handleRepair;
  
  // Show/hide desperate work button based on credits
  const desperateBtn = document.getElementById("desperate-work-btn");
  if (gameState.player.credits < CONSTANTS.DESPERATE_WORK_THRESHOLD) {
    desperateBtn.style.display = 'inline-block';
  } else {
    desperateBtn.style.display = 'none';
  }
  
  // Render upgrades
  const upgradeList = document.getElementById("upgrade-list");
  upgradeList.innerHTML = "";
  
  UPGRADES.forEach(upgrade => {
    const owned = gameState.player.upgrades[upgrade.id];
    
    const div = document.createElement("div");
    div.className = `upgrade-item ${owned ? 'owned' : ''}`;
    
    div.innerHTML = `
      <div class="upgrade-name">${upgrade.name}</div>
      <div class="upgrade-description">${upgrade.description}</div>
      <span class="upgrade-price">${upgrade.price}cr</span>
      <button onclick="handleBuyUpgrade('${upgrade.id}')" ${owned || gameState.player.credits < upgrade.price ? 'disabled' : ''}>
        ${owned ? 'OWNED' : 'BUY'}
      </button>
    `;
    
    upgradeList.appendChild(div);
  });
}

function renderStatus() {
  document.getElementById("status-credits").textContent = gameState.player.credits;
  document.getElementById("status-hull").textContent = gameState.player.hull;
  
  const currentStation = STATIONS.find(s => s.id === gameState.player.location);
  document.getElementById("status-location").textContent = currentStation.name.replace("Station ", "");
  
  document.getElementById("status-cargo").textContent = gameState.player.cargoUsed;
  document.getElementById("status-cargo-max").textContent = gameState.player.cargoMax;
  
  document.getElementById("status-networth").textContent = calculateNetWorth(gameState);
}

function renderLog() {
  const logContent = document.getElementById("log-content");
  
  // Keep last 20 events
  const recentLogs = gameState.log.slice(-20);
  
  logContent.innerHTML = recentLogs.map(entry => {
    const className = entry.type || "";
    return `<div class="log-entry ${className}">&gt; ${entry.message}</div>`;
  }).reverse().join("");
}

function logEvent(message, type = "") {
  gameState.log.push({ message, type });
  renderLog();
}

// === MODALS ===

function showModal(modalId) {
  document.getElementById("modal-overlay").classList.add("active");
  document.getElementById(modalId).classList.add("active");
}

function hideModal(modalId) {
  document.getElementById("modal-overlay").classList.remove("active");
  document.getElementById(modalId).classList.remove("active");
}

function showCombatModal() {
  // Initialize new combat encounter
  gameState.activeCombat = initiateCombat(gameState);
  
  // Set up initial display
  const combat = gameState.activeCombat;
  document.getElementById("combat-title").textContent = 
    `PIRATES: ${combat.pirateName} [${combat.pirateTypeName}]`;
  document.getElementById("combat-description").textContent = 
    `A ${combat.pirateFlavorText} drops out of hyperspace!`;
  
  // Show initial hull values
  document.getElementById("combat-player-hull").textContent = gameState.player.hull;
  document.getElementById("combat-pirate-hull").textContent = combat.pirateHull;
  
  // Clear combat log
  document.getElementById("combat-log").textContent = "";
  
  // Hide loot and continue sections
  document.getElementById("combat-loot").style.display = "none";
  document.getElementById("combat-continue-section").style.display = "none";
  
  // Show action buttons
  document.getElementById("combat-actions").style.display = "flex";
  
  // Set up button handlers
  const bribeCost = randomInt(CONSTANTS.BRIBE_COST_MIN, CONSTANTS.BRIBE_COST_MAX);
  document.getElementById("bribe-cost").textContent = bribeCost;
  
  document.getElementById("combat-attack").onclick = () => handleCombatRound("attack");
  document.getElementById("combat-defend").onclick = () => handleCombatRound("defend");
  document.getElementById("combat-bribe").onclick = () => handleCombatRound("bribe");
  document.getElementById("combat-flee").onclick = () => handleCombatRound("flee");
  
  // Disable bribe button if can't afford
  document.getElementById("combat-bribe").disabled = gameState.player.credits < bribeCost;
  
  showModal("combat-modal");
}

function handleCombatRound(action) {
  const result = resolveCombatRound(gameState, gameState.activeCombat, action);
  
  gameState = result.state;
  gameState.activeCombat = result.combat;
  
  // Update display
  updateCombatDisplay();
  
  // Check if combat is resolved
  if (gameState.activeCombat.resolved) {
    handleCombatResolution();
  }
}

function updateCombatDisplay() {
  const combat = gameState.activeCombat;
  
  // Update hull values
  document.getElementById("combat-player-hull").textContent = Math.max(0, gameState.player.hull);
  document.getElementById("combat-pirate-hull").textContent = Math.max(0, combat.pirateHull);
  
  // Update combat log
  const logText = combat.combatLog.join("\n");
  document.getElementById("combat-log").textContent = logText;
  
  // Scroll to bottom of log
  const logContainer = document.getElementById("combat-log-container");
  logContainer.scrollTop = logContainer.scrollHeight;
}

function handleCombatResolution() {
  const combat = gameState.activeCombat;
  
  // Hide action buttons
  document.getElementById("combat-actions").style.display = "none";
  
  if (combat.outcome === 'victory') {
    // Check if there's loot
    if (combat.pendingLoot) {
      // Show loot decision
      const loot = combat.pendingLoot;
      const commodity = COMMODITIES.find(c => c.id === loot.commodityId);
      const isContraband = commodity.isContraband;
      const warning = isContraband ? " [CONTRABAND - RISKY!]" : "";
      
      document.getElementById("loot-description").textContent = 
        `Salvage: ${loot.amount}x ${loot.commodityName}${warning}. Take it?`;
      
      document.getElementById("loot-take").onclick = handleTakeLoot;
      document.getElementById("loot-leave").onclick = handleLeaveLoot;
      
      // Check if there's space
      const hasSpace = (gameState.player.cargoUsed + loot.amount) <= gameState.player.cargoMax;
      document.getElementById("loot-take").disabled = !hasSpace;
      
      document.getElementById("combat-loot").style.display = "block";
    } else {
      // No loot, just show continue
      showCombatContinue();
    }
  } else if (combat.outcome === 'defeat') {
    // Player died - hide modal and show death modal
    hideModal("combat-modal");
    render();
    showDeathModal();
  } else if (combat.outcome === 'escaped') {
    // Escaped successfully
    logEvent("Escaped from pirates!", "success");
    showCombatContinue();
  }
}

function handleTakeLoot() {
  gameState = acceptLoot(gameState, gameState.activeCombat);
  const loot = gameState.activeCombat.pendingLoot;
  logEvent(`Salvaged ${loot.amount}x ${loot.commodityName}`, "success");
  
  document.getElementById("combat-loot").style.display = "none";
  showCombatContinue();
}

function handleLeaveLoot() {
  logEvent("Left salvage behind", "");
  document.getElementById("combat-loot").style.display = "none";
  showCombatContinue();
}

function showCombatContinue() {
  document.getElementById("combat-continue").onclick = () => {
    hideModal("combat-modal");
    delete gameState.activeCombat;
    render();
  };
  document.getElementById("combat-continue-section").style.display = "flex";
}

function showInspectionModal() {
  const contrabandValue = calculateContrabandValue(gameState);
  const fine = Math.round(contrabandValue * CONSTANTS.INSPECTION_FINE_RATE);
  
  document.getElementById("fine-cost").textContent = fine;
  document.getElementById("inspection-description").textContent = 
    `Contraband detected! Estimated value: ${contrabandValue}cr`;
  
  document.getElementById("inspection-pay").onclick = () => handleInspectionAction("pay");
  document.getElementById("inspection-dump").onclick = () => handleInspectionAction("dump");
  document.getElementById("inspection-resist").onclick = () => handleInspectionAction("resist");
  
  // Disable pay if not enough credits
  document.getElementById("inspection-pay").disabled = gameState.player.credits < fine;
  
  // Disable resist if no weapon
  document.getElementById("inspection-resist").disabled = !gameState.player.upgrades.weapon;
  
  showModal("inspection-modal");
}

function showDeathModal() {
  const stats = gameState.player.stats;
  const netWorth = calculateNetWorth(gameState);
  const retainedCredits = Math.floor(gameState.player.credits * CONSTANTS.DEATH_CREDIT_RETENTION);
  
  document.getElementById("death-stats").innerHTML = `
    Final Net Worth: ${netWorth}cr<br>
    Successful Trades: ${stats.successfulTrades}<br>
    Pirates Defeated: ${stats.piratesDefeated}<br>
    Stations Visited: ${stats.stationsVisited}<br>
    <br>
    Insurance payout: ${retainedCredits}cr<br>
    New ship cost: ${CONSTANTS.RESPAWN_SHIP_COST}cr
  `;
  
  document.getElementById("respawn-cost").textContent = CONSTANTS.RESPAWN_SHIP_COST;
  
  const canRespawn = retainedCredits >= CONSTANTS.RESPAWN_SHIP_COST;
  document.getElementById("death-respawn").disabled = !canRespawn;
  
  document.getElementById("death-respawn").onclick = handleRespawn;
  document.getElementById("death-gameover").onclick = handleGameOver;
  
  showModal("death-modal");
}

function showTravelWarning(destinationId) {
  const destination = STATIONS.find(s => s.id === destinationId);
  const contrabandList = Object.keys(gameState.player.cargo)
    .filter(id => COMMODITIES.find(c => c.id === id && c.contraband))
    .map(id => {
      const commodity = COMMODITIES.find(c => c.id === id);
      const qty = gameState.player.cargo[id];
      return `${qty}x ${commodity.name}`;
    })
    .join(", ");
  
  const inspectionChance = Math.round(getInspectionChance(gameState) * 100);
  
  document.getElementById("travel-warning-text").innerHTML = `
    ${destination.name} enforces contraband laws.<br>
    Carrying: ${contrabandList}<br>
    Inspection chance: ${inspectionChance}%<br>
    <br>
    Proceed anyway?
  `;
  
  document.getElementById("travel-proceed").onclick = () => {
    hideModal("travel-warning-modal");
    completeTravelToDest(destinationId);
  };
  
  document.getElementById("travel-dump").onclick = () => {
    removeAllContraband(gameState);
    logEvent("Dumped all contraband before docking", "warning");
    hideModal("travel-warning-modal");
    completeTravelToDest(destinationId);
  };
  
  document.getElementById("travel-cancel").onclick = () => {
    hideModal("travel-warning-modal");
    pendingTravel = null;
  };
  
  showModal("travel-warning-modal");
}

// === EVENT HANDLERS ===

function handleStationClick(stationId) {
  if (stationId === gameState.player.location) {
    return; // Already here
  }
  
  const route = findRoute(gameState.player.location, stationId);
  if (!route) {
    logEvent("No route to that station!", "danger");
    return;
  }
  
  // Check toll affordability
  const tollFee = route.tollFee || 0;
  if (gameState.player.credits < tollFee) {
    logEvent(`Cannot afford toll! Need ${tollFee}cr.`, "danger");
    return;
  }
  
  // Check for contraband warning
  const destination = STATIONS.find(s => s.id === stationId);
  if (destination.contrabandPolicy === "hostile" && hasContraband(gameState)) {
    pendingTravel = stationId;
    showTravelWarning(stationId);
    return;
  }
  
  completeTravelToDest(stationId);
}

function completeTravelToDest(destinationId) {
  const result = travel(gameState, destinationId);
  
  if (result.error) {
    logEvent(result.error, "danger");
    return;
  }
  
  gameState = result.state;
  
  const destination = STATIONS.find(s => s.id === destinationId);
  const tollMsg = result.tollFee > 0 ? ` (toll: -${result.tollFee}cr)` : '';
  logEvent(`Traveled to ${destination.name}${tollMsg}`);
  
  // Handle events
  if (result.event) {
    if (result.event.type === "pirate") {
      logEvent(result.event.description, "danger");
      showCombatModal();
      return; // Don't render until combat resolved
    } else {
      logEvent(result.event.description, "warning");
    }
  }
  
  // Check for inspection
  if (destination.contrabandPolicy === "hostile" && hasContraband(gameState)) {
    const inspectionChance = getInspectionChance(gameState);
    if (Math.random() < inspectionChance) {
      logEvent("Customs inspection initiated!", "danger");
      showInspectionModal();
      render();
      return;
    }
  }
  
  render();
}

function handleBuy(commodityId, quantity) {
  const commodity = COMMODITIES.find(c => c.id === commodityId);
  const currentStation = STATIONS.find(s => s.id === gameState.player.location);
  const market = gameState.markets[currentStation.id][commodityId];
  
  // Check constraints
  const maxAffordable = Math.floor(gameState.player.credits / market.currentPrice);
  const maxSpace = gameState.player.cargoMax - gameState.player.cargoUsed;
  const actualQuantity = Math.min(quantity, maxAffordable, maxSpace);
  
  if (actualQuantity <= 0) {
    logEvent("Cannot buy: insufficient credits or cargo space", "danger");
    return;
  }
  
  const result = buyCommodity(gameState, commodityId, actualQuantity);
  gameState = result.state;
  
  const totalCost = market.currentPrice * actualQuantity;
  logEvent(`Bought ${actualQuantity}x ${commodity.name} for ${totalCost}cr`);
  
  if (result.event) {
    logEvent(result.event.description, "warning");
  }
  
  render();
}

function handleSell(commodityId, quantity) {
  const commodity = COMMODITIES.find(c => c.id === commodityId);
  const currentStation = STATIONS.find(s => s.id === gameState.player.location);
  const market = gameState.markets[currentStation.id][commodityId];
  
  const playerHas = gameState.player.cargo[commodityId] || 0;
  const actualQuantity = Math.min(quantity, playerHas);
  
  if (actualQuantity <= 0) {
    logEvent("Cannot sell: you don't have any", "danger");
    return;
  }
  
  const result = sellCommodity(gameState, commodityId, actualQuantity);
  gameState = result.state;
  
  const totalRevenue = market.currentPrice * actualQuantity;
  logEvent(`Sold ${actualQuantity}x ${commodity.name} for ${totalRevenue}cr`);
  
  if (result.event) {
    logEvent(result.event.description, "warning");
  }
  
  render();
}

function handleRepair() {
  const hullNeeded = gameState.player.hullMax - gameState.player.hull;
  const cost = hullNeeded * CONSTANTS.HULL_REPAIR_COST_PER_POINT;
  
  if (hullNeeded === 0) {
    logEvent("Hull already at maximum!", "warning");
    return;
  }
  
  if (gameState.player.credits < cost) {
    logEvent("Not enough credits to repair hull!", "danger");
    return;
  }
  
  gameState = repairHull(gameState, hullNeeded);
  logEvent(`Repaired ${hullNeeded} hull points for ${cost}cr`);
  render();
}

function handleDesperateWork() {
  gameState = doDesperateWork(gameState);
  render();
}

function handleBuyUpgrade(upgradeId) {
  const upgrade = UPGRADES.find(u => u.id === upgradeId);
  
  if (gameState.player.credits < upgrade.price) {
    logEvent("Not enough credits!", "danger");
    return;
  }
  
  if (gameState.player.upgrades[upgradeId]) {
    logEvent("Already owned!", "danger");
    return;
  }
  
  gameState = buyUpgrade(gameState, upgradeId);
  logEvent(`Purchased ${upgrade.name} for ${upgrade.price}cr`);
  render();
}

function handleInspectionAction(action) {
  const result = resolveInspection(gameState, action);
  gameState = result.state;
  
  logEvent(result.message, result.outcome === "failure" ? "danger" : "warning");
  hideModal("inspection-modal");
  
  // Check for death
  if (checkDeath(gameState)) {
    render();
    showDeathModal();
    return;
  }
  
  render();
}

function handleRespawn() {
  const result = respawn(gameState);
  
  if (result.gameOver) {
    hideModal("death-modal");
    handleGameOver();
    return;
  }
  
  gameState = result.state;
  logEvent(`Respawned at ${result.respawnLocation}. New ship purchased.`, "warning");
  hideModal("death-modal");
  render();
}

function handleGameOver() {
  hideModal("death-modal");
  
  if (confirm("Game Over! Start a new game?")) {
    init();
  }
}

// === INITIALIZATION ===

function init() {
  gameState = createInitialState();
  const startStation = STATIONS.find(s => s.id === gameState.player.location);
  logEvent(`Game started at ${startStation.name}`);
  logEvent("Buy low, sell high. Watch out for pirates!");
  render();
}

// Make handlers global for onclick attributes
window.handleBuy = handleBuy;
window.handleSell = handleSell;
window.handleRepair = handleRepair;
window.handleDesperateWork = handleDesperateWork;
window.handleBuyUpgrade = handleBuyUpgrade;

window.onload = init;
