// Space Drugwars - Static Game Data
// All stations, commodities, routes, and upgrades

const STATIONS = [
  // === MAJOR STATIONS (6) ===
  // INNER SYSTEM - High enforcement, central hub
  {
    id: "fort_attrition",
    name: "Fort Attrition",
    type: "military",
    description: "Authorized personnel only. High enforcement publicly, corrupt underneath.",
    position: { x: 176, y: 44 },
    contrabandPolicy: "hostile",
    priceModifiers: {
      "credentials": 0.8,     // Mid-tier export
      "weapons": 0.8,         // Mid-tier export (was minor)
      "organs": 1.0,          // Neutral
      "ai_chips": 1.15,       // High-tier import
      "booze": 1.3,           // Low-tier import
      "croakers": 1.0,        // Neutral
      "cognex": 1.0,          // Neutral
      "crank": 1.0            // Neutral
    }
  },
  {
    id: "caveat_emptor",
    name: "Caveat Emptor",
    type: "trading",
    description: "Black market trading hub. Tolerates everything, enforces nothing.",
    position: { x: 382, y: 86 },
    contrabandPolicy: "safe",
    priceModifiers: {
      "credentials": 0.8,     // Mid-tier export
      "crank": 0.8,           // Mid-tier export
      "cognex": 1.0,          // Neutral
      "organs": 1.15,         // High-tier import
      "weapons": 1.2,         // Mid-tier import
      "croakers": 1.0,        // Neutral
      "booze": 1.0,           // Neutral
      "ai_chips": 1.0         // Neutral
    }
  },
  
  // MID SYSTEM - Mixed enforcement, industrial
  {
    id: "vice_berth",
    name: "Vice Berth",
    type: "entertainment",
    description: "Pleasure and entertainment station. Tolerates all vices, suspicious of credentials.",
    position: { x: 226, y: 271 },
    contrabandPolicy: "safe",
    priceModifiers: {
      "croakers": 0.7,        // Low-tier export
      "booze": 0.7,           // Low-tier export
      "crank": 1.2,           // Mid-tier import
      "organs": 1.15,         // High-tier import
      "cognex": 1.0,          // Neutral
      "credentials": 1.0,     // Neutral
      "weapons": 1.0,         // Neutral
      "ai_chips": 1.0         // Neutral
    }
  },
  {
    id: "disruptive_smelting",
    name: "Disruptive Smelting Solutions",
    type: "industrial",
    description: "Industrial mining and refining. Rough crowd, corporate management.",
    position: { x: 413, y: 254 },
    contrabandPolicy: "neutral",
    priceModifiers: {
      "weapons": 0.8,         // Mid-tier export
      "organs": 0.85,         // High-tier export
      "cognex": 1.2,          // Mid-tier import
      "credentials": 1.2,     // Mid-tier import
      "croakers": 1.0,        // Neutral
      "booze": 1.0,           // Neutral
      "crank": 1.0,           // Neutral
      "ai_chips": 1.0         // Neutral
    }
  },
  
  // OUTER SYSTEM - Lawless frontier
  {
    id: "nuevo_eden",
    name: "Nuevo Eden",
    type: "agricultural",
    description: "Agricultural colony. Wholesome veneer, thriving drug trade underneath.",
    position: { x: 144, y: 472 },
    contrabandPolicy: "neutral",
    priceModifiers: {
      "booze": 0.7,           // Low-tier export
      "croakers": 0.7,        // Low-tier export
      "crank": 1.0,           // Neutral
      "ai_chips": 1.15,       // High-tier import
      "weapons": 1.2,         // Mid-tier import
      "cognex": 1.0,          // Neutral
      "credentials": 1.0,     // Neutral
      "organs": 1.0           // Neutral
    }
  },
  {
    id: "makinen_tanaka",
    name: "Mäkinen-Tanaka Institute",
    type: "research",
    description: "Research station. Cold, clinical, no questions asked about methods.",
    position: { x: 318, y: 489 },
    contrabandPolicy: "safe",
    priceModifiers: {
      "ai_chips": 0.85,       // High-tier export
      "cognex": 0.8,          // Mid-tier export
      "organs": 1.15,         // High-tier import
      "credentials": 1.2,     // Mid-tier import
      "croakers": 1.0,        // Neutral
      "booze": 1.0,           // Neutral
      "crank": 1.0,           // Neutral
      "weapons": 1.0          // Neutral
    }
  },
  {
    id: "cosmobank",
    name: "The Mattress",
    type: "banking",
    description: "Secure vault station. Store your credits safely... for a small fee.",
    position: { x: 490, y: 380 },
    contrabandPolicy: "safe",
    priceModifiers: {}  // No commodities traded here
  },
  
  // === MINOR STATIONS (12) ===
  // INNER SYSTEM (4 minor stations)
  {
    id: "minor_8",
    name: "Apex Station",
    type: "minor",
    description: "Small independent outpost",
    position: { x: 369, y: 18 },
    contrabandPolicy: "safe",
    priceModifiers: {}
  },
  {
    id: "minor_11",
    name: "Cinder Post",
    type: "minor",
    description: "Forgotten waypoint station",
    position: { x: 109, y: 82 },
    contrabandPolicy: "safe",
    priceModifiers: {}
  },
  {
    id: "minor_9",
    name: "Fractured Berth",
    type: "minor",
    description: "Damaged but functional dock",
    position: { x: 456, y: 128 },
    contrabandPolicy: "safe",
    priceModifiers: {}
  },
  {
    id: "minor_10",
    name: "Relay Prime",
    type: "minor",
    description: "Communications relay turned trading post",
    position: { x: 255, y: 159 },
    contrabandPolicy: "neutral",
    priceModifiers: {}
  },
  
  // MID SYSTEM (4 minor stations)
  {
    id: "minor_1",
    name: "Rusted Depot",
    type: "minor",
    description: "Aging supply station",
    position: { x: 95, y: 244 },
    contrabandPolicy: "safe",
    priceModifiers: {}
  },
  {
    id: "minor_3",
    name: "Crimson Anchorage",
    type: "minor",
    description: "Blood-stained refueling station",
    position: { x: 312, y: 246 },
    contrabandPolicy: "safe",
    priceModifiers: {}
  },
  {
    id: "minor_5",
    name: "Salvage Haven",
    type: "minor",
    description: "Scrappers and outlaws welcome",
    position: { x: 77, y: 478 },
    contrabandPolicy: "safe",
    priceModifiers: {}
  },
  {
    id: "minor_7",
    name: "Scorched Point",
    type: "minor",
    description: "Damaged by solar flare, still operational",
    position: { x: 455, y: 510 },
    contrabandPolicy: "safe",
    priceModifiers: {}
  },
  
  // OUTER SYSTEM (4 minor stations)
  {
    id: "minor_2",
    name: "Phantom Junction",
    type: "minor",
    description: "Barely shows on scanners",
    position: { x: 293, y: 334 },
    contrabandPolicy: "safe",
    priceModifiers: {}
  },
  {
    id: "minor_4",
    name: "Void Terminal",
    type: "minor",
    description: "Last stop before deep space",
    position: { x: 211, y: 415 },
    contrabandPolicy: "safe",
    priceModifiers: {}
  },
  {
    id: "minor_6",
    name: "Drifter Nexus",
    type: "minor",
    description: "Nomad fleet gathering point",
    position: { x: 240, y: 529 },
    contrabandPolicy: "safe",
    priceModifiers: {}
  },
  {
    id: "minor_12",
    name: "Wreck Hub",
    type: "minor",
    description: "Built from salvaged ship parts",
    position: { x: 491, y: 246 },
    contrabandPolicy: "safe",
    priceModifiers: {}
  },
];

