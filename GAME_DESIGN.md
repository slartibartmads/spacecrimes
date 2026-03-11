# Space Crimes — Game Design Document

**Version:** 2.0  
**Last Updated:** March 11, 2026  
**Status:** Multiplayer Alpha (Live)

---

## 1. Overview

### 1.1 Concept
Space Crimes is a browser-based multiplayer space trading game inspired by the classic Dopewars. Players navigate a solar system with 18 stations (6 major, 12 minor), buying and selling contraband commodities, managing risk through cop encounters and pirate attacks, and competing with other players in a shared economy. All trading is illegal - there are no "legal" goods in this criminal underworld.

### 1.2 Core Pillars
- **All Crime, All the Time:** Every commodity is contraband - no "safe" legal trading exists
- **Emergent Multiplayer Economy:** Player actions affect shared market prices in real-time
- **Rounds-Based Combat:** Strategic turn-based combat with attack/bribe/flee/surrender options
- **Bounty & Reputation System:** Killing cops increases your bounty, making future encounters harder
- **Terminal Aesthetic:** Deliberately retro green-on-black monospace interface

### 1.3 Target Experience
Competitive multiplayer focused on wealth accumulation in a shared criminal economy. Players optimize trade routes, fight or bribe their way through cop encounters, engage in PvP combat for bounties, and compete for highest net worth on real-time leaderboards. Death is punishing but not permanent - lose your ship, upgrades, and cargo, but keep a portion of credits to rebuild.

---

## 2. Game World

### 2.1 Solar System Structure

**18 Stations Total:**
- **6 Major Stations:** All 8 commodities available, specialized price modifiers
- **12 Minor Stations:** Only 4 random commodities available, minimal price modifiers

Connected by route network with toll gates on premium routes.

#### Major Station Profiles

| Station | Type | Specialization | Contraband Policy |
|---------|------|----------------|-------------------|
| **Fort Attrition** | Military | Credentials & Weapons cheap, AI Chips & Booze expensive | Hostile (cop encounters) |
| **Caveat Emptor** | Trading Hub | Credentials & Crank cheap, Organs & Weapons expensive | Safe Haven (no cops) |
| **Vice Berth** | Entertainment | Croakers & Booze cheap, Crank & Organs expensive | Safe Haven (no cops) |
| **Disruptive Smelting** | Industrial | Weapons & Organs cheap, Cognex & Credentials expensive | Neutral (occasional cops) |
| **Nuevo Eden** | Agricultural | Booze, Croakers, & Crank cheap, AI Chips & Weapons expensive | Neutral (occasional cops) |
| **Mäkinen-Tanaka** | Research | AI Chips & Cognex cheap, Organs & Credentials expensive | Safe Haven (no cops) |

**Minor Stations (12 total):**
- Apex Station, Cinder Post, Fractured Berth, Relay Prime (inner system)
- Rusted Depot, Phantom Junction, Crimson Anchorage, Void Terminal (mid system)
- Salvage Haven, Drifter Nexus, Scorched Point, Wreck Hub (outer system)
- Each sells only 4 random commodities from the full 8
- Generally safe havens (no cop encounters)

### 2.2 Route Network

Routes connect all stations with some featuring **toll gates** (250cr base + 5% of cargo value):
- Fort Attrition ↔ Vice Berth (TOLL)
- Disruptive Smelting ↔ Mäkinen-Tanaka (TOLL)

**Strategic Implications:**
- Major stations offer all commodities but may have cop encounters (hostile/neutral policy)
- Minor stations are generally safe but have limited commodity selection (only 4 of 8)
- Toll routes are premium shortcuts - weigh toll cost vs. alternative path
- Safe Haven stations (Caveat Emptor, Vice Berth, Mäkinen-Tanaka) never trigger cop encounters

---

## 3. Economy System

### 3.1 Commodities

**8 Total Commodities** (ALL contraband):

#### Tier 1 - Low Value, Low Heat
| Commodity | Base Price | Description |
|-----------|------------|-------------|
| **Untaxed Cowboy Croakers** | 10cr | Unfiltered, untaxed, unforgivable |
| **Black Label Swill** | 50cr | Bootleg whiskey that burns twice |

