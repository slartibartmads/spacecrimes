# Space Drugwars — Game Design Document

**Version:** 1.0  
**Last Updated:** March 10, 2026  
**Status:** Prototype Phase

---

## 1. Overview

### 1.1 Concept
Space Drugwars is a browser-based space trading game inspired by the classic Dopewars. Players navigate a small solar system, buying and selling commodities across specialized stations, managing risk vs. reward through legal and contraband trading, and surviving random events like pirate encounters and market fluctuations.

### 1.2 Core Pillars
- **Risk/Reward Economics:** Safe low-margin legal goods vs. high-margin risky contraband
- **Emergent Gameplay:** Random market conditions create unique trading opportunities each session
- **Multiplayer-Ready Architecture:** Pure functions and action-based ticking for easy server-side migration
- **Terminal Aesthetic:** Deliberately retro green-on-black monospace interface

### 1.3 Target Experience
Endless competitive play focused on wealth accumulation ("numbers go up"). No win condition - players optimize trade routes, manage risk, and compete for highest net worth. Designed for eventual multiplayer leaderboards.

---

## 2. Game World

### 2.1 Solar System Structure

**6 Stations** connected by fuel-based travel routes in a hub-and-spoke topology:

```
         [Delta Tech]
              |
     [Alpha]--[Epsilon]--[Beta]
      Mining  Trading    Agri
              |
         [Gamma]--[Zeta]
         Industrial Lawless
```

#### Station Profiles

| Station | Type | Specialization | Contraband Policy | Fuel Price |
|---------|------|----------------|-------------------|------------|
| **Station Alpha** | Mining Hub | Cheap metals/ore, expensive organics | Hostile (30% inspection) | 2.5cr/fuel |
| **Station Beta** | Agricultural | Cheap food/water, expensive tech | Hostile (30% inspection) | 2.5cr/fuel |
| **Station Gamma** | Industrial | Cheap manufactured goods, expensive raw materials | Neutral (no inspection) | 2.5cr/fuel |
| **Station Delta** | Tech Hub | Cheap electronics, expensive organics | Hostile (30% inspection) | 2.5cr/fuel |
| **Station Epsilon** | Trading Post | Balanced prices, central hub | Neutral (no inspection) | 2.0cr/fuel |
| **Station Zeta** | Lawless Outpost | Best contraband prices, remote location | Safe Haven (no law) | 3.0cr/fuel |

### 2.2 Route Network

Routes have fuel costs based on distance:

| Route | Fuel Cost | Type |
|-------|-----------|------|
| Alpha ↔ Epsilon | 8 | Short hop |
| Beta ↔ Epsilon | 8 | Short hop |
| Delta ↔ Epsilon | 8 | Short hop |
| Epsilon ↔ Gamma | 8 | Short hop |
| Gamma ↔ Zeta | 12 | Medium diagonal |
| Alpha ↔ Delta | 12 | Medium diagonal |
| Beta ↔ Gamma | 12 | Medium diagonal |

**Strategic Implications:**
- Epsilon is the refueling hub (cheapest fuel, central location)
- Zeta is high-risk/high-reward (expensive fuel, no law enforcement, best contraband prices)
- Hostile stations (Alpha/Beta/Delta) form outer ring - risky for contraband runs

---

## 3. Economy System

### 3.1 Commodities

**8 Total Commodities:**

#### Legal Commodities (5)
| Commodity | Base Price | Profit Margin | Description |
|-----------|------------|---------------|-------------|
| Water | 5cr | 10-15% | Essential hydration, low-value bulk good |
| Food | 12cr | 12-18% | Nutritional supplies, stable demand |
| Metals | 25cr | 15-20% | Raw materials, affected by mining station prices |
| Electronics | 45cr | 18-22% | Tech components, volatile but legal |
| Medicine | 60cr | 15-25% | Medical supplies, high demand at all stations |