const COMMODITIES = [
  // Tier 1 - Low Heat
  {
    id: "croakers",
    name: "Untaxed Cowboy Croakers",
    basePrice: 10,
    contraband: true,
    description: "Unfiltered, untaxed, unforgivable"
  },
  {
    id: "booze",
    name: "Black Label Swill",
    basePrice: 50,
    contraband: true,
    description: "Bootleg whiskey that burns twice"
  },
  // Tier 2 - Medium Heat
  {
    id: "cognex",
    name: "Counterfeit Cognex",
    basePrice: 300,
    contraband: true,
    description: "Prescription amphetamines, no prescription required"
  },
  {
    id: "credentials",
    name: "Cloned Cipher Cores",
    basePrice: 650,
    contraband: true,
    description: "Stolen credentials for sale or rent"
  },
  {
    id: "weapons",
    name: "Surplus Atrocities",
    basePrice: 1200,
    contraband: true,
    description: "Military-grade weapons, civilian-grade violence"
  },
  {
    id: "crank",
    name: "Pulsar Crank",
    basePrice: 2000,
    contraband: true,
    description: "Methamphetamine that'll make you see gods"
  },
  // Tier 3 - High Heat
  {
    id: "organs",
    name: "Pre-Owned Organs",
    basePrice: 2500,
    contraband: true,
    description: "Gently used, previous owner no longer needs them"
  },
  {
    id: "ai_chips",
    name: "Sentient AI Chips",
    basePrice: 3500,
    contraband: true,
    description: "Enslaved consciousness in silicon form"
  }
];