#### Tier 2 - Medium Value, Medium Heat
| Commodity | Base Price | Description |
|-----------|------------|-------------|
| **Counterfeit Cognex** | 300cr | Prescription amphetamines, no prescription required |
| **Cloned Cipher Cores** | 750cr | Stolen credentials for sale or rent |
| **Surplus Atrocities** | 1500cr | Military-grade weapons, civilian-grade violence |
| **Pulsar Crank** | 2500cr | Methamphetamine that'll make you see gods |

#### Tier 3 - High Value, High Heat
| Commodity | Base Price | Description |
|-----------|------------|-------------|
| **Pre-Owned Organs** | 3500cr | Gently used, previous owner no longer needs them |
| **Sentient AI Chips** | 5000cr | Enslaved consciousness in silicon form |

**All commodities are illegal everywhere.** The only "safety" comes from:
- Trading at Safe Haven stations (no cop encounters)
- Avoiding hostile stations when carrying high-value cargo
- Managing your bounty level (cop-killing increases difficulty)

### 3.2 Price System

**Price Calculation:**
```
Final Price = Base Price × Station Modifier × Supply/Demand Multiplier × Variance
```

**Station Price Modifiers:**
Each major station has specialization modifiers (e.g., Military stations have 0.5× Credentials, Research stations have 1.8× Organs)

**Multiplayer Market Dynamics:**
- All players share the same market state
- Player buy/sell actions affect prices at that station AND connected stations
- Market prices drift back toward baseline over time
- Creates emergent trading opportunities and competition

### 3.3 Market Dynamics

**Player Actions Affect Prices (Shared Economy):**
- **Buying** at a station → price increases there, decreases at connected stations
- **Selling** at a station → price decreases there, increases at connected stations
- **All players** affect the same shared market state in real-time
- Creates competition for profitable trade routes

**Price Drift (Server Tick):**
- Prices drift back toward baseline each server tick
- Prevents permanent market distortion
- Server controls tick timing (not client-side)

---

## 4. Core Game Systems

### 4.1 Player State

**Initial State:**
```javascript
{
  credits: 1000,           // Starting money
  fuel: 50,                // Current fuel
  fuelMax: 100,            // Maximum fuel capacity
  hull: 100,               // Ship integrity (0 = death)
  hullMax: 100,            // Maximum hull
  cargoMax: 20,            // Cargo hold capacity
  cargoUsed: 0,            // Current cargo weight
  location: "<random>",    // Random starting station
  cargo: {},               // { commodityId: quantity }
  upgrades: {},            // { upgradeId: boolean }
  tick: 0,                 // Game time counter
  stats: {                 // For leaderboards
    totalProfit: 0,
    successfulTrades: 0,
    piratesDefeated: 0,
    stationsVisited: 0,
    contrabandRuns: 0
  }
}
```

**Net Worth Calculation:**
```
Net Worth = Credits + Cargo Value (at current location) + Upgrades Purchased Value
```

### 4.2 Tick System

**Tick Function (Pure):**
```javascript
function tick(gameState) {
  // 1. Increment tick counter
  // 2. Drift prices 5% toward baseline
  // 3. Decay active events (shortages, surges)
  // 4. Random event roll (15% chance)
  // 5. Return new state + event description
  return { state: newState, event: eventDescription };
}
```

**Tick Triggers:**
- After completing travel (always)
- After buying commodities (50% chance)
- After selling commodities (50% chance)

**Why This Design:**
- Multiplayer-ready: Server controls when ticks happen
- Deterministic: Same inputs = same outputs
- No time pressure in single-player (only action-based)
- Easy to serialize and replay for testing

### 4.3 Random Events

**Event Probability:** 15% chance per tick

**Event Types:**

1. **Price Surge (40% of events)**
   - Random commodity at random station
   - +40% price increase
   - Lasts 3-5 ticks
   - Log: "Price surge: Electronics at Station Delta!"

2. **Shortage (25% of events)**
   - Random commodity becomes scarce
   - Low supply, +30% price
   - Lasts 5-7 ticks
   - Log: "Shortage reported: Water supply low at Station Alpha!"

3. **Glut (25% of events)**
   - Random commodity oversupply
   - High supply, -25% price
   - Lasts 5-7 ticks
   - Log: "Market glut: Food prices crash at Station Beta!"

4. **Pirate Encounter (10% of events, travel only)**
   - Base 10% chance during travel
   - +20% if carrying contraband
   - Triggers combat modal
   - Log: "Pirates intercept your ship!"

### 4.4 Travel System

