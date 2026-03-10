// Space Drugwars - Static Game Data
// All stations, commodities, routes, and upgrades

const STATIONS = [
  {
    id: "alpha",
    name: "Debt Colony 7",
    type: "mining",
    description: "Mining quotas enforced. Escape clause in fine print.",
    position: { x: 125, y: 200 },
    contrabandPolicy: "hostile",
    priceModifiers: {
      "cigs": 1.1,
      "media": 1.2,
      "electronics": 0.6,
      "pharma": 1.4,
      "weapons": 1.0,
      "narcotics": 1.0,
      "artifacts": 1.0,
      "stolentech": 1.0
    }
  },
  {
    id: "beta",
    name: "Soylent Prime",
    type: "agricultural",
    description: "Sustainable protein production. Don't ask questions.",
    position: { x: 550, y: 200 },
    contrabandPolicy: "hostile",
    priceModifiers: {
      "cigs": 0.7,
      "media": 0.6,
      "electronics": 1.3,
      "pharma": 1.4,
      "weapons": 0.9,
      "narcotics": 1.0,
      "artifacts": 1.0,
      "stolentech": 1.0
    }
  },
  {
    id: "delta",
    name: "TechBro Farms",
    type: "tech",
    description: "Disrupting industries. Evading regulations.",
    position: { x: 300, y: 10 },
    contrabandPolicy: "hostile",
    priceModifiers: {
      "cigs": 1.2,
      "media": 1.3,
      "electronics": 1.1,
      "pharma": 0.6,
      "weapons": 0.8,
      "narcotics": 1.0,
      "artifacts": 1.0,
      "stolentech": 0.7
    }
  },
  {
    id: "epsilon",
    name: "Caveat Emptor",
    type: "trading",
    description: "Ask no questions, hear no lies",
    position: { x: 300, y: 260 },
    contrabandPolicy: "neutral",
    priceModifiers: {
      "cigs": 1.0,
      "media": 1.0,
      "electronics": 1.0,
      "pharma": 1.0,
      "weapons": 1.0,
      "narcotics": 1.1,
      "artifacts": 1.1,
      "stolentech": 1.1
    }
  },
  {
    id: "gamma",
    name: "Smog Factory Gamma",
    type: "industrial",
    description: "Building tomorrow's problems, today",
    position: { x: 440, y: 320 },
    contrabandPolicy: "neutral",
    priceModifiers: {
      "cigs": 1.1,
      "media": 1.2,
      "electronics": 0.8,
      "pharma": 0.9,
      "weapons": 1.1,
      "narcotics": 1.2,
      "artifacts": 0.8,
      "stolentech": 1.0
    }
  },
  {
    id: "zeta",
    name: "Anarchy Void",
    type: "lawless",
    description: "No laws, no taxes, no guarantees",
    position: { x: 360, y: 440 },
    contrabandPolicy: "safe",
    priceModifiers: {
      "cigs": 1.3,
      "media": 1.4,
      "electronics": 1.2,
      "pharma": 1.3,
      "weapons": 1.5,
      "narcotics": 0.7,
      "artifacts": 0.6,
      "stolentech": 0.7
    }
  },
  {
    id: "theta",
    name: "Lab Rat Central",
    type: "research",
    description: "Progress requires sacrifice. Usually yours.",
    position: { x: 150, y: 500 },
    contrabandPolicy: "safe",
    priceModifiers: {
      "cigs": 1.2,
      "media": 1.3,
      "electronics": 1.4,
      "pharma": 0.8,
      "weapons": 0.5,
      "narcotics": 1.3,
      "artifacts": 1.2,
      "stolentech": 0.9
    }
  },
  {
    id: "iota",
    name: "Chokepoint Iota",
    type: "military",
    description: "Authorized personnel only. Violators atomized.",
    position: { x: 500, y: 80 },
    contrabandPolicy: "hostile",
    priceModifiers: {
      "cigs": 1.1,
      "media": 1.0,
      "electronics": 0.9,
      "pharma": 1.1,
      "weapons": 1.2,
      "narcotics": 1.0,
      "artifacts": 0.5,
      "stolentech": 1.0
    }
  },
  {
    id: "kappa",
    name: "The Still",
    type: "refinery",
    description: "Squeezing moisture from rocks. And other things.",
    position: { x: 100, y: 40 },
    contrabandPolicy: "safe",
    priceModifiers: {
      "cigs": 0.5,
      "media": 1.3,
      "electronics": 0.7,
      "pharma": 1.4,
      "weapons": 1.2,
      "narcotics": 1.1,
      "artifacts": 1.3,
      "stolentech": 1.2
    }
  },
  {
    id: "lambda",
    name: "Organs R Us",
    type: "medical",
    description: "Medical care at prices that'll kill you anyway",
    position: { x: 500, y: 440 },
    contrabandPolicy: "hostile",
    priceModifiers: {
      "cigs": 0.9,
      "media": 0.8,
      "electronics": 1.3,
      "pharma": 1.2,
      "weapons": 0.4,
      "narcotics": 1.5,
      "artifacts": 1.2,
      "stolentech": 1.1
    }
  },
  {
    id: "mu",
    name: "Wide Berth",
    type: "entertainment",
    description: "What happens here stays on your criminal record",
    position: { x: 50, y: 350 },
    contrabandPolicy: "safe",
    priceModifiers: {
      "cigs": 1.1,
      "media": 0.9,
      "electronics": 1.3,
      "pharma": 1.0,
      "weapons": 1.0,
      "narcotics": 0.9,
      "artifacts": 1.1,
      "stolentech": 1.0
    }
  },
  {
    id: "nu",
    name: "The Black Lodge",
    type: "black_market",
    description: "If we have it, you can't afford the questions",
    position: { x: 350, y: 560 },
    contrabandPolicy: "safe",
    priceModifiers: {
      "cigs": 1.5,
      "media": 1.4,
      "electronics": 1.3,
      "pharma": 1.4,
      "weapons": 1.6,
      "narcotics": 0.6,
      "artifacts": 0.5,
      "stolentech": 0.6
    }
  }
];