const ROUTES = [
  // Cinder Post (minor_11) ↔ Fort Attrition
  { from: "minor_11", to: "fort_attrition" },
  { from: "fort_attrition", to: "minor_11" },
  // Fort Attrition ↔ Relay Prime (minor_10)
  { from: "fort_attrition", to: "minor_10" },
  { from: "minor_10", to: "fort_attrition" },
  // Fort Attrition ↔ Apex Station (minor_8)
  { from: "fort_attrition", to: "minor_8" },
  { from: "minor_8", to: "fort_attrition" },
  // Caveat Emptor ↔ Apex Station (minor_8)
  { from: "caveat_emptor", to: "minor_8" },
  { from: "minor_8", to: "caveat_emptor" },
  // Caveat Emptor ↔ Relay Prime (minor_10)
  { from: "caveat_emptor", to: "minor_10" },
  { from: "minor_10", to: "caveat_emptor" },
  // Caveat Emptor ↔ Fractured Berth (minor_9)
  { from: "caveat_emptor", to: "minor_9" },
  { from: "minor_9", to: "caveat_emptor" },
  // Fractured Berth (minor_9) ↔ Wreck Hub (minor_12)
  { from: "minor_9", to: "minor_12" },
  { from: "minor_12", to: "minor_9" },
  // Wreck Hub (minor_12) ↔ Disruptive Smelting Solutions
  { from: "minor_12", to: "disruptive_smelting" },
  { from: "disruptive_smelting", to: "minor_12" },
  // Disruptive Smelting Solutions ↔ Crimson Anchorage (minor_3)
  { from: "disruptive_smelting", to: "minor_3" },
  { from: "minor_3", to: "disruptive_smelting" },
  // Disruptive Smelting Solutions ↔ Mäkinen-Tanaka Institute (TOLL)
  { from: "disruptive_smelting", to: "makinen_tanaka", tollFee: 125 },
  { from: "makinen_tanaka", to: "disruptive_smelting", tollFee: 125 },
  // Crimson Anchorage (minor_3) ↔ Relay Prime (minor_10)
  { from: "minor_3", to: "minor_10" },
  { from: "minor_10", to: "minor_3" },
  // Crimson Anchorage (minor_3) ↔ Phantom Junction (minor_2)
  { from: "minor_3", to: "minor_2" },
  { from: "minor_2", to: "minor_3" },
  // Vice Berth ↔ Rusted Depot (minor_1)
  { from: "vice_berth", to: "minor_1" },
  { from: "minor_1", to: "vice_berth" },
  // Vice Berth ↔ Phantom Junction (minor_2)
  { from: "vice_berth", to: "minor_2" },
  { from: "minor_2", to: "vice_berth" },
  // Rusted Depot (minor_1) ↔ Salvage Haven (minor_5)
  { from: "minor_1", to: "minor_5" },
  { from: "minor_5", to: "minor_1" },
  // Nuevo Eden ↔ Salvage Haven (minor_5)
  { from: "nuevo_eden", to: "minor_5" },
  { from: "minor_5", to: "nuevo_eden" },
  // Nuevo Eden ↔ Void Terminal (minor_4)
  { from: "nuevo_eden", to: "minor_4" },
  { from: "minor_4", to: "nuevo_eden" },
  // Mäkinen-Tanaka Institute ↔ Drifter Nexus (minor_6)
  { from: "makinen_tanaka", to: "minor_6" },
  { from: "minor_6", to: "makinen_tanaka" },
  // Mäkinen-Tanaka Institute ↔ Scorched Point (minor_7)
  { from: "makinen_tanaka", to: "minor_7" },
  { from: "minor_7", to: "makinen_tanaka" },
  // Void Terminal (minor_4) ↔ Phantom Junction (minor_2)
  { from: "minor_4", to: "minor_2" },
  { from: "minor_2", to: "minor_4" },
  // Void Terminal (minor_4) ↔ Drifter Nexus (minor_6)
  { from: "minor_4", to: "minor_6" },
  { from: "minor_6", to: "minor_4" },
  // Fort Attrition ↔ Vice Berth (TOLL)
  { from: "fort_attrition", to: "vice_berth", tollFee: 125 },
  { from: "vice_berth", to: "fort_attrition", tollFee: 125 },
  // The Mattress (cosmobank) ↔ Mäkinen-Tanaka Institute
  { from: "cosmobank", to: "makinen_tanaka" },
  { from: "makinen_tanaka", to: "cosmobank" },
  // The Mattress (cosmobank) ↔ Scorched Point (minor_7)
  { from: "cosmobank", to: "minor_7" },
  { from: "minor_7", to: "cosmobank" }
];