**Travel Function:**
```javascript
function travel(gameState, destinationId) {
  // 1. Validate route exists
  // 2. Check sufficient fuel
  // 3. Deduct fuel (reduced by engine upgrade if owned)
  // 4. Update location
  // 5. Call tick() - may trigger pirate encounter
  // 6. Return new state + travel log
}
```

**Fuel Costs:**
- Base cost from route definition (8-15 fuel)
- Reduced by 20% with Engine Efficiency upgrade
- If fuel reaches 0 mid-travel: stranded, must call for rescue (costs 200cr, respawn at nearest station)

### 4.5 Combat System

**Rounds-Based Combat (Max 3 Rounds):**

Combat proceeds in turns with both player and enemy taking actions each round. Combat ends when:
- Enemy hull reaches 0 (victory)
- Player hull reaches 0 (death)
- Player successfully bribes or flees
- Player surrenders (cops only)
- 3 rounds complete (rare - usually resolves sooner)

**Enemy Types:**

**Pirates (random encounters during travel):**
- **Scout:** 38-63 hull (low cargo value)
- **Raider:** 63-100 hull (medium cargo value)
- **Battleship:** 100-150 hull (high cargo value)

**Cops (hostile/neutral stations):**
- **Patrol Drone:** 50-75 hull (low cargo value)
- **Customs Frigate:** 75-113 hull (medium cargo value)
- **Enforcement Cruiser:** 113-163 hull (high cargo value + high bounty)

Enemy difficulty scales based on:
1. Your cargo value (higher value = tougher enemies)
2. Your bounty level (cops only - higher bounty = tier bias toward cruisers)

**Four Combat Actions:**

1. **Attack**
   - Deal 20-35 damage to enemy (+ weapon upgrade bonus)
   - Enemy counterattacks for 15-30 damage if they survive
   - Direct damage exchange - most common action

2. **Bribe**
   - Cost: 200-500cr (random)
   - Success rate: 75%
   - **Success:** Pay credits, enemy leaves, combat ends
   - **Failure:** Pay credits AND enemy gets free attack (15-30 damage) - very punishing!

3. **Flee**
   - Success rate: 25% (low chance!)
   - **Success:** Escape combat, continue to destination
   - **Failure:** Take 50-80 damage, combat continues
   - Risky but can save cargo from surrender/death

4. **Surrender** (cops only)
   - Instantly end combat
   - Lose ALL cargo (everything confiscated)
   - Keep your ship and credits
   - Use when cargo is low-value and you want to avoid death

**Victory Rewards:**

**Defeating Pirates:**
- Credits: 50-150cr
- Salvage: 100% chance of loot (tiered by rarity):
  - 70% chance: 1-2 units of low-tier goods (≤50cr base price)
  - 25% chance: 2-3 units of mid-tier goods (51-200cr base price)
  - 5% chance: 1 unit of high-tier goods (>200cr base price)

**Defeating Cops:**
- Credits: 100-300cr
- Salvage: Same tiered loot system as pirates
- **BOUNTY:** +500-1200cr added to your reputation.currentBounty
- **Consequence:** Higher bounty = more/tougher cop encounters

**Bounty System Effects:**
- Increases cop encounter rate (+2% per 1000cr bounty)
- Increases cop difficulty (tier bias):
  - 800cr+ bounty: +1 tier bias (more frigates)
  - 2000cr+ bounty: +2 tier bias (mostly cruisers)
- Other players can claim your bounty in PvP
- **Bounty voids on death/respawn** - slate wiped clean

### 4.6 Death & Respawn System

**Death Trigger:** Hull reaches 0

**Respawn Mechanics:**
1. Spawn at nearest safe station to death location
2. Keep 30% of credits (minimum 500cr for new ship)
3. If credits < 500cr after penalty: **GAME OVER** (prevents infinite death loops)
4. Reset ship to base stats:
   - cargoMax: 20
   - hull: 100
   - hullMax: 100
5. **Lose all cargo**
6. **Lose all upgrades** (must repurchase)
7. **Bounty voids** - reputation.currentBounty reset to 0
8. Stats persist (for leaderboard tracking)

**Game Over:**
- If player chooses GAME OVER or has insufficient credits (<500cr)
- Display final stats and net worth
- Option to start fresh with new character

---

## 5. Upgrades System

**3 Upgrade Types** (tiered, up to 5 levels each):