#### Contraband (3)
| Commodity | Base Price | Profit Margin | Risk Factor |
|-----------|------------|---------------|-------------|
| Narcotics | 150cr | 40-80% | Illegal at Alpha/Beta/Delta, 30% inspection chance |
| Weapons | 200cr | 50-100% | Illegal at Alpha/Beta/Delta, 30% inspection chance |
| Stolen Tech | 180cr | 45-90% | Illegal at Alpha/Beta/Delta, 30% inspection chance |

**Contraband Rules:**
- Detected during random inspections at hostile stations
- Inspection chance: 30% base - upgrades (Scanner -10%, Fake Manifest -15%, Fast Courier -5%)
- Pirates 20% more likely to attack cargo ships carrying contraband
- Dramatically higher profit margins compensate for risk

### 3.2 Price System

**Price Calculation:**
```
Final Price = Base Price × Station Modifier × Supply/Demand Multiplier × Variance
```

**Station Price Modifiers:**
Each station has specialization modifiers (e.g., Mining Hub has 0.6× metals, 1.4× electronics)

**Supply/Demand Multipliers:**
- Low supply / High demand: 1.3× - 1.5×
- Normal: 0.9× - 1.1×
- High supply / Low demand: 0.6× - 0.8×

**Variance:**
- Legal goods: ±20% random variance
- Contraband: ±40% variance (more volatile)

### 3.3 Market Dynamics

**Player Actions Affect Prices:**
- **Buying** at a station → price increases there (+5-10%), decreases at connected stations (-2-3%)
- **Selling** at a station → price decreases there (-5-10%), increases at connected stations (+2-3%)

**Price Drift (per tick):**
- Prices drift 5% back toward baseline each tick
- Prevents permanent market distortion
- Creates natural market cycles

**Initial Market Conditions:**
Each game starts with 2-3 random anomalies:
1. One shortage (low supply, +40% price, lasts 5-7 ticks)
2. One surplus (high supply, -30% price, lasts 5-7 ticks)
3. Optional price surge (high demand, +50% price, lasts 3-5 ticks)

This creates immediate trading opportunities and ensures no two games are identical.

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

**Pirate Encounter Modal:**

**Three Options:**

1. **Fight**
   - Roll d100
   - Success threshold: 40 (or 25 with Weapon upgrade)
   - Success: Escape unharmed
   - Failure: Lose 20-40 hull, lose 10-30% of cargo randomly
   - Update stats: piratesDefeated++

2. **Bribe**
   - Random cost: 100-300cr
   - Always succeeds
   - No hull damage, keep cargo
   - Deduct credits

3. **Flee**
   - Costs 10 fuel
   - Base 70% success rate (+10% with Engine upgrade)
   - Success: Escape to destination
   - Failure: Same as failed fight

**Combat Resolution (Pure Function):**
```javascript
function resolveCombat(gameState, action) {
  // Calculate outcome based on action + upgrades
  // Apply hull damage, cargo loss, credit deduction
  // Check for death condition (hull <= 0)
  // Return new state + outcome description
}
```

### 4.6 Inspection System

**Trigger:** When docking at hostile station while carrying contraband

**Inspection Chance:**
- Base: 30%
- Reduced by:
  - Scanner upgrade: -10%
  - Fake Manifest upgrade: -15%
  - Fast Courier License: -5%