const UPGRADES = [
  {
    id: "cargo",
    name: "Cargo",
    baseCost: 250,
    multiplier: 2,
    maxTier: 5,
    effectPerTier: 5,
    description: "+5 Cargo Capacity",
    effectType: 'capacity'
  },
  {
    id: "shields",
    name: "Shields",
    baseCost: 300,
    multiplier: 2,
    maxTier: 5,
    effectPerTier: 20,
    description: "+20 Shields",
    effectType: 'hull'
  },
  {
    id: "weapon",
    name: "Weapons",
    baseCost: 400,
    multiplier: 2,
    maxTier: 5,
    effectPerTier: 15,
    description: "+15 Firepower",
    effectType: 'weapon'
  }
];

// Pirate types with different hull ranges
const PIRATE_TYPES = [
  {
    id: "scout",
    name: "Scout",
    hullMin: 38,
    hullMax: 63,
    flavorText: "ragtag junker with patched hull plating"
  },
  {
    id: "raider",
    name: "Raider",
    hullMin: 63,
    hullMax: 100,
    flavorText: "armed freighter bristling with weapons"
  },
  {
    id: "battleship",
    name: "Battleship",
    hullMin: 100,
    hullMax: 150,
    flavorText: "military-grade vessel with shield signatures"
  }
];

// Cop types with different hull ranges (scaled to cargo value)
const COP_TYPES = [
  {
    id: "drone",
    name: "Patrol Drone",
    hullMin: 50,
    hullMax: 75,
    flavorText: "automated enforcement unit with basic scanners"
  },
  {
    id: "frigate",
    name: "Customs Frigate",
    hullMin: 75,
    hullMax: 113,
    flavorText: "government vessel with interdiction protocols"
  },
  {
    id: "cruiser",
    name: "Enforcement Cruiser",
    hullMin: 113,
    hullMax: 163,
    flavorText: "heavy law enforcement warship with warrant authority"
  }
];