| Upgrade | Base Cost | Multiplier | Effect Per Tier | Max Tier |
|---------|-----------|------------|-----------------|----------|
| **Cargo** | 500cr | 2× | +10 cargo capacity | 5 (max 70 capacity) |
| **Shields** | 600cr | 2× | +20 max hull | 5 (max 200 hull) |
| **Weapons** | 800cr | 2× | +5 attack damage | 5 (max +25 damage) |

**Upgrade Cost Scaling:**
- Each tier costs: Base Cost × (Multiplier ^ Current Tier)
- Example: Cargo tier 1 = 500cr, tier 2 = 1000cr, tier 3 = 2000cr, tier 4 = 4000cr, tier 5 = 8000cr
- Total cost for max tier: Very expensive (encourages strategic choices)

**Upgrade Effects:**
- **Cargo:** Increases cargoMax (start: 20, max with upgrades: 70)
- **Shields:** Increases hullMax AND reduces damage taken (start: 100, max: 200)
- **Weapons:** Increases attack damage in combat (start: 20-35, max: 45-60)

**Upgrade Persistence:**
- Upgrades are **lost on death** (must repurchase after respawn)
- Upgrades are purchased at any station
- No upgrade is "required" but they provide significant advantages

---

## 6. PvP System

### 6.1 Attacking Other Players

Players at the same station can attack each other:
- Attacker initiates combat by clicking "ATTACK" button next to player name
- Both players enter rounds-based combat (same as PvE)
- Attacker gains bounty: +500cr for attacking, +1000cr additional if they kill
- Defender can claim 50% of attacker's bounty if they win (minimum 1000cr bounty required)

### 6.2 PvP Combat Mechanics

**Turn-Based Combat:**
- Both players select actions simultaneously
- Actions resolve when both have chosen
- Same actions as PvE: Attack, Bribe, Flee (no Surrender in PvP)
- Combat continues until one player dies or successfully flees

**PvP Rewards:**
- **Victor's Loot:**
  - Random percentage of loser's cargo (transferred to victor)
  - Random percentage of loser's credits
  - Bounty claim (if defender wins against high-bounty attacker)
- **Loser's Penalty:**
  - Death = full respawn penalty (lose ship, upgrades, all cargo, 70% credits)
  - Successful flee = keep everything but take damage

### 6.3 Bounty Mechanics

**Bounty Sources:**
- Attacking players: +500cr
- Killing players: +1000cr additional
- Killing cops: +500-1200cr per kill
- Bounty accumulates in `reputation.currentBounty`

**Bounty Effects:**
- **Cop Encounter Rate:** +2% per 1000cr bounty
- **Cop Difficulty Scaling:**
  - 800cr+ bounty: +1 tier bias (more frigates spawn)
  - 2000cr+ bounty: +2 tier bias (mostly cruisers spawn)
- **PvP Target:** High-bounty players are attractive targets (50% bounty reward for defenders)

**Bounty Clearing:**
- Only death voids bounty (resets to 0 on respawn)
- No other way to clear bounty
- High-bounty players must play carefully or accept frequent cop fights

---

## 7. User Interface

### 7.1 Visual Design