- Minimum inspection chance: 5% (can't eliminate risk entirely)

**Pre-Docking Warning:**
If carrying contraband to hostile station:
```
WARNING: Station Alpha enforces contraband laws.
Detected: 5x Narcotics (value: 750cr)
Inspection chance: 15%

[DOCK ANYWAY] [DUMP CARGO] [CANCEL]
```

**Inspection Modal (if caught):**

**Three Options:**

1. **Pay Fine**
   - Cost: 50% of contraband cargo value
   - Keep contraband cargo
   - Deduct credits

2. **Dump Cargo**
   - Lose all contraband
   - No fine
   - Keep credits

3. **Resist** (requires Weapon upgrade)
   - 60% chance to escape with cargo
   - 40% chance: Combat encounter + fine anyway
   - High risk, high reward

### 4.7 Death & Respawn System

**Death Trigger:** Hull reaches 0

**Death Modal:**
```
=== SHIP DESTROYED ===
Final Net Worth: 3,450cr
Successful Trades: 47
Pirates Defeated: 3
Stations Visited: 15

[RESPAWN (-500cr)] [GAME OVER]
```

**Respawn Mechanics:**
1. Calculate nearest station to death location (BFS on route graph)
2. Keep 30% of credits (minimum 500cr for new ship purchase)
3. If credits < 500cr after penalty: GAME OVER (prevents infinite death loops)
4. Reset ship to base stats:
   - cargoMax: 20
   - fuelMax: 100
   - hull: 100
5. Lose all cargo
6. Lose all upgrades
7. Spawn at nearest station with 50 fuel

**Game Over:**
- If player chooses GAME OVER or has insufficient credits
- Display final stats
- Option to restart (new game with random station)

---

## 5. Upgrades System

**6 Available Upgrades** (purchased at stations):

| Upgrade | Cost | Effect | Strategic Value |
|---------|------|--------|-----------------|
| **Cargo Expansion** | 500cr | +10 cargo capacity | Essential for bulk trading |
| **Fuel Tank Upgrade** | 400cr | +20 fuel capacity | Enables longer routes |
| **Engine Efficiency** | 600cr | -20% fuel costs, +10% flee success | Long-term savings + safety |
| **Weapon System** | 800cr | Fight threshold: 40→25, enables Resist | Combat advantage |
| **Advanced Scanner** | 700cr | -10% inspection, shows adjacent prices | Risk reduction + information |
| **Fake Manifest** | 500cr | -15% inspection chance | Contraband specialist upgrade |

**Upgrade Stacking:**
- All upgrades are one-time purchases
- Effects stack (Scanner + Fake Manifest = -25% inspection)
- Lost on death (must repurchase after respawn)

**Purchase UI:**
Shows in Station Panel:
```
[CARGO EXPANSION] 500cr - Adds 10 cargo slots (Current: 20)
[FUEL TANK] 400cr - Adds 20 fuel capacity (Current: 100)
...
```
Buttons disabled if already owned or insufficient credits.

---

## 6. User Interface

### 6.1 Visual Design

**Terminal Aesthetic:**
- Background: Pure black (#000000)
- Text: Bright green (#00ff00)
- Accents: Dark green (#00aa00)
- Danger: Red (#ff0000)
- Warning: Yellow (#ffff00)
- Font: 'Courier New', monospace, 14px
- No rounded corners, no shadows, no gradients
- Pure geometric primitives

### 6.2 Layout (CSS Grid)

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
     - Contraband rows highlighted in red
     - Buy/Sell buttons (quantity: 1, 5, 10, Max)
     - Disabled if insufficient funds/cargo/space
   - Refuel button with dynamic cost display
   - Upgrades section below commodities
   - Purchase buttons for available upgrades

3. **Status Bar (Middle)**
   - One-line display:
     ```
     CREDITS: 1000cr | FUEL: 50/100 | HULL: 100% | LOC: Station Alpha | CARGO: 5/20 | NET: 1,250cr
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

### 6.3 Modals

**Combat Modal:**
```
═══════════════════════════
   PIRATE ENCOUNTER!
═══════════════════════════
Pirates demand your cargo!

[FIGHT] [BRIBE (150cr)] [FLEE]
```

**Inspection Modal:**
```
═══════════════════════════
  CUSTOMS INSPECTION!
═══════════════════════════
Contraband detected: 5x Narcotics
Estimated fine: 375cr

[PAY FINE] [DUMP CARGO] [RESIST]
```

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

## 7. Progression & Strategy

### 7.1 Early Game (0-2,000cr)

**Goals:**
- Learn station specializations
- Build initial capital with safe legal trades
- Avoid pirates and inspections

**Optimal Strategy:**
- Trade Water/Food between Agricultural (Beta) and Mining (Alpha)
- 10-15% margins, low risk
- Save for first upgrade (Cargo Expansion or Fuel Tank)

### 7.2 Mid Game (2,000-10,000cr)

**Goals:**
- Establish profitable trade routes
- Purchase key upgrades
- Begin cautious contraband runs

**Optimal Strategy:**
- Buy Cargo Expansion → trade bulk legal goods
- Occasional contraband runs to Zeta (lawless haven)
- Purchase Scanner to reduce inspection risk
- Avoid hostile stations with contraband until Scanner + Fake Manifest owned

### 7.3 Late Game (10,000cr+)

**Goals:**
- Maximize contraband profits
- Full upgrade loadout
- Optimize "milk runs" for consistent income

**Optimal Strategy:**
- Full contraband trading: buy at Gamma/Epsilon, sell at Zeta
- All upgrades purchased (30 cargo, 120 fuel, all inspection reductions)
- Fight pirates confidently with Weapon upgrade
- Focus on net worth growth for leaderboards

### 7.4 Advanced Tactics

**Price Speculation:**
- Use Scanner to see adjacent station prices without traveling
- Wait for shortages/surges at stations you can reach
- Buy low during gluts, sell high during surges

**Route Optimization:**
- Epsilon as refueling hub (cheapest fuel)
- Avoid dead-end stations (Zeta) unless profit justifies fuel cost
- Plan multi-hop routes to capitalize on price differences

**Risk Management:**
- Never carry more contraband than you can afford to lose
- Keep 500cr reserve for respawn insurance
- Use Engine upgrade to flee pirates reliably
- Dump contraband before hostile station if inspection chance > 20%

---

## 8. Technical Architecture

### 8.1 File Structure

```
spacedopewars/
├── index.html       # UI structure (4 panels, modals)
├── style.css        # Terminal aesthetic, grid layout
├── data.js          # Static definitions (stations, commodities, routes, upgrades)
└── game.js          # All game logic (state, tick, economy, UI rendering)
```

### 8.2 State Management

**Single Global State Object:**
```javascript
let gameState = {
  player: { ... },      // Player stats, location, cargo
  markets: { ... },     // Per-station commodity prices/supply/demand
  activeEvents: [ ... ], // Current market events with expiry ticks
  tick: 0,              // Game time
  log: [ ... ]          // Event history
};
```

**Pure Functions for Game Logic:**
All state-modifying functions follow this pattern:
```javascript
function gameAction(state, ...params) {
  const newState = deepClone(state);
  // Modify newState
  return newState;
}
```

**UI Rendering:**
```javascript
function render() {
  renderMap(gameState);
  renderStation(gameState);
  renderStatus(gameState);
  renderLog(gameState);
}
```

Called after every state change.

### 8.3 Multiplayer Migration Path

**Current (Single-Player):**
```
User Action → Pure Function → New State → Render
```

**Future (Multiplayer):**
```
Client: User Action → Send to Server
Server: Receive Action → Pure Function → New State → Broadcast to All Clients
Client: Receive State Update → Render
```

**Key Design Decisions for Multiplayer:**
1. **Pure functions:** Easy to run on server
2. **Action-based ticking:** Server controls when ticks happen (no client-side timers)
3. **Deterministic events:** Use server-side RNG seed for reproducible results
4. **State serialization:** JSON-friendly state object
5. **No client-side predictions:** Clients are dumb terminals (render only)

### 8.4 Data Structures

**Station Definition:**
```javascript
{
  id: "alpha",
  name: "Station Alpha",
  type: "mining",
  position: { x: 100, y: 200 },
  contrabandPolicy: "hostile",
  fuelPrice: 2.5,
  priceModifiers: {
    "Water": 1.1,
    "Metals": 0.6
  }
}
```

**Commodity Definition:**
```javascript
{
  id: "narcotics",
  name: "Narcotics",
  basePrice: 150,
  contraband: true
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