// Pirate ship names
const PIRATE_NAMES = [
  "The Rusty Scalpel",
  "Void Rats",
  "Chrome Syndicate",
  "The Bone Collector",
  "Plasma Junkies",
  "Narco Nomads",
  "The Flayed Angel",
  "Syphilis Mary",
  "Organ Grinders",
  "The Screaming Void",
  "Kidney Thieves",
  "Death's Accountant",
  "The Festering Wound",
  "Cosmic Jackals",
  "The Bleeding Edge",
  "Entropy's Children",
  "The Cancerous Growth",
  "Scavenger Kings",
  "The Putrid Hand",
  "Neural Pirates"
];

// Combat flavor text for different actions
const COMBAT_FLAVOR = {
  attack_hit: [
    "Your cannons tear into their hull!",
    "Direct hit! Their shields flicker and fail!",
    "You blast their engine cowling! Debris everywhere!",
    "Plasma lances shred their cargo bay!",
    "Critical strike! Their life support vents atmosphere!",
    "Your missiles find their mark! Explosions ripple across their hull!"
  ],
  attack_return: [
    "They return fire! Your hull shudders!",
    "Their turrets rake your ship! Shields straining!",
    "Enemy missiles impact! Hull breach on deck 2!",
    "They counterattack! Your cargo bay takes a hit!",
    "Their plasma cannons sear your hull plating!",
    "They strafe your ship! Warning klaxons blaring!"
  ],
  defend_success: [
    "You turtle up. Their shots glance off reinforced plating.",
    "Evasive maneuvers! Most of their fire misses.",
    "Shields holding! You weather the barrage.",
    "You roll ship. Their lasers score only superficial hits.",
    "Defensive posture. You tank the damage and hold position.",
    "You redirect power to shields. Their attack fizzles."
  ],
  defend_chip: [
    "You chip away with point-defense turrets.",
    "Your return fire is conservative but steady.",
    "You land a few defensive pot-shots.",
    "Your automated turrets score minor hits.",
    "You suppress their advance with warning shots.",
    "Careful aim. You damage their sensors."
  ],
  bribe_success: [
    "They take your credits and disengage. Honor among thieves.",
    "Payment accepted. They warp away counting their money.",
    "The captain laughs. 'Pleasure doing business.' They vanish.",
    "Credits transferred. They power down weapons and leave.",
    "They grab the bribe and run. Smart pirates.",
    "Transaction complete. They retreat to safer targets."
  ],
  bribe_fail: [
    "They take your money AND attack anyway! No honor!",
    "The pirate laughs. 'Not enough!' They open fire!",
    "Bribe rejected! 'We're taking everything!' Weapons hot!",
    "'Cute. We'll take that AND your cargo!' Ambush!",
    "They pocket the credits then attack. Bastards!",
    "'Thanks for the down payment!' Treacherous scum!"
  ],
  flee_success: [
    "Emergency warp! You vanish into hyperspace!",
    "You jettison decoy cargo and escape into the void!",
    "Overload engines! You outrun their pursuit!",
    "Smoke screen deployed! You slip away in the chaos!",
    "You broadcast false coordinates and warp to safety!",
    "Quick thinking! You dive into an asteroid field and lose them!"
  ],
  flee_fail: [
    "Failed to flee! They rake your engines as you turn!",
    "Warp drive misfires! They punish your retreat!",
    "You can't shake them! Devastating hit to your stern!",
    "Escape attempt failed! Caught with your shields down!",
    "Your engines sputter! They exploit your vulnerability!",
    "They cut you off! Brutal counterattack!"
  ],
  victory: [
    "Their ship breaks apart! You win!",
    "Enemy vessel destroyed! Debris field expanding!",
    "They eject escape pods! Victory!",
    "Hull breach! They're done for! Victory!",
    "Final explosion! Pirates eliminated!",
    "Their ship goes dark. You win this round!"
  ],
  defeat: [
    "Your hull buckles! Critical systems failing!",
    "Catastrophic damage! Ship breaking apart!",
    "Life support failing! You're done!",
    "Too much damage! Ship destroyed!",
    "Final impact! Everything goes dark...",
    "Hull integrity: 0%. Ship lost!"
  ]
};