const COMMODITIES = [
  // Tier 1 - Petty Contraband
  {
    id: "cigs",
    name: "Black Market Cigs",
    basePrice: 5,
    contraband: true,
    description: "Untaxed and unfiltered"
  },
  {
    id: "media",
    name: "Bootleg Media",
    basePrice: 20,
    contraband: true,
    description: "Corporate IP is theft anyway"
  },
  // Tier 2 - Moderate Contraband
  {
    id: "electronics",
    name: "Stolen Electronics",
    basePrice: 80,
    contraband: true,
    description: "Serial numbers? What serial numbers?"
  },
  {
    id: "pharma",
    name: "Prescription Drugs",
    basePrice: 150,
    contraband: true,
    description: "Doctor's orders (forged)"
  },
  // Tier 3 - Serious Contraband
  {
    id: "weapons",
    name: "Military Weapons",
    basePrice: 350,
    contraband: true,
    description: "Point away from face"
  },
  {
    id: "narcotics",
    name: "Quantum Meth",
    basePrice: 500,
    contraband: true,
    description: "Exists in two states: euphoria and paranoia"
  },
  // Tier 4 - Major Contraband
  {
    id: "artifacts",
    name: "Forbidden Artifacts",
    basePrice: 750,
    contraband: true,
    description: "Ancient. Dangerous. Profitable."
  },
  {
    id: "stolentech",
    name: "Sentient AI Cores",
    basePrice: 1000,
    contraband: true,
    description: "They know what you did"
  }
];

const ROUTES = [
  // === ROW 1 (TOP TIER) - Industrial Corridor ===
  { from: "kappa", to: "delta" },
  { from: "delta", to: "iota" },
  
  // === ROW 2 - Mining/Agricultural Belt ===
  { from: "alpha", to: "beta", tollFee: 60 },  // Long horizontal toll route
  
  // === ROW 3 (CENTER) - Main Trading Hub ===
  { from: "mu", to: "epsilon" },
  { from: "epsilon", to: "gamma" },
  { from: "mu", to: "gamma" },
  
  // === ROW 4 - Outlaw/Medical Zone ===
  { from: "theta", to: "zeta" },
  { from: "zeta", to: "lambda" },
  
  // === VERTICAL CONNECTIONS (North-South) ===
  // Left column
  { from: "kappa", to: "alpha" },
  { from: "alpha", to: "mu" },
  { from: "mu", to: "theta" },
  { from: "theta", to: "nu" },
  
  // Center column  
  { from: "delta", to: "epsilon" },
  { from: "epsilon", to: "zeta" },
  { from: "zeta", to: "nu" },
  
  // Right column
  { from: "iota", to: "beta" },
  { from: "beta", to: "gamma" },
  { from: "gamma", to: "lambda" },
  
  // === DIAGONAL CONNECTIONS (Strategic Routes) ===
  // Top-left to center
  { from: "alpha", to: "epsilon" },
  
  // Top-right to center
  { from: "beta", to: "epsilon" },
  
  // Center to bottom
  { from: "epsilon", to: "theta" },
  { from: "epsilon", to: "lambda", tollFee: 60 },  // Diagonal toll
  { from: "mu", to: "nu", tollFee: 80 },           // Long diagonal toll
  { from: "gamma", to: "nu", tollFee: 75 },        // Long diagonal toll
  
  // === LONG DISTANCE (High Risk/Reward) - Premium Toll Routes ===
  { from: "kappa", to: "nu", tollFee: 100 },       // Left side express (longest route)
  { from: "iota", to: "lambda", tollFee: 75 },     // Right side military corridor
  { from: "alpha", to: "theta", tollFee: 50 },     // Mining to research
  { from: "beta", to: "lambda", tollFee: 50 }      // Agri to medical
];

