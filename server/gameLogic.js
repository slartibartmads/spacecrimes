// server/gameLogic.js
// Pure game logic functions - server-authoritative
// All randomness and state mutations happen here

import {
  STATIONS,
  COMMODITIES,
  ROUTES,
  UPGRADES,
  PIRATE_TYPES,
  COP_TYPES,
  PIRATE_NAMES,
  COMBAT_FLAVOR,
  DESPERATE_WORK_MESSAGES,
  CONSTANTS
} from '../shared/data.js';

// === UTILITY FUNCTIONS ===

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

export function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function randomSample(array, count) {
  const shuffled = [...array].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// === UPGRADE HELPER FUNCTIONS ===

export function getUpgradeTier(player, upgradeId) {
  return player.upgrades[upgradeId] || 0;
}

export function calculateUpgradeCost(upgradeId, currentTier) {
  const upgrade = UPGRADES.find(u => u.id === upgradeId);
  if (!upgrade) return null;
  
  return upgrade.baseCost * Math.pow(upgrade.multiplier, currentTier);
}

export function getPlayerMaxCargo(player) {
  const cargoTier = getUpgradeTier(player, 'cargo');
  const cargoUpgrade = UPGRADES.find(u => u.id === 'cargo');
  return CONSTANTS.STARTING_CARGO_MAX + (cargoTier * cargoUpgrade.effectPerTier);
}

export function getPlayerMaxHull(player) {
  const hullTier = getUpgradeTier(player, 'shields');
  const hullUpgrade = UPGRADES.find(u => u.id === 'shields');
  return CONSTANTS.STARTING_HULL + (hullTier * hullUpgrade.effectPerTier);
}

export function getPlayerAttackBonus(player) {
  const weaponTier = getUpgradeTier(player, 'weapon');
  const weaponUpgrade = UPGRADES.find(u => u.id === 'weapon');
  return weaponTier * weaponUpgrade.effectPerTier;
}

// === PLAYER STATE CREATION ===

export function createPlayerState(username) {
  // Start at a safe station (no cop encounters)
  const safeStations = STATIONS.filter(s => s.contrabandPolicy === 'safe');
  const startingStation = randomChoice(safeStations);
  
  return {
    name: username,
    credits: CONSTANTS.STARTING_CREDITS,
    hull: CONSTANTS.STARTING_HULL,
    hullMax: CONSTANTS.STARTING_HULL,
    cargoMax: CONSTANTS.STARTING_CARGO_MAX,
    cargoUsed: 0,
    location: startingStation.id,
    cargo: {},
    upgrades: { cargo: 0, hull: 0, weapon: 0 },
    stats: {
      totalProfit: 0,
      successfulTrades: 0,
      piratesDefeated: 0,
      stationsVisited: 1,
      contrabandRuns: 0
    },
    reputation: {
      piracyKills: 0,
      bountyKills: 0,
      timesKilled: 0,
      currentBounty: 0
    },
    lastPvpAttack: 0, // Tick number of last PVP attack
    pvpCooldowns: {}, // Map of targetSocketId -> tick number
    activeCombat: null,
    lastAction: null,
    connected: true,
    connectedAt: Date.now(),
    lastSeen: Date.now()
  };
}

// === MARKET INITIALIZATION ===

export function createInitialMarkets() {
  const markets = {};
  const stationInventories = {};
  const minorStationModifiers = {}; // Track random modifiers for minor stations
  
  STATIONS.forEach(station => {
    markets[station.id] = {};
    
    // Determine which commodities this station sells
    let availableCommodities;
    let stationModifiers = {}; // Modifiers to use for this station
    
    if (station.type === 'minor') {
      // Minor stations: 3 random commodities
      availableCommodities = randomSample(COMMODITIES, 3);
      
      // Generate random price modifiers for minor stations (0.85-1.15x)
      // Give 1-2 commodities slight specializations
      const specializedCount = randomInt(1, 2);
      const specializedCommodities = randomSample(availableCommodities, specializedCount);
      
      availableCommodities.forEach(commodity => {
        if (specializedCommodities.includes(commodity)) {
          // Random modifier between 0.85 and 1.15
          stationModifiers[commodity.id] = randomFloat(0.85, 1.15);
        } else {
          stationModifiers[commodity.id] = 1.0;
        }
      });
      
      // Store for later reference
      minorStationModifiers[station.id] = stationModifiers;
    } else {
      // Major stations: 6 commodities - prioritize those with meaningful modifiers (not 1.0)
      const withModifiers = COMMODITIES.filter(c => 
        station.priceModifiers[c.id] !== undefined && 
        station.priceModifiers[c.id] !== 1.0
      );
      const neutral = COMMODITIES.filter(c => 
        station.priceModifiers[c.id] === 1.0
      );
      
      // If we have 6+ non-neutral, use top 6 by how far they deviate from 1.0
      if (withModifiers.length >= 6) {
        // Sort by deviation from 1.0 (most specialized first)
        withModifiers.sort((a, b) => {
          const aDeviation = Math.abs(station.priceModifiers[a.id] - 1.0);
          const bDeviation = Math.abs(station.priceModifiers[b.id] - 1.0);
          return bDeviation - aDeviation;
        });
        availableCommodities = withModifiers.slice(0, 6);
      } else {
        // Use all non-neutral, then fill with random neutral to reach 6
        const needed = 6 - withModifiers.length;
        const selectedNeutral = randomSample(neutral, needed);
        availableCommodities = [...withModifiers, ...selectedNeutral];
      }
      
      stationModifiers = station.priceModifiers;
    }
    
    // Store inventory
    stationInventories[station.id] = availableCommodities.map(c => c.id);
    
    // Create markets only for available commodities
    availableCommodities.forEach(commodity => {
      const basePrice = commodity.basePrice;
      const stationModifier = stationModifiers[commodity.id] || 1.0;
      const variance = 1 + randomFloat(-0.1, 0.1);
      
      markets[station.id][commodity.id] = {
        currentPrice: Math.round(basePrice * stationModifier * variance),
        supply: "normal",
        demand: "normal",
        variance: variance
      };
    });
  });
  
  return { markets, stationInventories, minorStationModifiers };
}

export function addInitialAnomalies(markets, stationInventories, tick) {
  const events = [];
  
  // Shortage
  const shortageStation = randomChoice(STATIONS);
  const availableShortageIds = stationInventories[shortageStation.id] || [];
  const availableShortageCommodities = COMMODITIES.filter(c => availableShortageIds.includes(c.id));
  
  if (availableShortageCommodities.length > 0) {
    const shortageCommodity = randomChoice(availableShortageCommodities);
    markets[shortageStation.id][shortageCommodity.id].supply = "low";
    markets[shortageStation.id][shortageCommodity.id].currentPrice = 
      Math.round(markets[shortageStation.id][shortageCommodity.id].currentPrice * CONSTANTS.SHORTAGE_PRICE_MULT);
    events.push({
      type: "shortage",
      stationId: shortageStation.id,
      commodityId: shortageCommodity.id,
      expiryTick: tick + randomInt(5, 7)
    });
  }

  // Surplus
  const surplusStation = randomChoice(STATIONS);
  const availableSurplusIds = stationInventories[surplusStation.id] || [];
  const availableSurplusCommodities = COMMODITIES.filter(c => availableSurplusIds.includes(c.id));
  
  if (availableSurplusCommodities.length > 0) {
    const surplusCommodity = randomChoice(availableSurplusCommodities);
    markets[surplusStation.id][surplusCommodity.id].supply = "high";
    markets[surplusStation.id][surplusCommodity.id].currentPrice = 
      Math.round(markets[surplusStation.id][surplusCommodity.id].currentPrice * CONSTANTS.SURPLUS_PRICE_MULT);
    events.push({
      type: "glut",
      stationId: surplusStation.id,
      commodityId: surplusCommodity.id,
      expiryTick: tick + randomInt(5, 7)
    });
  }

  // Maybe a price surge
  if (Math.random() > 0.5) {
    const surgeStation = randomChoice(STATIONS);
    const availableSurgeIds = stationInventories[surgeStation.id] || [];
    const availableSurgeCommodities = COMMODITIES.filter(c => availableSurgeIds.includes(c.id));
    
    if (availableSurgeCommodities.length > 0) {
      const surgeCommodity = randomChoice(availableSurgeCommodities);
      markets[surgeStation.id][surgeCommodity.id].demand = "high";
      markets[surgeStation.id][surgeCommodity.id].currentPrice = 
        Math.round(markets[surgeStation.id][surgeCommodity.id].currentPrice * CONSTANTS.SURGE_PRICE_MULT);
      events.push({
        type: "surge",
        stationId: surgeStation.id,
        commodityId: surgeCommodity.id,
        expiryTick: tick + randomInt(3, 5)
      });
    }
  }
  
  return events;
}

// === TICK SYSTEM ===

export function processTick(markets, activeEvents, stationInventories, tick) {
  const newMarkets = deepClone(markets);
  let newEvents = [...activeEvents];
  
  // Expire old events
  newEvents = newEvents.filter(event => {
    // Keep events with no expiry (commodity_reroll) or not yet expired
    if (event.expiryTick === null || event.expiryTick > tick) {
      return true;
    }
    
    // Event expired - restore market to normal
    if (event.type === "shortage" || event.type === "glut") {
      if (newMarkets[event.stationId]?.[event.commodityId]) {
        newMarkets[event.stationId][event.commodityId].supply = "normal";
      }
    } else if (event.type === "surge") {
      if (newMarkets[event.stationId]?.[event.commodityId]) {
        newMarkets[event.stationId][event.commodityId].demand = "normal";
      }
    }
    // spike/drop/boom/recession restoration handled by natural price drift
    // crackdown/safe_passage just expire (no market restoration needed)
    
    return false; // Remove from activeEvents
  });

  // Price drift toward baseline
  STATIONS.forEach(station => {
    COMMODITIES.forEach(commodity => {
      // Skip if commodity not available at this station
      const market = newMarkets[station.id]?.[commodity.id];
      if (!market) return;
      
      const basePrice = commodity.basePrice;
      const stationModifier = station.priceModifiers[commodity.id] || 1.0;
      const targetPrice = basePrice * stationModifier * market.variance;
      
      // Drift 5% toward target
      const drift = (targetPrice - market.currentPrice) * CONSTANTS.PRICE_DRIFT_RATE;
      market.currentPrice = Math.round(market.currentPrice + drift);
    });
  });

  // Random event (7.5% chance)
  let generatedEvent = null;
  if (Math.random() < CONSTANTS.TICK_EVENT_CHANCE) {
    const eventData = generateRandomEvent(newMarkets, newEvents, stationInventories, tick);
    if (eventData) {
      newEvents.push(eventData.event);
      generatedEvent = eventData.description;
    }
  }

  return {
    markets: newMarkets,
    activeEvents: newEvents,
    newEvent: generatedEvent
  };
}

// === EVENT GENERATORS ===

export function generateRandomEvent(markets, activeEvents, stationInventories, tick) {
  const roll = Math.random();
  
  // Weight distribution (must total 1.0):
  // 0.00-0.20 = Price Surge (20%)
  // 0.20-0.35 = Shortage (15%)
  // 0.35-0.50 = Glut (15%)
  // 0.50-0.68 = Commodity Reroll (18%)
  // 0.68-0.83 = Price Spike/Drop (15%)
  // 0.83-0.91 = Station Boom/Recession (8%)
  // 0.91-0.96 = Security Crackdown (5%)
  // 0.96-1.00 = Safe Passage (4%)
  
  if (roll < 0.20) {
    return generatePriceSurge(markets, activeEvents, stationInventories, tick);
  } else if (roll < 0.35) {
    return generateShortage(markets, activeEvents, stationInventories, tick);
  } else if (roll < 0.50) {
    return generateGlut(markets, activeEvents, stationInventories, tick);
  } else if (roll < 0.68) {
    return generateCommodityReroll(markets, activeEvents, stationInventories, tick);
  } else if (roll < 0.83) {
    return generatePriceSpikeOrDrop(markets, activeEvents, stationInventories, tick);
  } else if (roll < 0.91) {
    return generateStationBoomOrRecession(markets, activeEvents, stationInventories, tick);
  } else if (roll < 0.96) {
    return generateSecurityCrackdown(markets, activeEvents, stationInventories, tick);
  } else {
    return generateSafePassage(markets, activeEvents, stationInventories, tick);
  }
}

function generatePriceSurge(markets, activeEvents, stationInventories, tick) {
  const station = randomChoice(STATIONS);
  const availableCommodityIds = stationInventories[station.id] || [];
  const availableCommodities = COMMODITIES.filter(c => availableCommodityIds.includes(c.id));
  
  if (availableCommodities.length === 0) return null;
  
  const commodity = randomChoice(availableCommodities);
  markets[station.id][commodity.id].demand = "high";
  markets[station.id][commodity.id].currentPrice = 
    Math.round(markets[station.id][commodity.id].currentPrice * CONSTANTS.SURGE_PRICE_MULT);
  
  return {
    event: {
      type: "surge",
      stationId: station.id,
      commodityId: commodity.id,
      expiryTick: tick + randomInt(3, 5)
    },
    description: {
      type: "surge",
      message: `<strong>${commodity.name}</strong> demand soaring at <strong>${station.name}</strong>!`,
      stationName: station.name,
      commodityName: commodity.name
    }
  };
}

function generateShortage(markets, activeEvents, stationInventories, tick) {
  const station = randomChoice(STATIONS);
  const availableCommodityIds = stationInventories[station.id] || [];
  const availableCommodities = COMMODITIES.filter(c => availableCommodityIds.includes(c.id));
  
  if (availableCommodities.length === 0) return null;
  
  const commodity = randomChoice(availableCommodities);
  markets[station.id][commodity.id].supply = "low";
  markets[station.id][commodity.id].currentPrice = 
    Math.round(markets[station.id][commodity.id].currentPrice * CONSTANTS.SHORTAGE_PRICE_MULT);
  
  return {
    event: {
      type: "shortage",
      stationId: station.id,
      commodityId: commodity.id,
      expiryTick: tick + randomInt(5, 7)
    },
    description: {
      type: "shortage",
      message: `<strong>${commodity.name}</strong> supply critically low at <strong>${station.name}</strong>!`,
      stationName: station.name,
      commodityName: commodity.name
    }
  };
}

function generateGlut(markets, activeEvents, stationInventories, tick) {
  const station = randomChoice(STATIONS);
  const availableCommodityIds = stationInventories[station.id] || [];
  const availableCommodities = COMMODITIES.filter(c => availableCommodityIds.includes(c.id));
  
  if (availableCommodities.length === 0) return null;
  
  const commodity = randomChoice(availableCommodities);
  markets[station.id][commodity.id].supply = "high";
  markets[station.id][commodity.id].currentPrice = 
    Math.round(markets[station.id][commodity.id].currentPrice * CONSTANTS.SURPLUS_PRICE_MULT);
  
  return {
    event: {
      type: "glut",
      stationId: station.id,
      commodityId: commodity.id,
      expiryTick: tick + randomInt(5, 7)
    },
    description: {
      type: "glut",
      message: `<strong>${commodity.name}</strong> prices crash at <strong>${station.name}</strong>!`,
      stationName: station.name,
      commodityName: commodity.name
    }
  };
}

function generateCommodityReroll(markets, activeEvents, stationInventories, tick) {
  // Pick random minor station
  const minorStations = STATIONS.filter(s => s.type === 'minor');
  if (minorStations.length === 0) return null;
  
  const station = randomChoice(minorStations);
  const oldCommodities = stationInventories[station.id] || [];
  
  // Generate 3 completely new random commodities
  const newCommodities = randomSample(COMMODITIES, 3);
  const newCommodityIds = newCommodities.map(c => c.id);
  
  // Update station inventory
  stationInventories[station.id] = newCommodityIds;
  
  // Remove old commodities from market
  oldCommodities.forEach(commodityId => {
    delete markets[station.id][commodityId];
  });
  
  // Add new commodities with random modifiers
  const newModifiers = {};
  newCommodities.forEach(commodity => {
    const modifier = randomFloat(0.85, 1.15);
    const basePrice = commodity.basePrice;
    const variance = 1 + randomFloat(-0.1, 0.1);
    
    markets[station.id][commodity.id] = {
      currentPrice: Math.round(basePrice * modifier * variance),
      supply: "normal",
      demand: "normal",
      variance: variance
    };
    
    newModifiers[commodity.id] = modifier;
  });
  
  return {
    event: {
      type: "commodity_reroll",
      stationId: station.id,
      expiryTick: null,  // Permanent
      metadata: {
        oldCommodities,
        newCommodities: newCommodityIds,
        newModifiers
      }
    },
    description: {
      type: "commodity_reroll",
      message: `New commodities available at <strong>${station.name}</strong>!`,
      stationId: station.id,
      stationName: station.name,
      oldCommodities: oldCommodities.map(id => COMMODITIES.find(c => c.id === id)?.name).filter(Boolean),
      newCommodities: newCommodities.map(c => c.name)
    }
  };
}

function generatePriceSpikeOrDrop(markets, activeEvents, stationInventories, tick) {
  const station = randomChoice(STATIONS);
  const availableIds = stationInventories[station.id] || [];
  const availableCommodities = COMMODITIES.filter(c => availableIds.includes(c.id));
  
  if (availableCommodities.length === 0) return null;
  
  const commodity = randomChoice(availableCommodities);
  const isSpike = Math.random() < 0.5;
  
  const multiplier = isSpike
    ? randomFloat(CONSTANTS.SPIKE_PRICE_MULT_MIN, CONSTANTS.SPIKE_PRICE_MULT_MAX)
    : randomFloat(CONSTANTS.DROP_PRICE_MULT_MIN, CONSTANTS.DROP_PRICE_MULT_MAX);
  
  markets[station.id][commodity.id].currentPrice = 
    Math.round(markets[station.id][commodity.id].currentPrice * multiplier);
  
  const duration = randomInt(CONSTANTS.SPIKE_DROP_DURATION_MIN, CONSTANTS.SPIKE_DROP_DURATION_MAX);
  
  return {
    event: {
      type: isSpike ? "spike" : "drop",
      stationId: station.id,
      commodityId: commodity.id,
      expiryTick: tick + duration,
      multiplier
    },
    description: {
      type: isSpike ? "spike" : "drop",
      message: isSpike
        ? `<strong>${commodity.name}</strong> prices soaring at <strong>${station.name}</strong>!`
        : `<strong>${commodity.name}</strong> dumped cheap at <strong>${station.name}</strong>!`,
      stationName: station.name,
      commodityName: commodity.name
    }
  };
}

function generateStationBoomOrRecession(markets, activeEvents, stationInventories, tick) {
  const station = randomChoice(STATIONS);
  const availableIds = stationInventories[station.id] || [];
  
  if (availableIds.length === 0) return null;
  
  const isBoom = Math.random() < 0.5;
  const multiplier = isBoom ? CONSTANTS.BOOM_PRICE_MULT : CONSTANTS.RECESSION_PRICE_MULT;
  
  // Apply to ALL commodities at station
  availableIds.forEach(commodityId => {
    if (markets[station.id]?.[commodityId]) {
      markets[station.id][commodityId].currentPrice = 
        Math.round(markets[station.id][commodityId].currentPrice * multiplier);
    }
  });
  
  const duration = randomInt(CONSTANTS.BOOM_RECESSION_DURATION_MIN, CONSTANTS.BOOM_RECESSION_DURATION_MAX);
  
  return {
    event: {
      type: isBoom ? "boom" : "recession",
      stationId: station.id,
      expiryTick: tick + duration,
      multiplier
    },
    description: {
      type: isBoom ? "boom" : "recession",
      message: isBoom
        ? `Sellers' market at <strong>${station.name}</strong>!`
        : `Buyers' market at <strong>${station.name}</strong>!`,
      stationName: station.name
    }
  };
}

function generateSecurityCrackdown(markets, activeEvents, stationInventories, tick) {
  // Only neutral/hostile stations (not safe havens)
  const eligibleStations = STATIONS.filter(
    s => s.contrabandPolicy === 'neutral' || s.contrabandPolicy === 'hostile'
  );
  
  if (eligibleStations.length === 0) return null;
  
  const station = randomChoice(eligibleStations);
  const duration = randomInt(CONSTANTS.CRACKDOWN_DURATION_MIN, CONSTANTS.CRACKDOWN_DURATION_MAX);
  
  console.log(`[EVENT] Security crackdown at ${station.name} (${station.id}) - expires tick ${tick + duration} (duration: ${duration} ticks)`);
  
  return {
    event: {
      type: "crackdown",
      stationId: station.id,
      expiryTick: tick + duration
    },
    description: {
      type: "crackdown",
      message: `Increased patrols at <strong>${station.name}</strong>!`,
      stationName: station.name
    }
  };
}

function generateSafePassage(markets, activeEvents, stationInventories, tick) {
  const station = randomChoice(STATIONS);
  const duration = randomInt(CONSTANTS.SAFE_PASSAGE_DURATION_MIN, CONSTANTS.SAFE_PASSAGE_DURATION_MAX);
  
  return {
    event: {
      type: "safe_passage",
      stationId: station.id,
      expiryTick: tick + duration
    },
    description: {
      type: "safe_passage",
      message: `Safe passage guaranteed at <strong>${station.name}</strong>!`,
      stationName: station.name
    }
  };
}

// Helper for debug panel - generate specific event type
export function generateSpecificEvent(eventType, markets, activeEvents, stationInventories, tick) {
  switch (eventType) {
    case 'price_surge':
    case 'surge':
      return generatePriceSurge(markets, activeEvents, stationInventories, tick);
    case 'shortage':
      return generateShortage(markets, activeEvents, stationInventories, tick);
    case 'glut':
      return generateGlut(markets, activeEvents, stationInventories, tick);
    case 'commodity_reroll':
      return generateCommodityReroll(markets, activeEvents, stationInventories, tick);
    case 'price_spike':
    case 'spike':
      return generatePriceSpike(markets, activeEvents, stationInventories, tick);
    case 'price_drop':
    case 'drop':
      return generatePriceDrop(markets, activeEvents, stationInventories, tick);
    case 'station_boom':
    case 'boom':
      return generateStationBoom(markets, activeEvents, stationInventories, tick);
    case 'station_recession':
    case 'recession':
      return generateStationRecession(markets, activeEvents, stationInventories, tick);
    case 'security_crackdown':
    case 'crackdown':
      return generateSecurityCrackdown(markets, activeEvents, stationInventories, tick);
    case 'safe_passage':
      return generateSafePassage(markets, activeEvents, stationInventories, tick);
    default:
      return null;
  }
}

// Specific generators for debug panel (force spike/drop/boom/recession)
function generatePriceSpike(markets, activeEvents, stationInventories, tick) {
  const station = randomChoice(STATIONS);
  const availableIds = stationInventories[station.id] || [];
  const availableCommodities = COMMODITIES.filter(c => availableIds.includes(c.id));
  
  if (availableCommodities.length === 0) return null;
  
  const commodity = randomChoice(availableCommodities);
  const multiplier = randomFloat(CONSTANTS.SPIKE_PRICE_MULT_MIN, CONSTANTS.SPIKE_PRICE_MULT_MAX);
  
  markets[station.id][commodity.id].currentPrice = 
    Math.round(markets[station.id][commodity.id].currentPrice * multiplier);
  
  const duration = randomInt(CONSTANTS.SPIKE_DROP_DURATION_MIN, CONSTANTS.SPIKE_DROP_DURATION_MAX);
  
  return {
    event: {
      type: "spike",
      stationId: station.id,
      commodityId: commodity.id,
      expiryTick: tick + duration,
      multiplier
    },
    description: {
      type: "spike",
      message: `<strong>${commodity.name}</strong> prices soaring at <strong>${station.name}</strong>!`,
      stationName: station.name,
      commodityName: commodity.name
    }
  };
}

function generatePriceDrop(markets, activeEvents, stationInventories, tick) {
  const station = randomChoice(STATIONS);
  const availableIds = stationInventories[station.id] || [];
  const availableCommodities = COMMODITIES.filter(c => availableIds.includes(c.id));
  
  if (availableCommodities.length === 0) return null;
  
  const commodity = randomChoice(availableCommodities);
  const multiplier = randomFloat(CONSTANTS.DROP_PRICE_MULT_MIN, CONSTANTS.DROP_PRICE_MULT_MAX);
  
  markets[station.id][commodity.id].currentPrice = 
    Math.round(markets[station.id][commodity.id].currentPrice * multiplier);
  
  const duration = randomInt(CONSTANTS.SPIKE_DROP_DURATION_MIN, CONSTANTS.SPIKE_DROP_DURATION_MAX);
  
  return {
    event: {
      type: "drop",
      stationId: station.id,
      commodityId: commodity.id,
      expiryTick: tick + duration,
      multiplier
    },
    description: {
      type: "drop",
      message: `<strong>${commodity.name}</strong> dumped cheap at <strong>${station.name}</strong>!`,
      stationName: station.name,
      commodityName: commodity.name
    }
  };
}

function generateStationBoom(markets, activeEvents, stationInventories, tick) {
  const station = randomChoice(STATIONS);
  const availableIds = stationInventories[station.id] || [];
  
  if (availableIds.length === 0) return null;
  
  const multiplier = CONSTANTS.BOOM_PRICE_MULT;
  
  // Apply to ALL commodities at station
  availableIds.forEach(commodityId => {
    if (markets[station.id]?.[commodityId]) {
      markets[station.id][commodityId].currentPrice = 
        Math.round(markets[station.id][commodityId].currentPrice * multiplier);
    }
  });
  
  const duration = randomInt(CONSTANTS.BOOM_RECESSION_DURATION_MIN, CONSTANTS.BOOM_RECESSION_DURATION_MAX);
  
  return {
    event: {
      type: "boom",
      stationId: station.id,
      expiryTick: tick + duration,
      multiplier
    },
    description: {
      type: "boom",
      message: `Sellers' market at <strong>${station.name}</strong>!`,
      stationName: station.name
    }
  };
}

function generateStationRecession(markets, activeEvents, stationInventories, tick) {
  const station = randomChoice(STATIONS);
  const availableIds = stationInventories[station.id] || [];
  
  if (availableIds.length === 0) return null;
  
  const multiplier = CONSTANTS.RECESSION_PRICE_MULT;
  
  // Apply to ALL commodities at station
  availableIds.forEach(commodityId => {
    if (markets[station.id]?.[commodityId]) {
      markets[station.id][commodityId].currentPrice = 
        Math.round(markets[station.id][commodityId].currentPrice * multiplier);
    }
  });
  
  const duration = randomInt(CONSTANTS.BOOM_RECESSION_DURATION_MIN, CONSTANTS.BOOM_RECESSION_DURATION_MAX);
  
  return {
    event: {
      type: "recession",
      stationId: station.id,
      expiryTick: tick + duration,
      multiplier
    },
    description: {
      type: "recession",
      message: `Buyers' market at <strong>${station.name}</strong>!`,
      stationName: station.name
    }
  };
}

// === TRADING ACTIONS ===

export function buyCommodity(player, markets, commodityId, quantity) {
  const newPlayer = deepClone(player);
  const newMarkets = deepClone(markets);
  
  const commodity = COMMODITIES.find(c => c.id === commodityId);
  if (!commodity) {
    return { success: false, error: 'Invalid commodity' };
  }
  
  const currentStation = STATIONS.find(s => s.id === newPlayer.location);
  if (!currentStation) {
    return { success: false, error: 'Invalid location' };
  }
  
  const market = newMarkets[currentStation.id][commodityId];
  if (!market) {
    return { success: false, error: 'Commodity not available at this station' };
  }
  
  const totalCost = market.currentPrice * quantity;
  
  // Validation
  if (newPlayer.credits < totalCost) {
    return { success: false, error: `Not enough credits (need ${totalCost}cr)` };
  }
  
  if (newPlayer.cargoUsed + quantity > newPlayer.cargoMax) {
    return { success: false, error: 'Not enough cargo space' };
  }
  
  if (quantity <= 0) {
    return { success: false, error: 'Invalid quantity' };
  }
  
  // Deduct credits
  newPlayer.credits -= totalCost;
  
  // Add cargo
  if (!newPlayer.cargo[commodityId]) {
    newPlayer.cargo[commodityId] = 0;
  }
  newPlayer.cargo[commodityId] += quantity;
  newPlayer.cargoUsed += quantity;
  
  // Increase price at current station
  market.currentPrice = Math.round(market.currentPrice * (1 + CONSTANTS.PLAYER_BUY_PRICE_INCREASE));
  
  // Decrease price at connected stations (only if they sell this commodity)
  const connectedStations = getConnectedStations(currentStation.id);
  connectedStations.forEach(stationId => {
    if (newMarkets[stationId] && newMarkets[stationId][commodityId] && newMarkets[stationId][commodityId].currentPrice !== undefined) {
      newMarkets[stationId][commodityId].currentPrice = 
        Math.round(newMarkets[stationId][commodityId].currentPrice * (1 - CONSTANTS.ADJACENT_PRICE_CHANGE));
    }
  });
  
  // Stats
  newPlayer.stats.successfulTrades++;
  if (commodity.contraband) {
    newPlayer.stats.contrabandRuns++;
  }
  
  return {
    success: true,
    playerState: newPlayer,
    markets: newMarkets
  };
}

export function sellCommodity(player, markets, commodityId, quantity) {
  const newPlayer = deepClone(player);
  const newMarkets = deepClone(markets);
  
  const commodity = COMMODITIES.find(c => c.id === commodityId);
  if (!commodity) {
    return { success: false, error: 'Invalid commodity' };
  }
  
  const currentStation = STATIONS.find(s => s.id === newPlayer.location);
  if (!currentStation) {
    return { success: false, error: 'Invalid location' };
  }
  
  const market = newMarkets[currentStation.id][commodityId];
  if (!market) {
    return { success: false, error: 'Commodity not available at this station' };
  }
  
  // Validation
  const currentQuantity = newPlayer.cargo[commodityId] || 0;
  if (currentQuantity < quantity) {
    return { success: false, error: `You only have ${currentQuantity} ${commodityId}` };
  }
  
  if (quantity <= 0) {
    return { success: false, error: 'Invalid quantity' };
  }
  
  const totalRevenue = market.currentPrice * quantity;
  
  // Add credits
  newPlayer.credits += totalRevenue;
  
  // Remove cargo
  newPlayer.cargo[commodityId] -= quantity;
  if (newPlayer.cargo[commodityId] <= 0) {
    delete newPlayer.cargo[commodityId];
  }
  newPlayer.cargoUsed -= quantity;
  
  // Decrease price at current station
  market.currentPrice = Math.round(market.currentPrice * (1 - CONSTANTS.PLAYER_SELL_PRICE_DECREASE));
  
  // Increase price at connected stations (only if they sell this commodity)
  const connectedStations = getConnectedStations(currentStation.id);
  connectedStations.forEach(stationId => {
    if (newMarkets[stationId] && newMarkets[stationId][commodityId] && newMarkets[stationId][commodityId].currentPrice !== undefined) {
      newMarkets[stationId][commodityId].currentPrice = 
        Math.round(newMarkets[stationId][commodityId].currentPrice * (1 + CONSTANTS.ADJACENT_PRICE_CHANGE));
    }
  });
  
  // Stats
  newPlayer.stats.successfulTrades++;
  newPlayer.stats.totalProfit += totalRevenue;
  
  return {
    success: true,
    playerState: newPlayer,
    markets: newMarkets
  };
}

// === TRAVEL ===

export function travel(player, destinationId, markets = {}, activeEvents = []) {
  const newPlayer = deepClone(player);
  
  // Validation
  if (!destinationId) {
    return { success: false, error: 'Destination required' };
  }
  
  const destinationStation = STATIONS.find(s => s.id === destinationId);
  if (!destinationStation) {
    return { success: false, error: 'Invalid destination' };
  }
  
  if (newPlayer.location === destinationId) {
    return { success: false, error: 'Already at this station' };
  }
  
  const route = findRoute(newPlayer.location, destinationId);
  if (!route) {
    return { success: false, error: "No route found" };
  }
  
  // Calculate dynamic toll fee (base + cargo percentage)
  const tollFee = calculateTollFee(route, newPlayer, markets);
  if (tollFee > 0 && newPlayer.credits < tollFee) {
    return { success: false, error: `Not enough credits for toll (need ${tollFee}cr)` };
  }
  
  newPlayer.credits -= tollFee;
  
  // Update location
  newPlayer.location = destinationId;
  newPlayer.stats.stationsVisited++;
  
  // Check for safe passage event
  const hasSafePassage = activeEvents.some(
    e => e.type === 'safe_passage' && 
        (e.stationId === player.location || e.stationId === destinationId)
  );
  
  if (hasSafePassage) {
    // Skip ALL encounter checks (pirates + cops)
    return {
      success: true,
      playerState: newPlayer,
      tollFee,
      safePassage: true
    };
  }
  
  // Calculate total cargo value for risk scaling (all cargo is contraband now)
  const cargoValue = calculateTotalCargoValue(newPlayer, {});
  
  // Check for pirate encounter during travel (value-based risk)
  let pirateChance = CONSTANTS.BASE_PIRATE_CHANCE + (cargoValue * CONSTANTS.CARGO_VALUE_PIRATE_MULTIPLIER);
  pirateChance = Math.min(pirateChance, CONSTANTS.MAX_PIRATE_CHANCE);
  
  const pirateEncounter = Math.random() < pirateChance;
  
  if (pirateEncounter) {
    const combat = initiateCombat(newPlayer);
    newPlayer.activeCombat = combat;
    
    return {
      success: true,
      playerState: newPlayer,
      pirateEncounter: true,
      combat
    };
  }
  
  // Check for cop encounter at destination (value-based risk + bounty scaling)
  // Only at hostile or neutral stations (not safe stations)
  if (destinationStation.contrabandPolicy === 'hostile' || destinationStation.contrabandPolicy === 'neutral') {
    const baseCopChance = destinationStation.contrabandPolicy === 'hostile' 
      ? CONSTANTS.BASE_COP_CHANCE_HOSTILE 
      : CONSTANTS.BASE_COP_CHANCE_NEUTRAL;
    
    // Check for security crackdown
    const crackdownEvents = activeEvents.filter(e => e.type === 'crackdown');
    const hasCrackdown = crackdownEvents.some(e => e.stationId === destinationId);
    
    console.log(`[TRAVEL] Arriving at ${destinationStation.name} (${destinationId}), Active crackdowns:`, crackdownEvents.map(e => e.stationId));
    
    // Add cargo value risk
    let copChance = baseCopChance + (cargoValue * CONSTANTS.CARGO_VALUE_COP_MULTIPLIER);
    
    // Apply crackdown multiplier
    if (hasCrackdown) {
      copChance *= CONSTANTS.CRACKDOWN_COP_MULTIPLIER;
      console.log(`[CRACKDOWN] Active at ${destinationStation.name}: cop chance ${copChance.toFixed(3)} (base: ${baseCopChance}, multiplier: ${CONSTANTS.CRACKDOWN_COP_MULTIPLIER}x)`);
    }
    
    // Add bounty risk (bounty hunter scaling)
    if (newPlayer.reputation && newPlayer.reputation.currentBounty > 0) {
      const bountyRisk = newPlayer.reputation.currentBounty * 0.00002; // 2% chance per 1000cr bounty
      copChance += bountyRisk;
    }
    
    copChance = Math.min(copChance, CONSTANTS.MAX_COP_CHANCE);
    
    const copEncounter = Math.random() < copChance;
    
    if (copEncounter) {
      const combat = initiateCopCombat(newPlayer);
      newPlayer.activeCombat = combat;
      
      return {
        success: true,
        playerState: newPlayer,
        copEncounter: true,
        combat
      };
    }
  }
  
  return {
    success: true,
    playerState: newPlayer,
    tollFee
  };
}

// === COMBAT SYSTEM ===

export function rollPirateType(contrabandValue) {
  if (contrabandValue < CONSTANTS.PIRATE_SCOUT_THRESHOLD) {
    const roll = Math.random();
    if (roll < 0.70) return PIRATE_TYPES[0]; // scout
    else return PIRATE_TYPES[1]; // raider
  } else if (contrabandValue < CONSTANTS.PIRATE_RAIDER_THRESHOLD) {
    const roll = Math.random();
    if (roll < 0.20) return PIRATE_TYPES[0]; // scout
    else if (roll < 0.80) return PIRATE_TYPES[1]; // raider
    else return PIRATE_TYPES[2]; // battleship
  } else {
    const roll = Math.random();
    if (roll < 0.30) return PIRATE_TYPES[1]; // raider
    else return PIRATE_TYPES[2]; // battleship
  }
}

export function rollCopType(cargoValue, playerBounty = 0) {
  // Determine base tier from cargo value
  let baseTier = 0; // 0=drone, 1=frigate, 2=cruiser
  
  if (cargoValue < CONSTANTS.COP_DRONE_THRESHOLD) {
    baseTier = 0;
  } else if (cargoValue < CONSTANTS.COP_FRIGATE_THRESHOLD) {
    baseTier = 1;
  } else {
    baseTier = 2;
  }
  
  // Apply bounty bias (shift toward tougher cops)
  let tierBias = 0;
  if (playerBounty >= 2000) tierBias = 2;      // High bounty = +2 tiers
  else if (playerBounty >= 800) tierBias = 1;  // Medium bounty = +1 tier
  
  const finalTier = Math.min(2, baseTier + tierBias); // Cap at cruiser (tier 2)
  
  // Return cop type based on final tier
  if (finalTier === 0) {
    const roll = Math.random();
    if (roll < 0.70) return COP_TYPES[0]; // drone
    else return COP_TYPES[1]; // frigate
  } else if (finalTier === 1) {
    const roll = Math.random();
    if (roll < 0.20) return COP_TYPES[0]; // drone
    else if (roll < 0.80) return COP_TYPES[1]; // frigate
    else return COP_TYPES[2]; // cruiser
  } else { // finalTier === 2
    const roll = Math.random();
    if (roll < 0.30) return COP_TYPES[1]; // frigate
    else return COP_TYPES[2]; // cruiser (mostly cruisers at high bounty)
  }
}

export function initiateCombat(player) {
  const contrabandValue = calculateContrabandValue(player, {});
  const pirateType = rollPirateType(contrabandValue);
  const pirateName = randomChoice(PIRATE_NAMES);
  const pirateHull = randomInt(pirateType.hullMin, pirateType.hullMax);
  const maxRounds = randomInt(CONSTANTS.COMBAT_ROUNDS_MIN, CONSTANTS.COMBAT_ROUNDS_MAX);
  
  return {
    enemyType: 'pirate',
    pirateName,
    pirateType: pirateType.id,
    pirateTypeName: pirateType.name,
    pirateFlavorText: pirateType.flavorText,
    pirateHull,
    pirateHullMax: pirateHull,
    currentRound: 1,
    maxRounds,
    combatLog: [],
    pendingLoot: null,
    resolved: false,
    outcome: null
  };
}

export function initiateCopCombat(player) {
  const cargoValue = calculateTotalCargoValue(player, {});
  const copType = rollCopType(cargoValue, player.reputation?.currentBounty || 0);
  const copHull = randomInt(copType.hullMin, copType.hullMax);
  const maxRounds = randomInt(CONSTANTS.COMBAT_ROUNDS_MIN, CONSTANTS.COMBAT_ROUNDS_MAX);
  
  return {
    enemyType: 'cop',
    copType: copType.id,
    copTypeName: copType.name,
    copFlavorText: copType.flavorText,
    copHull,
    copHullMax: copHull,
    currentRound: 1,
    maxRounds,
    combatLog: [],
    pendingLoot: null,
    resolved: false,
    outcome: null
  };
}

export function initiatePvpCombat(attacker, defender) {
  const maxRounds = randomInt(CONSTANTS.COMBAT_ROUNDS_MIN, CONSTANTS.COMBAT_ROUNDS_MAX);
  
  return {
    enemyType: 'player',
    opponentSocketId: defender.socketId,
    opponentName: defender.name,
    opponentHull: defender.hull,
    opponentHullMax: defender.hullMax,
    opponentAttackBonus: getPlayerAttackBonus(defender),
    currentRound: 1,
    maxRounds,
    combatLog: [],
    pendingLoot: null,
    resolved: false,
    outcome: null,
    // PVP turn tracking
    attackerAction: null,
    defenderAction: null,
    attackerReady: false,
    defenderReady: false
  };
}

export function resolveCombatRound(player, combatState, action) {
  const newPlayer = deepClone(player);
  const newCombat = deepClone(combatState);
  
  const isCop = newCombat.enemyType === 'cop';
  const isPvp = newCombat.enemyType === 'player';
  const enemyHullKey = isCop ? 'copHull' : (isPvp ? 'opponentHull' : 'pirateHull');
  const enemyName = isCop ? 'cop' : (isPvp ? newCombat.opponentName : 'pirate');
  
  let logEntry = `--- ROUND ${newCombat.currentRound} ---\n`;
  
  // Handle surrender action (cops only)
  if (action === "surrender") {
    if (!isCop) {
      return { success: false, error: 'Can only surrender to cops' };
    }
    
    logEntry += "You power down weapons and open your cargo bay.\n";
    logEntry += "The authorities confiscate all contraband but let you go.\n";
    
    // Remove all cargo (all cargo is contraband)
    newPlayer.cargo = {};
    newPlayer.cargoUsed = 0;
    
    newCombat.combatLog.push(logEntry);
    newCombat.combatLog.push("SURRENDERED. Lost all cargo, but your ship survives.");
    newCombat.resolved = true;
    newCombat.outcome = 'surrendered';
    
    return {
      success: true,
      playerState: newPlayer,
      combatState: newCombat
    };
  }
  
  if (action === "attack") {
    const baseDamage = randomInt(CONSTANTS.ATTACK_DAMAGE_MIN, CONSTANTS.ATTACK_DAMAGE_MAX);
    const weaponBonus = getPlayerAttackBonus(newPlayer);
    const finalPlayerDamage = baseDamage + weaponBonus;
    
    newCombat[enemyHullKey] -= finalPlayerDamage;
    logEntry += randomChoice(COMBAT_FLAVOR.attack_hit) + ` (-${finalPlayerDamage} ${enemyName} hull)\n`;
    
    if (newCombat[enemyHullKey] > 0) {
      const enemyDamage = randomInt(CONSTANTS.ATTACK_DAMAGE_TAKEN_MIN, CONSTANTS.ATTACK_DAMAGE_TAKEN_MAX);
      newPlayer.hull = Math.max(0, newPlayer.hull - enemyDamage);
      
      logEntry += randomChoice(COMBAT_FLAVOR.attack_return) + ` (-${enemyDamage} your hull)\n`;
    }
    
  } else if (action === "bribe") {
    const bribeCost = randomInt(CONSTANTS.BRIBE_COST_MIN, CONSTANTS.BRIBE_COST_MAX);
    
    if (Math.random() < CONSTANTS.BRIBE_SUCCESS_CHANCE) {
      newPlayer.credits -= bribeCost;
      logEntry += randomChoice(COMBAT_FLAVOR.bribe_success) + ` (-${bribeCost}cr)\n`;
      newCombat.resolved = true;
      newCombat.outcome = 'escaped';
    } else {
      newPlayer.credits -= bribeCost;
      let enemyDamage = randomInt(CONSTANTS.ATTACK_DAMAGE_TAKEN_MIN, CONSTANTS.ATTACK_DAMAGE_TAKEN_MAX);
      
      let damageReduction = 0;
      if (newPlayer.upgrades.hull) damageReduction += 0.25;
      if (newPlayer.upgrades.shields) damageReduction += 0.40;
      
      enemyDamage = Math.round(enemyDamage * (1 - damageReduction));
      newPlayer.hull = Math.max(0, newPlayer.hull - enemyDamage);
      
      logEntry += randomChoice(COMBAT_FLAVOR.bribe_fail) + ` (-${bribeCost}cr)\n`;
      logEntry += "They attack while you're vulnerable! " + `(-${enemyDamage} hull)\n`;
    }
    
  } else if (action === "flee") {
    if (Math.random() < CONSTANTS.FLEE_SUCCESS_BASE) {
      logEntry += randomChoice(COMBAT_FLAVOR.flee_success) + "\n";
      newCombat.resolved = true;
      newCombat.outcome = 'escaped';
    } else {
      let enemyDamage = randomInt(CONSTANTS.FLEE_FAIL_DAMAGE_MIN, CONSTANTS.FLEE_FAIL_DAMAGE_MAX);
      
      let damageReduction = 0;
      if (newPlayer.upgrades.hull) damageReduction += 0.25;
      if (newPlayer.upgrades.shields) damageReduction += 0.40;
      
      enemyDamage = Math.round(enemyDamage * (1 - damageReduction));
      newPlayer.hull = Math.max(0, newPlayer.hull - enemyDamage);
      
      logEntry += randomChoice(COMBAT_FLAVOR.flee_fail) + ` (-${enemyDamage} hull!)\n`;
    }
  }
  
  newCombat.combatLog.push(logEntry);
  
  // Check for victory/defeat
  if (newCombat[enemyHullKey] <= 0 && !newCombat.resolved) {
    newCombat.combatLog.push(randomChoice(COMBAT_FLAVOR.victory));
    newCombat.resolved = true;
    newCombat.outcome = 'victory';
    
    if (isPvp) {
      // PVP victory - loot will be handled by socket handler (needs opponent state)
      newCombat.combatLog.push(`\nVICTORY! You've defeated ${enemyName}.`);
      newCombat.combatLog.push(`Prepare to loot their cargo and credits...`);
    } else if (isCop) {
      // Cops now drop loot + credits + ADD BOUNTY
      const creditReward = randomInt(CONSTANTS.COP_VICTORY_CREDITS_MIN, CONSTANTS.COP_VICTORY_CREDITS_MAX);
      newPlayer.credits += creditReward;
      
      // Add bounty for cop killing (integrate with existing reputation system)
      const bountyAmount = randomInt(500, 1200);
      if (!newPlayer.reputation) {
        newPlayer.reputation = {
          piracyKills: 0,
          bountyKills: 0,
          timesKilled: 0,
          currentBounty: 0
        };
      }
      newPlayer.reputation.currentBounty = (newPlayer.reputation.currentBounty || 0) + bountyAmount;
      
      // Track cop kills in stats
      if (!newPlayer.stats.copsKilled) {
        newPlayer.stats.copsKilled = 0;
      }
      newPlayer.stats.copsKilled++;
      
      // Guaranteed tiered loot system (100% drop rate)
      const lootTier = Math.random();
      let salvageAmount, eligibleCommodities;

      if (lootTier < 0.70) {
        // Common (70%): 1-2 units of cheap commodities (≤50cr)
        salvageAmount = randomInt(1, 2);
        eligibleCommodities = COMMODITIES.filter(c => c.basePrice <= 50);
      } else if (lootTier < 0.95) {
        // Uncommon (25%): 2-3 units of mid-tier (51-200cr)
        salvageAmount = randomInt(2, 3);
        eligibleCommodities = COMMODITIES.filter(c => c.basePrice > 50 && c.basePrice <= 200);
      } else {
        // Rare (5%): 3-5 units of expensive (>200cr)
        salvageAmount = randomInt(3, 5);
        eligibleCommodities = COMMODITIES.filter(c => c.basePrice > 200);
      }

      const salvageCommodity = randomChoice(eligibleCommodities);
      newCombat.pendingLoot = {
        commodityId: salvageCommodity.id,
        commodityName: salvageCommodity.name,
        amount: salvageAmount
      };
      
      newCombat.combatLog.push(`\nVICTORY! Seized ${creditReward}cr from enforcement vessel.`);
      newCombat.combatLog.push(`WANTED! Bounty increased by ${bountyAmount}cr (Total: ${newPlayer.reputation.currentBounty}cr)`);
      if (newCombat.pendingLoot) {
        newCombat.combatLog.push(`Salvage detected: ${newCombat.pendingLoot.amount}x ${newCombat.pendingLoot.commodityName}`);
      }
    } else {
      // Pirates can be defeated for stats and drop salvage
      newPlayer.stats.piratesDefeated++;
      
      const creditReward = randomInt(CONSTANTS.VICTORY_CREDITS_MIN, CONSTANTS.VICTORY_CREDITS_MAX);
      newPlayer.credits += creditReward;
      
      // Guaranteed tiered loot system (100% drop rate)
      const lootTier = Math.random();
      let salvageAmount, eligibleCommodities;

      if (lootTier < 0.70) {
        // Common (70%): 1-2 units of cheap commodities (≤50cr)
        salvageAmount = randomInt(1, 2);
        eligibleCommodities = COMMODITIES.filter(c => c.basePrice <= 50);
      } else if (lootTier < 0.95) {
        // Uncommon (25%): 2-3 units of mid-tier (51-200cr)
        salvageAmount = randomInt(2, 3);
        eligibleCommodities = COMMODITIES.filter(c => c.basePrice > 50 && c.basePrice <= 200);
      } else {
        // Rare (5%): 3-5 units of expensive (>200cr)
        salvageAmount = randomInt(3, 5);
        eligibleCommodities = COMMODITIES.filter(c => c.basePrice > 200);
      }

      const salvageCommodity = randomChoice(eligibleCommodities);
      newCombat.pendingLoot = {
        commodityId: salvageCommodity.id,
        commodityName: salvageCommodity.name,
        amount: salvageAmount
      };
      
      newCombat.combatLog.push(`\nVICTORY! Earned ${creditReward}cr.`);
      if (newCombat.pendingLoot) {
        newCombat.combatLog.push(`Salvage detected: ${newCombat.pendingLoot.amount}x ${newCombat.pendingLoot.commodityName}`);
      }
    }
  }
  
  if (newPlayer.hull <= 0 && !newCombat.resolved) {
    newCombat.combatLog.push(randomChoice(COMBAT_FLAVOR.defeat));
    newCombat.resolved = true;
    newCombat.outcome = 'defeat';
  }
  
  if (!newCombat.resolved) {
    newCombat.currentRound++;
  }
  
  return {
    success: true,
    playerState: newPlayer,
    combatState: newCombat
  };
}

/**
 * Resolve a PVP round simultaneously with both players' actions
 * Returns updated states for both attacker and defender
 */
export function resolvePvpRound(attacker, defender, attackerCombat, attackerAction, defenderAction) {
  const newAttacker = deepClone(attacker);
  const newDefender = deepClone(defender);
  const newCombat = deepClone(attackerCombat);
  
  let logEntry = `--- ROUND ${newCombat.currentRound} ---\n`;
  
  // Track damage dealt to each player
  let attackerDamage = 0;
  let defenderDamage = 0;
  
  // Handle special cases first (flee/bribe)
  let attackerFled = false;
  let defenderFled = false;
  
  // Process flee/bribe actions
  if (attackerAction === 'flee') {
    if (Math.random() < CONSTANTS.FLEE_SUCCESS_BASE) {
      logEntry += `${newAttacker.name} ${randomChoice(COMBAT_FLAVOR.flee_success)}\n`;
      attackerFled = true;
    } else {
      const damage = randomInt(CONSTANTS.FLEE_FAIL_DAMAGE_MIN, CONSTANTS.FLEE_FAIL_DAMAGE_MAX);
      let damageReduction = 0;
      if (newAttacker.upgrades.hull) damageReduction += 0.25;
      if (newAttacker.upgrades.shields) damageReduction += 0.40;
      attackerDamage += Math.round(damage * (1 - damageReduction));
      logEntry += `${newAttacker.name} ${randomChoice(COMBAT_FLAVOR.flee_fail)} (-${attackerDamage} hull)\n`;
    }
  } else if (attackerAction === 'bribe') {
    const bribeCost = randomInt(CONSTANTS.BRIBE_COST_MIN, CONSTANTS.BRIBE_COST_MAX);
    if (Math.random() < CONSTANTS.BRIBE_SUCCESS_CHANCE) {
      newAttacker.credits -= bribeCost;
      logEntry += `${newAttacker.name} ${randomChoice(COMBAT_FLAVOR.bribe_success)} (-${bribeCost}cr)\n`;
      attackerFled = true;
    } else {
      newAttacker.credits -= bribeCost;
      const damage = randomInt(CONSTANTS.ATTACK_DAMAGE_TAKEN_MIN, CONSTANTS.ATTACK_DAMAGE_TAKEN_MAX);
      let damageReduction = 0;
      if (newAttacker.upgrades.hull) damageReduction += 0.25;
      if (newAttacker.upgrades.shields) damageReduction += 0.40;
      attackerDamage += Math.round(damage * (1 - damageReduction));
      logEntry += `${newAttacker.name} ${randomChoice(COMBAT_FLAVOR.bribe_fail)} (-${bribeCost}cr, -${attackerDamage} hull)\n`;
    }
  }
  
  if (defenderAction === 'flee') {
    if (Math.random() < CONSTANTS.FLEE_SUCCESS_BASE) {
      logEntry += `${newDefender.name} ${randomChoice(COMBAT_FLAVOR.flee_success)}\n`;
      defenderFled = true;
    } else {
      const damage = randomInt(CONSTANTS.FLEE_FAIL_DAMAGE_MIN, CONSTANTS.FLEE_FAIL_DAMAGE_MAX);
      let damageReduction = 0;
      if (newDefender.upgrades.hull) damageReduction += 0.25;
      if (newDefender.upgrades.shields) damageReduction += 0.40;
      defenderDamage += Math.round(damage * (1 - damageReduction));
      logEntry += `${newDefender.name} ${randomChoice(COMBAT_FLAVOR.flee_fail)} (-${defenderDamage} hull)\n`;
    }
  } else if (defenderAction === 'bribe') {
    const bribeCost = randomInt(CONSTANTS.BRIBE_COST_MIN, CONSTANTS.BRIBE_COST_MAX);
    if (Math.random() < CONSTANTS.BRIBE_SUCCESS_CHANCE) {
      newDefender.credits -= bribeCost;
      logEntry += `${newDefender.name} ${randomChoice(COMBAT_FLAVOR.bribe_success)} (-${bribeCost}cr)\n`;
      defenderFled = true;
    } else {
      newDefender.credits -= bribeCost;
      const damage = randomInt(CONSTANTS.ATTACK_DAMAGE_TAKEN_MIN, CONSTANTS.ATTACK_DAMAGE_TAKEN_MAX);
      let damageReduction = 0;
      if (newDefender.upgrades.hull) damageReduction += 0.25;
      if (newDefender.upgrades.shields) damageReduction += 0.40;
      defenderDamage += Math.round(damage * (1 - damageReduction));
      logEntry += `${newDefender.name} ${randomChoice(COMBAT_FLAVOR.bribe_fail)} (-${bribeCost}cr, -${defenderDamage} hull)\n`;
    }
  }
  
  // If either player fled successfully, combat ends
  if (attackerFled || defenderFled) {
    newCombat.combatLog.push(logEntry);
    newCombat.resolved = true;
    newCombat.outcome = 'escaped';
    
    newAttacker.hull = Math.max(0, newAttacker.hull - attackerDamage);
    newDefender.hull = Math.max(0, newDefender.hull - defenderDamage);
    
    return {
      success: true,
      attacker: newAttacker,
      defender: newDefender,
      combatState: newCombat
    };
  }
  
  // Calculate simultaneous attack/defend damage
  const attackerWeaponBonus = getPlayerAttackBonus(newAttacker);
  const defenderWeaponBonus = getPlayerAttackBonus(newDefender);
  
  // Attacker's action against defender
  if (attackerAction === 'attack') {
    const baseDamage = randomInt(CONSTANTS.ATTACK_DAMAGE_MIN, CONSTANTS.ATTACK_DAMAGE_MAX);
    const damage = baseDamage + attackerWeaponBonus;
    defenderDamage += damage;
    logEntry += `${newAttacker.name} ${randomChoice(COMBAT_FLAVOR.attack_hit)} (-${damage} to ${newDefender.name})\n`;
  } else if (attackerAction === 'defend') {
    const damage = randomInt(CONSTANTS.DEFEND_DAMAGE_MIN, CONSTANTS.DEFEND_DAMAGE_MAX);
    defenderDamage += damage;
    logEntry += `${newAttacker.name} ${randomChoice(COMBAT_FLAVOR.defend_chip)} (-${damage} to ${newDefender.name})\n`;
  }
  
  // Defender's action against attacker
  if (defenderAction === 'attack') {
    const baseDamage = randomInt(CONSTANTS.ATTACK_DAMAGE_MIN, CONSTANTS.ATTACK_DAMAGE_MAX);
    const damage = baseDamage + defenderWeaponBonus;
    attackerDamage += damage;
    logEntry += `${newDefender.name} ${randomChoice(COMBAT_FLAVOR.attack_hit)} (-${damage} to ${newAttacker.name})\n`;
  } else if (defenderAction === 'defend') {
    const damage = randomInt(CONSTANTS.DEFEND_DAMAGE_MIN, CONSTANTS.DEFEND_DAMAGE_MAX);
    attackerDamage += damage;
    logEntry += `${newDefender.name} ${randomChoice(COMBAT_FLAVOR.defend_chip)} (-${damage} to ${newAttacker.name})\n`;
  }
  
  // Apply damage with upgrade bonuses
  let attackerDamageReduction = 0;
  if (newAttacker.upgrades.hull) attackerDamageReduction += 0.25;
  if (newAttacker.upgrades.shields) attackerDamageReduction += 0.40;
  attackerDamage = Math.round(attackerDamage * (1 - attackerDamageReduction));
  
  let defenderDamageReduction = 0;
  if (newDefender.upgrades.hull) defenderDamageReduction += 0.25;
  if (newDefender.upgrades.shields) defenderDamageReduction += 0.40;
  defenderDamage = Math.round(defenderDamage * (1 - defenderDamageReduction));
  
  newAttacker.hull = Math.max(0, newAttacker.hull - attackerDamage);
  newDefender.hull = Math.max(0, newDefender.hull - defenderDamage);
  
  // Update combat state with defender's current hull
  newCombat.opponentHull = newDefender.hull;
  
  newCombat.combatLog.push(logEntry);
  
  // Check for victory/defeat
  if (newDefender.hull <= 0 && newAttacker.hull > 0) {
    newCombat.combatLog.push(randomChoice(COMBAT_FLAVOR.victory));
    newCombat.combatLog.push(`\nVICTORY! You've defeated ${newDefender.name}.`);
    newCombat.combatLog.push(`Prepare to loot their cargo and credits...`);
    newCombat.resolved = true;
    newCombat.outcome = 'victory';
  } else if (newAttacker.hull <= 0 && newDefender.hull > 0) {
    newCombat.combatLog.push(randomChoice(COMBAT_FLAVOR.defeat));
    newCombat.resolved = true;
    newCombat.outcome = 'defeat';
  } else if (newAttacker.hull <= 0 && newDefender.hull <= 0) {
    // Both died - mutual destruction (defender wins by default in PVP)
    newCombat.combatLog.push("MUTUAL DESTRUCTION! Both ships are destroyed!");
    newCombat.resolved = true;
    newCombat.outcome = 'defeat';
  }
  
  if (!newCombat.resolved) {
    newCombat.currentRound++;
    // Reset turn tracking for next round
    newCombat.attackerAction = null;
    newCombat.defenderAction = null;
    newCombat.attackerReady = false;
    newCombat.defenderReady = false;
  }
  
  return {
    success: true,
    attacker: newAttacker,
    defender: newDefender,
    combatState: newCombat
  };
}

export function acceptLoot(player, combatState) {
  const newPlayer = deepClone(player);
  
  if (!combatState.pendingLoot) {
    return { 
      success: true, 
      playerState: newPlayer,
      message: 'No loot to collect'
    };
  }
  
  const loot = combatState.pendingLoot;
  if (!newPlayer.cargo[loot.commodityId]) {
    newPlayer.cargo[loot.commodityId] = 0;
  }
  newPlayer.cargo[loot.commodityId] += loot.amount;
  newPlayer.cargoUsed += loot.amount;
  
  return { 
    success: true, 
    playerState: newPlayer,
    message: `Collected ${loot.amount}x ${loot.commodityName}`
  };
}

// === OTHER ACTIONS ===

export function buyUpgrade(player, upgradeId) {
  const newPlayer = deepClone(player);
  const upgrade = UPGRADES.find(u => u.id === upgradeId);
  
  if (!upgrade) {
    return { success: false, error: 'Invalid upgrade' };
  }
  
  // Get current tier (defaults to 0 if not set)
  const currentTier = getUpgradeTier(newPlayer, upgradeId);
  
  // Check if at max tier
  if (currentTier >= upgrade.maxTier) {
    return { success: false, error: 'Already at maximum tier' };
  }
  
  // Calculate cost for next tier
  const cost = calculateUpgradeCost(upgradeId, currentTier);
  
  if (newPlayer.credits < cost) {
    return { success: false, error: `Not enough credits (need ${cost}cr)` };
  }
  
  // Deduct credits and increment tier
  newPlayer.credits -= cost;
  newPlayer.upgrades[upgradeId] = currentTier + 1;
  
  // Apply effects based on upgrade type
  if (upgrade.effectType === 'capacity') {
    newPlayer.cargoMax = getPlayerMaxCargo(newPlayer);
  }
  
  if (upgrade.effectType === 'hull') {
    const newMaxHull = getPlayerMaxHull(newPlayer);
    const hullIncrease = newMaxHull - newPlayer.hullMax;
    newPlayer.hullMax = newMaxHull;
    newPlayer.hull += hullIncrease; // Also increase current hull
  }
  
  // Weapon upgrade doesn't affect player state directly - applied in combat
  
  return { success: true, playerState: newPlayer };
}

export function repairHull(player) {
  const newPlayer = deepClone(player);
  const hullNeeded = newPlayer.hullMax - newPlayer.hull;
  
  if (hullNeeded <= 0) {
    return { success: false, error: 'Hull already at maximum' };
  }
  
  const cost = hullNeeded * CONSTANTS.HULL_REPAIR_COST_PER_POINT;
  
  if (newPlayer.credits < cost) {
    return { success: false, error: `Not enough credits (need ${cost}cr)` };
  }
  
  newPlayer.credits -= cost;
  newPlayer.hull = newPlayer.hullMax;
  
  return { success: true, playerState: newPlayer, cost, amount: hullNeeded };
}

export function doDesperateWork(player) {
  const newPlayer = deepClone(player);
  const payout = randomInt(CONSTANTS.DESPERATE_WORK_PAYOUT.min, CONSTANTS.DESPERATE_WORK_PAYOUT.max);
  const message = randomChoice(DESPERATE_WORK_MESSAGES);
  
  newPlayer.credits += payout;
  
  return { success: true, playerState: newPlayer, earned: payout, message };
}

export function resolveInspection(player, action) {
  const newPlayer = deepClone(player);
  const contrabandValue = calculateContrabandValue(newPlayer, {});
  
  if (action === "pay") {
    const fine = Math.round(contrabandValue * CONSTANTS.INSPECTION_FINE_RATE);
    newPlayer.credits -= fine;
    return {
      success: true,
      playerState: newPlayer,
      outcome: "paid",
      message: `Paid fine of ${fine}cr. Kept contraband.`
    };
  } else if (action === "dump") {
    removeAllContraband(newPlayer);
    return {
      success: true,
      playerState: newPlayer,
      outcome: "dumped",
      message: "Dumped all contraband. No fine."
    };
  } else if (action === "resist") {
    if (Math.random() < 0.6) {
      return {
        success: true,
        playerState: newPlayer,
        outcome: "success",
        message: "Resisted inspection! Escaped with contraband."
      };
    } else {
      const fine = Math.round(contrabandValue * CONSTANTS.INSPECTION_FINE_RATE);
      newPlayer.credits -= fine;
      
      const hullDamage = randomInt(15, 30);
      newPlayer.hull = Math.max(0, newPlayer.hull - hullDamage);
      
      return {
        success: true,
        playerState: newPlayer,
        outcome: "failure",
        message: `Resist failed! Took ${hullDamage} hull damage and ${fine}cr fine.`
      };
    }
  }
}

export function checkDeath(player) {
  const isDead = player.hull <= 0;
  return { 
    success: true,
    isDead,
    playerState: player
  };
}

export function respawn(player) {
  const newPlayer = deepClone(player);
  
  // Respawn at a random station
  const randomStation = STATIONS[Math.floor(Math.random() * STATIONS.length)];
  
  // Check if player died in combat (activeCombat still exists)
  const diedInCombat = newPlayer.activeCombat !== null;
  
  if (diedInCombat) {
    // Killed in combat - respawn with starting credits
    newPlayer.credits = CONSTANTS.STARTING_CREDITS;
  } else {
    // Died from other causes (e.g., desperate work) - use retention mechanic
    const retainedCredits = Math.floor(newPlayer.credits * CONSTANTS.DEATH_CREDIT_RETENTION);
    const finalCredits = Math.max(retainedCredits, CONSTANTS.RESPAWN_SHIP_COST);
    
    if (finalCredits < CONSTANTS.RESPAWN_SHIP_COST) {
      return { 
        success: false, 
        error: 'Game Over - Not enough credits to respawn',
        gameOver: true 
      };
    }
    
    newPlayer.credits = finalCredits - CONSTANTS.RESPAWN_SHIP_COST;
  }
  
  newPlayer.hull = CONSTANTS.STARTING_HULL;
  newPlayer.hullMax = CONSTANTS.STARTING_HULL;
  newPlayer.cargoMax = CONSTANTS.STARTING_CARGO_MAX;
  newPlayer.cargoUsed = 0;
  newPlayer.cargo = {};
  newPlayer.upgrades = { cargo: 0, hull: 0, weapon: 0 };
  newPlayer.location = randomStation.id;
  newPlayer.activeCombat = null;
  
  // Void bounty on death (reset to 0)
  if (newPlayer.reputation) {
    newPlayer.reputation.currentBounty = 0;
  }
  
  return { 
    success: true,
    playerState: newPlayer, 
    gameOver: false, 
    respawnLocation: randomStation.name 
  };
}

// === HELPER FUNCTIONS ===

export function getConnectedStations(stationId) {
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

export function findRoute(fromId, toId) {
  const direct = ROUTES.find(r => 
    (r.from === fromId && r.to === toId) || 
    (r.to === fromId && r.from === toId)
  );
  if (direct) return direct;
  return null;
}

export function findNearestStation(fromId) {
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
  
  return STATIONS[0];
}

export function loseRandomCargo(player, amount) {
  const cargoItems = Object.keys(player.cargo);
  let remaining = amount;
  
  while (remaining > 0 && cargoItems.length > 0) {
    const randomItem = randomChoice(cargoItems);
    const available = player.cargo[randomItem];
    const toLose = Math.min(remaining, available);
    
    player.cargo[randomItem] -= toLose;
    player.cargoUsed -= toLose;
    remaining -= toLose;
    
    if (player.cargo[randomItem] <= 0) {
      delete player.cargo[randomItem];
      cargoItems.splice(cargoItems.indexOf(randomItem), 1);
    }
  }
}

export function calculateContrabandValue(player, markets) {
  let total = 0;
  const currentStation = STATIONS.find(s => s.id === player.location);
  
  Object.keys(player.cargo).forEach(commodityId => {
    const commodity = COMMODITIES.find(c => c.id === commodityId);
    if (commodity.contraband) {
      const quantity = player.cargo[commodityId];
      // If markets not provided (during combat init), use base price
      const price = markets[currentStation?.id]?.[commodityId]?.currentPrice || commodity.basePrice;
      total += quantity * price;
    }
  });
  
  return total;
}

// Calculate total cargo value (all cargo is contraband now)
export function calculateTotalCargoValue(player, markets) {
  let total = 0;
  const currentStation = STATIONS.find(s => s.id === player.location);
  
  Object.keys(player.cargo).forEach(commodityId => {
    const commodity = COMMODITIES.find(c => c.id === commodityId);
    const quantity = player.cargo[commodityId];
    // If markets not provided (during combat init), use base price
    const price = markets[currentStation?.id]?.[commodityId]?.currentPrice || commodity.basePrice;
    total += quantity * price;
  });
  
  return total;
}

/**
 * Calculate toll fee for a route based on base toll + cargo value percentage
 */
export function calculateTollFee(route, player, markets) {
  const baseToll = route.tollFee || 0;
  if (baseToll === 0) return 0;
  
  const cargoValue = calculateTotalCargoValue(player, markets);
  const cargoFee = Math.floor(cargoValue * CONSTANTS.TOLL_CARGO_PERCENTAGE);
  
  return baseToll + cargoFee;
}

export function removeAllContraband(player) {
  Object.keys(player.cargo).forEach(commodityId => {
    const commodity = COMMODITIES.find(c => c.id === commodityId);
    if (commodity.contraband) {
      const quantity = player.cargo[commodityId];
      player.cargoUsed -= quantity;
      delete player.cargo[commodityId];
    }
  });
}

export function hasContraband(player) {
  return Object.keys(player.cargo).some(commodityId => {
    const commodity = COMMODITIES.find(c => c.id === commodityId);
    return commodity.contraband;
  });
}

export function getInspectionChance(player) {
  let chance = CONSTANTS.BASE_INSPECTION_CHANCE;
  
  // Note: scanner and fakemanifest upgrades don't exist in current game
  // Keeping this function for future use
  
  return Math.max(chance, 0.05);
}

export function calculateNetWorth(player, markets) {
  let worth = player.credits;
  
  // Add cargo value
  const currentStation = STATIONS.find(s => s.id === player.location);
  if (currentStation && markets && markets[currentStation.id]) {
    Object.keys(player.cargo).forEach(commodityId => {
      const quantity = player.cargo[commodityId];
      if (markets[currentStation.id][commodityId]) {
        const price = markets[currentStation.id][commodityId].currentPrice;
        worth += quantity * price;
      }
    });
  }
  
  // Add upgrade value (sum of costs for all tiers purchased)
  Object.keys(player.upgrades).forEach(upgradeId => {
    const tier = player.upgrades[upgradeId];
    const upgrade = UPGRADES.find(u => u.id === upgradeId);
    if (upgrade && tier > 0) {
      // Calculate total cost for all tiers: baseCost * (multiplier^0 + multiplier^1 + ... + multiplier^(tier-1))
      for (let i = 0; i < tier; i++) {
        worth += upgrade.baseCost * Math.pow(upgrade.multiplier, i);
      }
    }
  });
  
  return Math.round(worth);
}

// === PVP HELPER FUNCTIONS ===

export function handlePvpVictory(attacker, defender, markets) {
  const newAttacker = deepClone(attacker);
  const newDefender = deepClone(defender);
  
  // Calculate loot
  const stolenCredits = Math.floor(defender.credits * 0.2); // 20% of credits
  const cargoLootPercent = randomInt(30, 50) / 100; // 30-50% of cargo
  const stolenCargo = {};
  let stolenCargoValue = 0;
  
  // Steal random cargo items
  Object.keys(defender.cargo).forEach(commodityId => {
    const quantity = defender.cargo[commodityId];
    const stolenAmount = Math.floor(quantity * cargoLootPercent);
    if (stolenAmount > 0) {
      stolenCargo[commodityId] = stolenAmount;
      // Calculate value for activity log
      const currentStation = STATIONS.find(s => s.id === defender.location);
      const price = markets[currentStation.id][commodityId].currentPrice;
      stolenCargoValue += stolenAmount * price;
    }
  });
  
  // Apply loot to attacker
  newAttacker.credits += stolenCredits;
  Object.keys(stolenCargo).forEach(commodityId => {
    if (!newAttacker.cargo[commodityId]) {
      newAttacker.cargo[commodityId] = 0;
    }
    newAttacker.cargo[commodityId] += stolenCargo[commodityId];
    newAttacker.cargoUsed += stolenCargo[commodityId];
  });
  
  // Update attacker reputation
  newAttacker.reputation.piracyKills++;
  newAttacker.reputation.currentBounty += 500; // Base bounty for attacking
  if (defender.hull <= 0) {
    newAttacker.reputation.currentBounty += 1000; // Additional for kill
  }
  
  // Update defender state
  newDefender.credits -= stolenCredits;
  Object.keys(stolenCargo).forEach(commodityId => {
    newDefender.cargo[commodityId] -= stolenCargo[commodityId];
    newDefender.cargoUsed -= stolenCargo[commodityId];
    if (newDefender.cargo[commodityId] <= 0) {
      delete newDefender.cargo[commodityId];
    }
  });
  
  // Defender takes damage but doesn't die/respawn from PVP
  if (newDefender.hull <= 0) {
    newDefender.hull = 1; // Leave them alive with 1 hull
    newDefender.reputation.timesKilled++;
  }
  
  // Clear combat state for both players
  newAttacker.activeCombat = null;
  newDefender.activeCombat = null;
  
  return {
    attacker: newAttacker,
    defender: newDefender,
    loot: {
      credits: stolenCredits,
      cargo: stolenCargo,
      cargoValue: stolenCargoValue
    }
  };
}

export function handlePvpDefeat(attacker, defender) {
  // Attacker loses - they face full death penalty
  const newAttacker = deepClone(attacker);
  const newDefender = deepClone(defender);
  
  // Attacker takes damage but we handle death separately via checkDeath()
  // Make sure defender doesn't have negative hull
  if (newDefender.hull <= 0) {
    newDefender.hull = 1; // Leave them alive with 1 hull
    newDefender.reputation.timesKilled++;
  }
  
  // Defender gets bounty reward if attacker had one
  if (attacker.reputation.currentBounty >= 1000) {
    const bountyReward = Math.floor(attacker.reputation.currentBounty * 0.5);
    newDefender.credits += bountyReward;
    newDefender.reputation.bountyKills++;
    newDefender.reputation.currentBounty = Math.max(0, newDefender.reputation.currentBounty - 200);
  }
  
  // Clear combat state for both players
  newAttacker.activeCombat = null;
  newDefender.activeCombat = null;
  
  return {
    attacker: newAttacker,
    defender: newDefender,
    bountyReward: attacker.reputation.currentBounty >= 1000 ? Math.floor(attacker.reputation.currentBounty * 0.5) : 0
  };
}