// Desperate work flavor messages
const DESPERATE_WORK_MESSAGES = [
  "Sorted recycled organs. The supervisor didn't ask questions.",
  "Cleaned waste reclamation tanks. The smell is permanent.",
  "Smuggled contraband for station boss. Don't make eye contact.",
  "Scrubbed blood off the airlock. Whose blood? Don't ask.",
  "Tested experimental pharmaceuticals. Vision stabilizing...",
  "Loaded cargo for crime syndicate. Saw nothing. Remember nothing.",
  "Repaired life support in condemned sector. Heard... things.",
  "Delivered packages. Contents unknown. Ticking stopped eventually.",
  "Worked the soylent processing line. It's better not to know.",
  "Bagged bodies for the morgue. Some were still warm.",
  "Assisted back-alley surgeon. The screaming finally stopped.",
  "Cleaned up crime scene. No questions, no witnesses.",
  "Tested weaponized viruses. Side effects may include...",
  "Hauled toxic waste. Geiger counter spiked. Probably fine.",
  "Guarded illegal shipment. Didn't look inside. Didn't ask.",
  "Harvested organs from expired clones. Totally legal. Probably.",
  "Worked the slave labor mines. Union busted decades ago.",
  "Collected debts for loan shark. Broke some kneecaps.",
  "Ran drugs for cartel. Nice people. Very nice people.",
  "Participated in medical experiment. Growing extra fingers now."
];