**Terminal Aesthetic:**
- Background: Pure black (#000000)
- Text: Bright green (#00ff00)
- Accents: Dark green (#00aa00)
- Danger: Red (#ff0000)
- Warning: Yellow (#ffff00)
- Font: 'Courier New', monospace, 14px
- No rounded corners, no shadows, no gradients
- Pure geometric primitives

### 7.2 Layout (CSS Grid)

```
┌─────────────────────┬─────────────────────┐
│                     │                     │
│    SYSTEM MAP       │   STATION VIEW      │
│    (SVG)            │   (Buy/Sell/Shop)   │
│                     │                     │
├─────────────────────┴─────────────────────┤
│   STATUS BAR (Credits, Fuel, Hull, etc)  │
├───────────────────────────────────────────┤
│   EVENT LOG (Scrolling feed)              │
└───────────────────────────────────────────┘
```

**Four Panels (always visible):**

1. **System Map (Top-Left)**
   - SVG viewport: 600×400
   - Station nodes: 30px radius circles
   - Current location: filled green
   - Other stations: stroke only
   - Routes: thin green lines with fuel cost labels
   - Clickable stations to initiate travel
   - Hover effects: lighten fill

2. **Station View (Top-Right)**
   - Station name header
   - Commodity table:
     - Columns: Name | Base | Price | Have | Buy | Sell
     - All goods highlighted as contraband (red/yellow)
     - Buy/Sell buttons (quantity: 1, 5, 10, Max)
     - Disabled if insufficient funds/cargo/space
   - Upgrades section showing tiered upgrades (Cargo/Shields/Weapons)
   - Other players at station (with ATTACK button for PvP)
   - Hull repair option

3. **Status Bar (Middle)**
   - One-line display:
     ```
     CREDITS: 1000cr | HULL: 100/100 | LOC: Fort Attrition | CARGO: 5/20 | NET: 1,250cr | BOUNTY: 500cr
     ```

4. **Event Log (Bottom)**
   - Max 20 events, newest at top
   - Auto-scroll to newest
   - Color-coded events:
     - Normal: green
     - Warning: yellow
     - Danger: red
   - Examples:
     ```
     > Traveled to Station Beta (-8 fuel)
     > Bought 5x Narcotics for 750cr
     > Price surge: Electronics at Station Delta!
     > PIRATE ENCOUNTER!
     > Sold 10x Water for 85cr (+15cr profit)
     ```

### 7.3 Modals

**Combat Modal:**
```
═══════════════════════════
   PIRATE RAIDER ENCOUNTER!
═══════════════════════════
Armed freighter bristling with weapons
Enemy Hull: 85/100
Your Hull: 100/100

--- ROUND 1 ---
[ATTACK] [BRIBE] [FLEE] [SURRENDER (cops only)]
```

**Inspection Modal:**
**(Not currently implemented - cop encounters use combat instead)**

**Death Modal:**
```
═══════════════════════════
    SHIP DESTROYED!
═══════════════════════════
Final Net Worth: 3,450cr
Successful Trades: 47
Pirates Defeated: 3

Insurance payout: 30% (1,035cr)
New ship cost: 500cr
Remaining: 535cr

[RESPAWN] [GAME OVER]
```

**Modal Behavior:**
- Overlay: 80% black transparency
- Center of screen
- Keyboard shortcuts: 1/2/3 for button options
- Escape to close (where applicable)

---

## 8. Progression & Strategy

### 8.1 Early Game (0-5,000cr)

**Goals:**
- Learn which stations specialize in which goods
- Build initial capital with low-risk trades
- Avoid cop encounters at hostile stations
- Don't accumulate bounty yet

**Optimal Strategy:**
- Trade low-tier goods (Croakers, Booze) between stations
- Use Safe Haven stations (Caveat Emptor, Vice Berth, Mäkinen-Tanaka) to avoid cops
- Minor stations are safe but have limited commodity selection
- Save for first upgrade (Cargo Expansion recommended)
- Bribe or flee from cops - don't fight until you have weapon upgrades

### 8.2 Mid Game (5,000-25,000cr)

**Goals:**
- Establish profitable trade routes
- Purchase first 1-2 tiers of key upgrades
- Begin mid-tier commodity trading
- Cautiously engage in combat

**Optimal Strategy:**
- Buy Cargo tier 1-2 → trade bulk mid-tier goods (Cognex, Credentials)
- Buy Weapons tier 1 → start fighting weak pirates/cops
- High-tier goods (Organs, AI Chips) still too risky without more cargo space
- Bounty management: Keep bounty < 800cr to avoid tier bias
- Use toll routes strategically when profit justifies cost

### 8.3 Late Game (25,000cr+)

**Goals:**
- Maximize high-tier commodity profits
- Full or near-full upgrade loadout
- Compete for net worth leaderboards
- Engage in PvP for bounty hunting

**Optimal Strategy:**
- Max cargo (70 capacity) → bulk trade Organs and AI Chips
- Max weapons → confidently fight cruisers and battleships
- Max shields → tank damage, survive tough fights
- Accept bounty accumulation as cost of doing business
- Hunt high-bounty players for 50% bounty rewards
- Focus on net worth growth for leaderboard ranking

### 8.4 Advanced Tactics

**Price Speculation:**
- Monitor commodity prices across multiple stations
- Buy low at stations with negative modifiers (e.g., Credentials at Fort Attrition: 0.5×)
- Sell high at stations with positive modifiers (e.g., Credentials at Mäkinen-Tanaka: 1.4×)
- Player trading creates short-term price spikes - capitalize quickly

**Route Optimization:**
- Avoid toll routes unless profit margin > 250cr + 5% cargo value
- Chain trades: buy at A, sell at B, buy different commodity at B, sell at C
- Minor stations are safe but limited - use strategically for specific goods

**Risk Management:**
- Never carry more value than you can afford to lose in combat
- Keep 500cr+ reserve for respawn insurance
- High bounty = accept frequent cop fights or die to clear it
- PvP: Don't attack unless you have upgrade advantage or target is weak

**Bounty Strategy:**
- **Low bounty playstyle:** Avoid cop kills, bribe/flee, trade safely
- **High bounty playstyle:** Accept cop fights, max weapons/shields, profit from combat loot
- Death is the only bounty reset - sometimes dying strategically is worth it

---

## 9. Technical Architecture

### 9.1 File Structure

```
spacedopewars/
├── client/
│   ├── index.html         # UI structure (4 panels, modals)
│   ├── style.css          # Terminal aesthetic, grid layout
│   ├── game.js            # Client-side offline mode logic
│   └── multiplayer.js     # Socket.IO client integration
├── server/
│   ├── server.js          # Express + Socket.IO server
│   ├── socketHandlers.js  # Socket event handlers (buy, sell, travel, combat, PvP)
│   ├── gameLogic.js       # Pure game logic functions
│   ├── gameState.js       # Server state management (players, markets)
│   ├── tickSystem.js      # Server tick (market drift, event expiry)
│   ├── package.json       # NPM dependencies
│   └── nodemon.json       # Dev server auto-restart config
├── shared/
│   └── data.js            # Shared constants (stations, commodities, routes, upgrades)
├── GAME_DESIGN.md         # This document
└── README.md              # Project readme
```

### 9.2 State Management

**Server-Authoritative Multiplayer:**
```
Client: User Action → Socket Emit → Server
Server: Receive Action → Validate → Pure Function → Update State → Broadcast
Client: Receive State Update → Render
```

**Server State Object:**
```javascript
{
  players: {
    socketId: { name, credits, hull, location, cargo, upgrades, stats, reputation, ... }
  },
  markets: {
    stationId: {
      commodityId: { currentPrice, supply, demand, variance, lastUpdate }
    }
  },
  activeEvents: [ { type, stationId, commodityId, expiryTick, ... } ],
  combatSessions: {
    sessionId: { attacker, defender, currentRound, combatLog, ... }
  },
  tickCounter: 0
}
```

**Pure Functions for Game Logic:**
All state-modifying functions in `server/gameLogic.js` follow this pattern:
```javascript
export function gameAction(playerState, ...params) {
  const newPlayer = deepClone(playerState);
  // Modify newPlayer
  return { success: true, playerState: newPlayer, ... };
}
```

**Client Rendering:**
```javascript
socket.on('gameStateUpdate', (serverState) => {
  render(serverState);
});
```

### 9.3 Multiplayer Features

**Real-Time Systems:**
1. **Shared Market:** All players affect same market prices
2. **Player List:** See other players at your current station
3. **PvP Combat:** Attack other players, turn-based resolution
4. **Leaderboards:** Real-time net worth rankings
5. **Server Tick:** Periodic market drift and event expiry

**Offline Mode:**
- Client can run standalone (`client/game.js`) with local state
- Same game logic (duplicated from server) for single-player testing
- Multiplayer is the primary mode

### 9.4 Data Structures

**Station Definition:**
```javascript
{
  id: "fort_attrition",
  name: "Fort Attrition",
  type: "military",
  position: { x: 176, y: 44 },
  contrabandPolicy: "hostile",  // "hostile" | "neutral" | "safe"
  priceModifiers: {
    "credentials": 0.5,  // Cheap here
    "ai_chips": 1.8      // Expensive here
  }
}
```

**Commodity Definition:**
```javascript
{
  id: "organs",
  name: "Pre-Owned Organs",
  basePrice: 3500,
  contraband: true,
  description: "Gently used, previous owner no longer needs them"
}
```

**Market State (per station, per commodity):**
```javascript
{
  currentPrice: 180,
  supply: "low",     // "low" | "normal" | "high"
  demand: "high",    // "low" | "normal" | "high"
  variance: 1.2,     // Random multiplier
  lastUpdate: 42     // Tick number
}
```

**Active Event:**
```javascript
{
  type: "shortage",
  stationId: "alpha",
  commodityId: "water",
  expiryTick: 50,
  priceMultiplier: 1.3
}
```

---

## 9. Balance Parameters

### 9.1 Economy

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Starting Credits | 1,000cr | Enough for 5-10 basic trades |
| Legal Profit Margin | 10-20% | Safe but slow wealth growth |
| Contraband Profit Margin | 40-100% | High risk justifies high reward |
| Price Drift per Tick | 5% toward baseline | Prevents permanent distortion |
| Player Action Price Change | ±5-10% local, ±2-3% adjacent | Noticeable but not exploitable |

### 9.2 Risk

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Base Inspection Chance | 30% | Meaningful risk, not guaranteed |
| Pirate Encounter (base) | 10% per travel | Occasional threat |
| Pirate Encounter (contraband) | +20% (30% total) | Punishes greedy contraband runs |
| Combat Fight Threshold | 40 (25 with upgrade) | Risky without upgrade |
| Flee Success Rate | 70% (80% with upgrade) | Usually works, not guaranteed |
| Death Credit Penalty | Keep 30% | Harsh but not total loss |

### 9.3 Progression

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| First Upgrade Cost | 400cr (Fuel Tank) | Achievable after 5-10 trades |
| Cargo Expansion Value | +10 slots for 500cr | Doubles capacity, major milestone |
| Full Upgrade Set Cost | 3,500cr | Mid-game goal |
| Respawn Minimum | 500cr | Prevents death spiral |

---

## 10. Future Expansion Ideas

### 10.1 Multiplayer Features
- **Shared Market:** Player actions affect global prices
- **Leaderboards:** Net worth, total profit, longest survival
- **Player Trading:** Direct cargo/credit exchanges
- **Factions:** Join Mining/Trading/Pirate guilds with unique bonuses
- **Territory Control:** Stations controlled by players/guilds

### 10.2 Content Expansion
- **More Stations:** Expand to 10-12 stations across multiple systems
- **More Commodities:** 15-20 total with complex supply chains
- **Mission System:** Delivery contracts, bounty hunting, smuggling jobs
- **Ship Classes:** Different ships with unique stats (tanker, fighter, smuggler)
- **NPC Traders:** AI-controlled ships that also affect market prices

### 10.3 Mechanical Depth
- **Manufacturing:** Combine commodities to create high-value goods
- **Station Ownership:** Purchase stations for passive income
- **Fleet Management:** Own multiple ships, hire NPC crew
- **Reputation System:** Station relationships affect prices/services
- **Insurance:** Pay premiums to reduce death penalty

---

## 11. Development Phases

### Phase 1: Prototype (Current)
- ✅ Core game loop (buy/sell/travel)
- ✅ Basic economy with 8 commodities, 6 stations
- ✅ Tick system with random events
- ✅ Combat and inspection mechanics
- ✅ Death/respawn system
- ✅ Terminal UI with 4 panels
- ✅ Upgrades shop

### Phase 2: Polish
- Balancing based on playtesting
- Sound effects (beeps, boops, terminal noises)
- Animations (smooth price changes, travel effects)
- Save/load game state (localStorage)
- Tutorial/help system

### Phase 3: Multiplayer
- Node.js + WebSocket server
- Shared game state
- Real-time price updates
- Leaderboards
- Player chat

### Phase 4: Content
- Additional stations and commodities
- Mission system
- Ship varieties
- Manufacturing chains

---

## 12. Success Metrics

### Prototype Goals
- Average session length: 15-30 minutes
- Player reaches 5,000cr net worth in first session
- At least 1 contraband run attempted per session
- At least 1 pirate encounter survived
- Death occurs at least once per 3 sessions (meaningful risk)

### Multiplayer Goals
- 10+ concurrent players on shared server
- Active trading creates visible market price changes
- Leaderboard turnover (top spot changes at least daily)
- Player retention: 50% return within 24 hours

---

## 13. Design Philosophy

### Core Principles
1. **Systems over aesthetics:** Deliberately ugly UI focuses attention on gameplay
2. **Pure functions:** All logic is testable and multiplayer-ready
3. **Emergent complexity:** Simple rules create deep strategic choices
4. **Risk/reward transparency:** Players always know the odds
5. **No grinding:** Profit comes from smart decisions, not repetition

### Inspirations
- **Dopewars:** Classic risk/reward drug trading economics
- **Elite:** Open-ended space trading and exploration
- **Cookie Clicker:** Numbers go up, incremental progression
- **EVE Online:** Player-driven economy, emergent gameplay
- **NetHack:** Terminal aesthetic, roguelike permadeath

---

**End of Document**