const UPGRADES = [
  {
    id: "cargo",
    name: "Cargo Expansion",
    baseCost: 500,
    multiplier: 2,
    maxTier: 5,
    effectPerTier: 10,
    description: "Increase cargo capacity by 10 per tier",
    effectType: 'capacity'
  },
  {
    id: "hull",
    name: "Hull Reinforcement",
    baseCost: 600,
    multiplier: 2,
    maxTier: 5,
    effectPerTier: 20,
    description: "Add 20 max hull per tier",
    effectType: 'hull'
  },
  {
    id: "weapon",
    name: "Weapon System",
    baseCost: 800,
    multiplier: 2,
    maxTier: 5,
    effectPerTier: 5,
    description: "Increase attack damage by 5 per tier",
    effectType: 'weapon'
  }
];

// Pirate types with different hull ranges
const PIRATE_TYPES = [
  {
    id: "scout",
    name: "Scout",
    hullMin: 30,
    hullMax: 50,
    flavorText: "ragtag junker with patched hull plating"
  },
  {
    id: "raider",
    name: "Raider",
    hullMin: 50,
    hullMax: 80,
    flavorText: "armed freighter bristling with weapons"
  },
  {
    id: "battleship",
    name: "Battleship",
    hullMin: 80,
    hullMax: 120,
    flavorText: "military-grade vessel with shield signatures"
  }
];

// Cop types with different hull ranges (scaled to cargo value)
const COP_TYPES = [
  {
    id: "drone",
    name: "Patrol Drone",
    hullMin: 40,
    hullMax: 60,
    flavorText: "automated enforcement unit with basic scanners"
  },
  {
    id: "frigate",
    name: "Customs Frigate",
    hullMin: 60,
    hullMax: 90,
    flavorText: "government vessel with interdiction protocols"
  },
  {
    id: "cruiser",
    name: "Enforcement Cruiser",
    hullMin: 90,
    hullMax: 130,
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
  STARTING_CREDITS: 750,
  STARTING_HULL: 100,
  STARTING_CARGO_MAX: 20,
  
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
  
  TICK_EVENT_CHANCE: 0.15,
  PRICE_DRIFT_RATE: 0.05,
  
  PLAYER_BUY_PRICE_INCREASE: 0.04,
  PLAYER_SELL_PRICE_DECREASE: 0.04,
  ADJACENT_PRICE_CHANGE: 0.015,
  
  DEATH_CREDIT_RETENTION: 0.30,
  RESPAWN_SHIP_COST: 500,
  
  LEGAL_VARIANCE: 0.20,
  CONTRABAND_VARIANCE: 0.40,
  
  SHORTAGE_PRICE_MULT: 1.4,
  SURPLUS_PRICE_MULT: 0.7,
  SURGE_PRICE_MULT: 1.5,
  
  // Combat - Multi-round system
  COMBAT_ROUNDS_MIN: 2,
  COMBAT_ROUNDS_MAX: 3,
  
  // Player combat actions
  ATTACK_DAMAGE_MIN: 25,
  ATTACK_DAMAGE_MAX: 40,
  ATTACK_DAMAGE_TAKEN_MIN: 15,
  ATTACK_DAMAGE_TAKEN_MAX: 30,
  
  DEFEND_DAMAGE_MIN: 10,
  DEFEND_DAMAGE_MAX: 20,
  DEFEND_DAMAGE_TAKEN_MIN: 5,
  DEFEND_DAMAGE_TAKEN_MAX: 15,
  
  // Pirate difficulty scaling based on cargo value
  PIRATE_SCOUT_THRESHOLD: 500,      // < 500cr cargo = scouts likely
  PIRATE_RAIDER_THRESHOLD: 2000,    // 500-2000cr = raiders likely
  // > 2000cr cargo = battleships likely
  
  // Cop difficulty scaling based on cargo value
  COP_DRONE_THRESHOLD: 1000,        // < 1000cr cargo = patrol drones
  COP_FRIGATE_THRESHOLD: 3000,      // 1000-3000cr = customs frigates
  // > 3000cr cargo = enforcement cruisers
  
  BRIBE_COST_MIN: 100,
  BRIBE_COST_MAX: 300,
  BRIBE_SUCCESS_CHANCE: 0.60,
  
  FLEE_SUCCESS_BASE: 0.70,
  FLEE_FAIL_DAMAGE_MIN: 30,
  FLEE_FAIL_DAMAGE_MAX: 50,
  
  // Victory rewards
  VICTORY_CREDITS_MIN: 50,
  VICTORY_CREDITS_MAX: 150,
  SALVAGE_CHANCE: 0.30,
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
