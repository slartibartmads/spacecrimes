// Economy Analysis Script
// Verifies pricing balance for the new economy system

import { STATIONS, COMMODITIES, ROUTES } from './shared/data.js';
import { createInitialMarkets } from './server/gameLogic.js';

console.log('=== ECONOMY REBALANCE ANALYSIS ===\n');

// Create actual markets to test the inventory system
const { markets, stationInventories, minorStationModifiers } = createInitialMarkets();

// Helper function to check if a station sells a commodity
function stationSellsCommodity(stationId, commodity) {
  return stationInventories[stationId].includes(commodity.id);
}

// 1. Verify station inventories
console.log('1. CHECKING STATION INVENTORIES...');

const majorStations = STATIONS.filter(s => s.type !== 'minor');
const minorStations = STATIONS.filter(s => s.type === 'minor');

majorStations.forEach(station => {
  const inventory = stationInventories[station.id];
  const availableCommodities = COMMODITIES.filter(c => inventory.includes(c.id));
  console.log(`  ${station.name}: ${availableCommodities.length} commodities`);
  console.log(`    - ${availableCommodities.map(c => c.name).join(', ')}`);
});

console.log(`\n  Minor stations (${minorStations.length}): 4 random commodities each\n`);
minorStations.forEach(station => {
  const inventory = stationInventories[station.id];
  const availableCommodities = COMMODITIES.filter(c => inventory.includes(c.id));
  console.log(`  ${station.name}: ${availableCommodities.map(c => c.name).join(', ')}`);
});
console.log('');

// 2. Check commodity availability across major stations
console.log('2. COMMODITY AVAILABILITY (Major Stations Only):');

COMMODITIES.forEach(commodity => {
  const availableAt = majorStations.filter(s => stationSellsCommodity(s.id, commodity));
  console.log(`  ${commodity.name}: ${availableAt.length} stations`);
  console.log(`    - ${availableAt.map(s => s.name).join(', ')}`);
});
console.log('');

// 3. Calculate best trade routes for each commodity (Major Stations Only)
console.log('3. BEST TRADE ROUTES (by commodity, major stations):');

COMMODITIES.forEach(commodity => {
  let bestProfit = 0;
  let bestRoute = null;
  
  majorStations.forEach(buyStation => {
    majorStations.forEach(sellStation => {
      if (buyStation.id === sellStation.id) return;
      
      // Check if commodity available at both stations
      if (!stationSellsCommodity(buyStation.id, commodity) || 
          !stationSellsCommodity(sellStation.id, commodity)) {
        return;
      }
      
      const buyPrice = markets[buyStation.id][commodity.id].currentPrice;
      const sellPrice = markets[sellStation.id][commodity.id].currentPrice;
      const profit = sellPrice - buyPrice;
      const profitMultiplier = sellPrice / buyPrice;
      
      if (profit > bestProfit) {
        bestProfit = profit;
        bestRoute = {
          commodity: commodity.name,
          from: buyStation.name,
          to: sellStation.name,
          buyPrice,
          sellPrice,
          profitPer: Math.round(profit),
          multiplier: profitMultiplier.toFixed(2)
        };
      }
    });
  });
  
  if (bestRoute) {
    console.log(`  ${commodity.name}:`);
    console.log(`    Buy at ${bestRoute.from} for ${bestRoute.buyPrice}cr`);
    console.log(`    Sell at ${bestRoute.to} for ${bestRoute.sellPrice}cr`);
    console.log(`    Profit: ${bestRoute.profitPer}cr/unit (${bestRoute.multiplier}x)\n`);
  } else {
    console.log(`  ${commodity.name}: No profitable routes found\n`);
  }
});

// 4. Station personality check (using actual market data)
console.log('4. STATION PERSONALITIES (Major Stations):');

majorStations.forEach(station => {
  const inventory = stationInventories[station.id];
  const exports = [];
  const imports = [];
  const neutral = [];
  
  COMMODITIES.forEach(commodity => {
    if (!inventory.includes(commodity.id)) return;
    
    const modifier = station.priceModifiers[commodity.id];
    
    if (modifier <= 0.675) {
      exports.push(`${commodity.name} (${modifier}x)`);
    } else if (modifier >= 1.4) {
      imports.push(`${commodity.name} (${modifier}x)`);
    } else {
      neutral.push(`${commodity.name} (${modifier}x)`);
    }
  });
  
  console.log(`  ${station.name} (${station.contrabandPolicy}):`);
  if (exports.length > 0) {
    console.log(`    Exports: ${exports.join(', ')}`);
  }
  if (imports.length > 0) {
    console.log(`    Imports: ${imports.join(', ')}`);
  }
  if (neutral.length > 0) {
    console.log(`    Neutral: ${neutral.join(', ')}`);
  }
  console.log('');
});

// 5. Route network check
console.log('5. ROUTE NETWORK:');
console.log(`  Total routes: ${ROUTES.length}`);
console.log(`  Routes with tolls: ${ROUTES.filter(r => r.tollFee > 0).length}`);

// Check connectivity
const stationConnections = {};
STATIONS.forEach(s => stationConnections[s.id] = 0);
ROUTES.forEach(route => {
  stationConnections[route.from]++;
});

const sortedConnections = Object.entries(stationConnections).sort((a, b) => b[1] - a[1]);
const mostConnected = STATIONS.find(s => s.id === sortedConnections[0][0]);
const leastConnected = STATIONS.find(s => s.id === sortedConnections[sortedConnections.length - 1][0]);

console.log(`  Most connected: ${mostConnected.name} (${sortedConnections[0][1]} outbound routes)`);
console.log(`  Least connected: ${leastConnected.name} (${sortedConnections[sortedConnections.length - 1][1]} outbound routes)\n`);

console.log('=== ANALYSIS COMPLETE ===');
