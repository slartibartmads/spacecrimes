// Quick test to verify combat/inspection logic
import { CONSTANTS } from './shared/data.js';

console.log('=== COMBAT & INSPECTION CHANCES ===');
console.log('Base pirate chance:', CONSTANTS.BASE_PIRATE_CHANCE);
console.log('Contraband pirate bonus:', CONSTANTS.CONTRABAND_PIRATE_BONUS);
console.log('Total with contraband:', CONSTANTS.BASE_PIRATE_CHANCE + CONSTANTS.CONTRABAND_PIRATE_BONUS);
console.log('Base inspection chance:', CONSTANTS.BASE_INSPECTION_CHANCE);
console.log('');
console.log('=== SIMULATING 100 TRAVELS WITH CONTRABAND ===');

let pirateCount = 0;
let inspectionCount = 0;

for (let i = 0; i < 100; i++) {
  const pirateChance = CONSTANTS.BASE_PIRATE_CHANCE + CONSTANTS.CONTRABAND_PIRATE_BONUS;
  const hasPirates = Math.random() < pirateChance;
  
  if (hasPirates) {
    pirateCount++;
  } else {
    // Only check inspection if no pirates
    const hasInspection = Math.random() < CONSTANTS.BASE_INSPECTION_CHANCE;
    if (hasInspection) {
      inspectionCount++;
    }
  }
}

console.log(`Pirates encountered: ${pirateCount}/100 (expected ~30)`);
console.log(`Inspections encountered: ${inspectionCount}/100 (expected ~21)`);
console.log(`Safe travels: ${100 - pirateCount - inspectionCount}/100`);