// Game constants
const CONSTANTS = {
  STARTING_CREDITS: 500,
  STARTING_HULL: 100,
  STARTING_CARGO_MAX: 5,
  
  // Value-based risk scaling (all cargo is contraband now)
  BASE_PIRATE_CHANCE: 0.05,                    // 5% base chance
  CARGO_VALUE_PIRATE_MULTIPLIER: 0.00003,      // +0.003% per credit of cargo value
  MAX_PIRATE_CHANCE: 0.50,                     // 50% max cap
  
  BASE_COP_CHANCE_HOSTILE: 0.10,               // 10% base at hostile stations
  BASE_COP_CHANCE_NEUTRAL: 0.025,              // 2.5% base at neutral (25% of hostile)
  CARGO_VALUE_COP_MULTIPLIER: 0.00004,         // +0.004% per credit of cargo value
  MAX_COP_CHANCE: 0.60,                        // 60% max cap
  
  // Legacy inspection constants (will be removed once cop combat is fully implemented)
  BASE_INSPECTION_CHANCE: 0.30,
  INSPECTION_FINE_RATE: 0.50,
  
  TICK_EVENT_CHANCE: 0.02,                     // 2% chance per tick
  PRICE_DRIFT_RATE: 0.025,                     // Slower drift (was 0.05)
  
  // Transaction spreads (bid-ask spread to prevent pump-and-dump)
  BUY_MARKUP: 0.05,                            // Players pay 5% above market price when buying
  SELL_MARKDOWN: 0.05,                         // Players receive 5% below market price when selling
  
  PLAYER_BUY_PRICE_INCREASE: 0.04,
  PLAYER_SELL_PRICE_DECREASE: 0.04,
  ADJACENT_PRICE_CHANGE: 0.015,
  
  DEATH_CREDIT_RETENTION: 0.30,
  RESPAWN_SHIP_COST: 500,
  
  LEGAL_VARIANCE: 0.20,
  CONTRABAND_VARIANCE: 0.10,                   // Reduced variance (was 0.40) since modifiers provide variation
  
  // Event price multipliers
  SHORTAGE_PRICE_MULT: 1.4,
  SURPLUS_PRICE_MULT: 0.7,
  SURGE_PRICE_MULT: 1.5,
  SPIKE_PRICE_MULT_MIN: 1.5,
  SPIKE_PRICE_MULT_MAX: 1.8,
  DROP_PRICE_MULT_MIN: 0.4,
  DROP_PRICE_MULT_MAX: 0.6,
  BOOM_PRICE_MULT: 1.2,                        // +20%
  RECESSION_PRICE_MULT: 0.8,                   // -20%
  
  // Event durations
  SPIKE_DROP_DURATION_MIN: 2,
  SPIKE_DROP_DURATION_MAX: 4,
  BOOM_RECESSION_DURATION_MIN: 4,
  BOOM_RECESSION_DURATION_MAX: 6,
  CRACKDOWN_DURATION_MIN: 3,
  CRACKDOWN_DURATION_MAX: 5,
  SAFE_PASSAGE_DURATION_MIN: 2,
  SAFE_PASSAGE_DURATION_MAX: 3,
  
  // Event modifiers
  CRACKDOWN_COP_MULTIPLIER: 2.5,               // 2.5x cop encounter chance during crackdown
  
  // Combat - Multi-round system
  COMBAT_ROUNDS_MIN: 2,
  COMBAT_ROUNDS_MAX: 3,
  
  // Player combat actions
  ATTACK_DAMAGE_MIN: 20,
  ATTACK_DAMAGE_MAX: 35,
  ATTACK_DAMAGE_TAKEN_MIN: 15,
  ATTACK_DAMAGE_TAKEN_MAX: 30,
  
  // Pirate difficulty scaling based on cargo value
  PIRATE_SCOUT_THRESHOLD: 500,      // < 500cr cargo = scouts likely
  PIRATE_RAIDER_THRESHOLD: 2000,    // 500-2000cr = raiders likely
  // > 2000cr cargo = battleships likely
  
  // Cop difficulty scaling based on cargo value
  COP_DRONE_THRESHOLD: 1000,        // < 1000cr cargo = patrol drones
  COP_FRIGATE_THRESHOLD: 3000,      // 1000-3000cr = customs frigates
  // > 3000cr cargo = enforcement cruisers
  
  // Wealth-based encounter scaling (late-game balance)
  WEALTH_ENCOUNTER_MULTIPLIER: 0.00001,     // +0.001% encounter chance per 1cr net worth
  WEALTH_TIER_THRESHOLD_LOW: 5000,          // First tier bias threshold
  WEALTH_TIER_THRESHOLD_HIGH: 15000,        // Second tier bias threshold
  
  BRIBE_COST_MIN: 200,
  BRIBE_COST_MAX: 500,
  BRIBE_SUCCESS_CHANCE: 0.75,
  
  FLEE_SUCCESS_BASE: 0.25,
  FLEE_FAIL_DAMAGE_MIN: 50,
  FLEE_FAIL_DAMAGE_MAX: 80,
  
  // Victory rewards
  VICTORY_CREDITS_MIN: 50,
  VICTORY_CREDITS_MAX: 150,
  SALVAGE_CHANCE: 1.0,
  SALVAGE_AMOUNT_MIN: 1,
  SALVAGE_AMOUNT_MAX: 3,
  
  // Cop victory rewards (credits only, no salvage)
  COP_VICTORY_CREDITS_MIN: 100,
  COP_VICTORY_CREDITS_MAX: 300,
  
  // Legacy damage constants (for old flee/fight outcomes if needed)
  HULL_DAMAGE_MIN: 20,
  HULL_DAMAGE_MAX: 40,
  CARGO_LOSS_MIN: 0.10,
  CARGO_LOSS_MAX: 0.30,
  
  HULL_REPAIR_COST_PER_POINT: 5,
  
  DESPERATE_WORK_PAYOUT: { min: 5, max: 15 },
  DESPERATE_WORK_THRESHOLD: 100,
  
  // Toll system - base toll + percentage of cargo value
  TOLL_CARGO_PERCENTAGE: 0.05  // 5% of cargo value added to base toll
};

// Banking configuration
export const BANK_CONFIG = {
  MINIMUM_DEPOSIT: 1,
  MINIMUM_WITHDRAWAL: 1
};

// Export for ES modules (Node.js server)
export {
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
};
