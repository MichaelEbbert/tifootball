# TI Football Game - 1979 BASIC Simulation

## AWS Deployment Info

- **Subdomain:** https://tifootball.mebbert.com
- **Internal Port:** 3001
- **Status:** Awaiting deployment

### SSH Access
```bash
ssh -i "C:\claude_projects\taskschedule\taskschedule-key.pem" ec2-user@100.50.222.238
```

### Server Documentation
Full deployment docs on server: `/home/ec2-user/taskschedule/AWS_DEPLOYMENT.md`

### Nginx Config
Already configured in `/etc/nginx/conf.d/subdomains.conf` to proxy to port 3001.

### To Deploy
1. Copy app to `/home/ec2-user/tifootball/`
2. Run server on port 3001 (update server/index.js PORT)
3. Create systemd service (use `/etc/systemd/system/taskschedule.service` as template)
4. Enable and start: `sudo systemctl enable --now tifootball`

### Nginx Authentication
See `C:\claude_projects\recipeshoppinglist\CLAUDE.md` for instructions on nginx-level auth to protect all deployed apps.

---

## IMPORTANT: Season Setup Checklist

**After receiving the 272-game schedule JSON file:**

1. **Reset the database** (schema changed, need fresh start):
   ```bash
   cd server
   rm db/tifootball.db
   npm run seed
   ```

2. **Import the schedule** via API:
   ```bash
   # Using curl (or Postman, etc.)
   curl -X POST http://localhost:3002/api/schedule/import \
     -H "Content-Type: application/json" \
     -d @schedule.json
   ```

   Expected format:
   ```json
   {
     "games": [
       { "game_number": 1, "week": 1, "game_date": "Sep 5", "game_day": "Thursday", "away_team_id": 12, "home_team_id": 8 },
       { "game_number": 2, "week": 1, "game_date": "Sep 7", "game_day": "Sunday", "away_team_id": 3, "home_team_id": 15 },
       ...
     ]
   }
   ```

3. **Start the servers**:
   ```bash
   # Terminal 1 - Backend
   cd server && npm start

   # Terminal 2 - Frontend
   cd client && npm run dev
   ```

4. **Play games** - Each completed game automatically:
   - Saves full box score stats (40+ fields per team)
   - Saves scoring log for newspaper-style replay
   - Updates schedule (marks game as simulated)
   - Updates standings (W/L/T calculated from games table)

5. **Browse results** - Click "View Schedule & Results" to:
   - See all 272 games by week
   - Click completed games to view full box scores
   - Review scoring summaries

**Potential bugs to watch for during first games:**
- Stats not saving correctly (check browser console for API errors)
- Scoring log entries missing team_id
- Schedule not marking as complete after game
- Standings not updating (refresh page after game)

---

## Original Game Overview
This project simulates a football game originally created in 1979 on a TI-99/4a computer in BASIC by a 10-year-old developer.

## Game Features

### Player Interaction
- 2-player interactive game
- Turn-based gameplay with offensive/defensive roles

### Play Types (Player-Initiated)
- Kickoff returns
- Running plays
- Short passes
- Medium passes
- Long passes
- Punts
- Field goals
- Kneel downs

### Random Events
- Fumbles (during plays)
- Blocked punts
- Interceptions (probability increases with pass distance)

### Game Mechanics

#### Pass/Kick Tables
Each pass type, punt, and field goal kick utilized lookup tables containing:
- Completion percentages
- Interception percentages (higher for longer passes)
- Completion distances (yards gained)

#### Running Algorithm
- After successful pass completion, the active player could continue to advance the ball using the running algorithm
- Same running mechanics applied to kickoff returns and regular running plays

#### Clock Simulation
- Standard NFL game clock
- Random amount of time deducted per play
- Time deduction varied based on play type (runs vs passes vs kicks)

## Technical Context
- Platform: TI-99/4a home computer
- Language: BASIC
- Year: 1979
- Memory constraints and character-based display typical of the era

## Running Algorithm Details

The running algorithm is a number-matching game:

1. Player selects a number from 1-4
2. Computer randomly picks a number from 1-5
3. If numbers match: Player is tackled
   - On first match: lose 0-3 yards (random)
   - After N non-matches: gain N yards
4. If numbers don't match: Player advances 1 yard, repeat

**Probability Distribution (1-4 vs 1-5):**
- Loss of 0-3 yards: 20.00%
- Gain 1 yard: 16.00%
- Gain 2 yards: 12.80%
- Gain 3 yards: 10.24%
- Gain 4 yards: 8.19%
- Gain 5 yards: 6.55%
- Gain 6 yards: 5.24%
- Gain 7 yards: 4.19%
- Gain 8 yards: 3.36%
- Gain 9 yards: 2.68%
- Gain 10 yards: 2.15%
- Gain 11+ yards: 8.60%

**Expected value:** 3.7 yards per carry

**NFL Comparison (2024 season):**
- NFL average: 4.4 yards per carry
- NFL 10+ yard runs: 8.6% (nearly identical to our 11+ yard runs at 8.60%)
- NFL stuffed runs (elite backs): 14-17% at/behind line of scrimmage
- The algorithm provides realistic, slightly conservative rushing statistics

## 2025 Web App Implementation

### Technology Stack

**Frontend:**
- **Vite** - Fast build tool and dev server
- **React** - Component-based UI framework
- JSX for template rendering
- State management with React hooks (useState, useEffect)

**Backend:**
- **Node.js** - JavaScript runtime
- **Express** - Minimal API framework
- Simple REST endpoints for stats persistence

**Database:**
- **SQLite** - File-based database (no DBA needed)
- **sql.js** - Pure JavaScript SQLite implementation (no native compilation required)
- Works on any machine with Node.js - no C++ build tools needed
- Stores team statistics after each game

**Architecture:**
- Game simulation runs entirely client-side (browser)
- Backend only handles data persistence (save/load stats)
- No real-time server connection during gameplay
- Automated play-by-play with configurable delays

### User Experience Flow

1. Simulator runs a play
2. Play result displayed on screen
3. 5-second pause (configurable)
4. Game state updated: clock, field position, down/distance, score, stats
5. 5-second pause (configurable)
6. Next play runs automatically
7. Visitor watches game unfold play-by-play
8. Game stats saved to database upon completion

## Project Structure

```
tifootball/
├── client/                    # React frontend (Vite)
│   ├── public/                # Static assets
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── utils/             # Game logic utilities
│   │   ├── App.jsx            # Main app component
│   │   ├── App.css            # App styles
│   │   ├── main.jsx           # React entry point
│   │   └── index.css          # Global styles
│   ├── index.html             # HTML entry point
│   ├── package.json           # Client dependencies
│   └── vite.config.js         # Vite configuration
├── server/                    # Express backend
│   ├── db/                    # SQLite database location
│   ├── data/                  # JSON data files (teams, names)
│   ├── index.js               # Server entry point with all routes
│   ├── seed.js                # Database seeding script
│   ├── silent-simulator.js    # Headless game simulator
│   └── package.json           # Server dependencies
├── .gitignore                 # Git ignore rules
├── CLAUDE.md                  # Development notes (this file)
└── README.md                  # Project documentation
```

## Initial Setup Complete

### Created Files:

**Client (React + Vite):**
- `package.json` - React 18.3.1, Vite 6.0.5
- `vite.config.js` - Port 3000, proxy to API on 3002
- `index.html` - Entry point
- `src/main.jsx` - React bootstrap
- `src/App.jsx` - Main component with game state
- `src/index.css` - Global styles (monospace font for retro feel)
- `src/App.css` - Scoreboard and game display styles

**Server (Express + SQLite):**
- `package.json` - Express, sql.js, cors
- `index.js` - API server with routes and database setup
  - Database schema: `teams`, `coaches`, `games`, `game_stats`, `schedule`, `scoring_log` tables
  - REST endpoints for teams, coaches, games, schedule
  - Runs on port 3002

**Documentation:**
- `README.md` - Setup instructions and project overview
- `.gitignore` - Excludes node_modules, database files, build output

## Teams and Coaches System

### Data Sources

**US Census Surnames (2010)**
- Source: FiveThirtyEight GitHub repository (US Census Bureau data)
- File: `server/data/surnames.json`
- Contains: Top 1000 most common US surnames
- Examples: SMITH, JOHNSON, WILLIAMS, BROWN, JONES, etc.

**Common First Names**
- File: `server/data/firstnames.json`
- Contains: 200 curated common first names appropriate for coaches
- Examples: James, John, Robert, Michael, William, David, Richard, etc.
- Mix of traditional and contemporary names

**Combined Usage:**
- Coach names are generated by randomly selecting one first name and one surname
- Creates realistic variety (e.g., "Michael Smith", "Robert Johnson", "David Williams")

**NFL Teams**
- File: `server/data/nfl-teams.json`
- Contains: All 32 current NFL teams (2025 season)
- Data: ID, city, name, abbreviation, conference, division
- Examples: Arizona Cardinals (NFC West), Buffalo Bills (AFC East), etc.

### Database Schema

**teams table:**
- id (PRIMARY KEY)
- name (team name, e.g., "Cardinals")
- city (e.g., "Arizona")
- abbreviation (e.g., "ARI")
- division (e.g., "West")
- conference (e.g., "NFC")

**coaches table:**
- id (AUTO INCREMENT PRIMARY KEY)
- team_id (FOREIGN KEY to teams)
- last_name (randomly selected from surnames)
- first_name (randomly generated from firstnames.json)
- hired_date (timestamp)

### API Endpoints

**Teams:**
- `GET /api/teams` - List all teams with coach names
- `GET /api/teams/:id` - Get specific team with coach details
- `GET /api/teams/:id/games` - Get all games for a team
- `GET /api/teams/:id/stats` - Get aggregated season stats for a team

**Coaches:**
- `POST /api/coaches` - Create new coach with random surname for a team

**Games:**
- `GET /api/games` - List recent games
- `GET /api/games/:id` - Get full game detail (box score, scoring log)
- `GET /api/games/:id/scoring` - Get scoring log for a game
- `POST /api/games` - Save a completed game (stats, scoring log, links to schedule)

**Schedule:**
- `GET /api/schedule/next` - Get next unplayed game
- `GET /api/schedule/games` - Get full schedule with results
- `POST /api/schedule/import` - Bulk import schedule (272 games)

**Standings:**
- `GET /api/standings` - Get standings with W/L/T calculated from games

**Season Management:**
- `POST /api/season/reset` - Clear all games/stats, reset schedule to unplayed

**Utility:**
- `GET /api/surnames/random` - Get a random surname from the database

### Seeding the Database

Run the seed script to populate teams and assign random coaches:

```bash
cd server
npm run seed
```

This will:
1. Insert all 32 NFL teams
2. Assign a random coach (with Census surname) to each team
3. Display progress in console

Sources:
- [FiveThirtyEight US Census Surnames Data](https://github.com/fivethirtyeight/data/blob/master/most-common-name/surnames.csv)
- [US Census 2010 Surnames](https://www.census.gov/topics/population/genealogy/data/2010_surnames.html)

## Game Simulation Logic

### Time Management (Normal Distribution)

**Play Duration:**
- Mean: 28.6 seconds per play
- Standard deviation: ~11 seconds
- Distribution: Normal (bell curve) using Box-Muller transform
- Clamped: 5-50 seconds (minimum play to full delay of game clock)
- Calculation: 3,600 seconds (60 min) ÷ 126 average plays = 28.57s per play

**Coverage:**
- 68% of plays: 17-40 seconds
- 95% of plays: 7-50 seconds
- Outliers automatically clamped to 5-50 range

### Running Algorithm (1979 Original Logic)

**Tribute to original TI-99/4a game - NOT using bell curve**

**Algorithm:**
1. Player picks number 1-4 (simulated randomly)
2. Computer picks number 1-5 (random)
3. If match: Player is tackled
   - On first match (behind line): lose 0-3 yards (random)
   - After N advances: gain N yards
4. If no match: Advance 1 yard, repeat

**Probability Distribution:**
- Expected value: 3.7 yards per carry
- Loss (0-3 yards): 20%
- Gain 1 yard: 16%
- Gain 2 yards: 12.8%
- Gain 3 yards: 10.2%
- Gain 4 yards: 8.2%
- Gain 5+ yards: 32.8%

**Run After Catch (RAC):**
- Uses same algorithm as running plays (including breakaway mechanic)
- No negative yards (already have possession)
- Adds yards to completed pass distance

### Implementation

**File:** `client/src/utils/gameSimulation.js`

**Functions:**
- `generatePlayTime()` - Returns play duration in seconds (5-50)
- `runningPlay()` - Returns yards gained on run (-3 to 20+)
- `runAfterCatch()` - Returns additional yards after pass completion (0 to 20+)
- `formatGameClock(seconds)` - Converts to MM:SS format

**Constants:**
- `QUARTERS = 4`
- `QUARTER_LENGTH = 900` (15 minutes)
- `TOTAL_GAME_TIME = 3600` (60 minutes)
- `AVERAGE_PLAYS_PER_GAME = 126`
- `AVERAGE_SECONDS_PER_PLAY = 28.6`

## Logging System

**File:** `client/src/utils/logger.js`

### Log Levels (from most to least verbose):
- **DEBUG**: Detailed debugging info (each play, calculations)
- **INFO**: General information (game start, scores, turnovers) - DEFAULT
- **WARN**: Warning messages
- **ERROR**: Error messages only
- **OFF**: Disable all logging

### Usage in Code:
```javascript
import logger from './utils/logger'

logger.debug('Detailed debug information')
logger.info('General information')
logger.warn('Warning message')
logger.error('Error occurred')
```

### Change Log Level in Browser Console:
```javascript
localStorage.setItem('LOG_LEVEL', 'DEBUG')  // Show everything
localStorage.setItem('LOG_LEVEL', 'INFO')   // Default
localStorage.setItem('LOG_LEVEL', 'WARN')   // Warnings and errors only
localStorage.setItem('LOG_LEVEL', 'ERROR')  // Errors only
localStorage.setItem('LOG_LEVEL', 'OFF')    // Silent
```
Then refresh the page.

### Current Logging:
- **INFO**: Game initialization, touchdowns, field goals, turnovers
- **DEBUG**: Every play execution with down/distance/field position
- **ERROR**: API fetch errors, unexpected issues

### Next Steps:

1. ✅ Install dependencies: `npm install` in both client/ and server/
2. ✅ Run seed script: `cd server && npm run seed`
3. ✅ Implement game simulation logic in client/src/utils/
4. ✅ Create home page with standings and "Begin Game" button
5. ✅ Build running algorithm (1-4 vs 1-5 matching game)
6. ✅ Create logging system with configurable levels
7. ✅ Add pause control (1-5 seconds between plays)
8. ✅ Wire up game simulation to UI
9. ✅ Add animated running plays ("Running ...1 ...2 ...3")
10. ✅ Add TOUCHDOWN! display with extended pause
11. ✅ Add localStorage auto-save for game persistence
12. ✅ Create Silent Simulator for statistics research
13. ✅ Implement pass/kick probability tables
14. ✅ Add extra points after touchdowns
15. ✅ Add sacks with variable rates by pass type
16. ✅ Add scoring log for newspaper-style game summaries

## Silent Simulator

A headless game simulation tool for statistics research and game balance testing. Runs games using the exact same logic as the UI but without delays or rendering.

### Purpose

- Test game balance and mechanics without watching full games
- Gather statistics (yards per carry, points per game, etc.)
- Validate changes to game algorithms
- Research questions like "What's our average yards per carry?"

### How to Run

```bash
cd server

# Run 100 games (default)
npm run simulate

# Run 1000 games
npm run simulate:1000

# Run any number of games
node silent-simulator.js --games 5000
```

### Performance

- Runs ~14,000 games per second
- 10,000 games completes in under 1 second

### Sample Output

```
📊 Results (10000 games)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏆 Scoring:
  Avg points/game (total):    20.4
  Avg points/team/game:       10.2
  Avg touchdowns/game:        3.39

🏃 Rushing:
  Avg yards/carry:            4.52
  Avg rushing yards/game:     579.6
```

### Important Notes

- Uses the SAME code as the UI (`client/src/utils/gameEngine.js` and `gameSimulation.js`)
- Any changes to game logic automatically apply to both UI and Silent Simulator
- No need to update Silent Simulator separately when adding features

## Running Algorithm Tuning

The original 1979 algorithm (1-4 vs 1-5) produced 3.7 yards per carry. To match NFL's 4.4 average, we added a "breakaway" mechanic:

**Current Algorithm:**
- First 6 yards: Player picks 1-4, Defense picks 1-5 (20% tackle chance)
- After 6 yards: Player picks 1-4, Defense picks 1-7 (14.3% tackle chance)

**Result:** 4.52 yards per carry (verified via Silent Simulator with 10,000+ games)

This gives slightly above-NFL average, making for exciting games while staying realistic.

## Mechanics to Implement

1. Penalties (false start, holding, pass interference, etc.)

## Mechanics Completed

- ✅ Kickoff returns with 1-40 gauntlet algorithm, TD possibility, starting 5-8 yard line
- ✅ 2-point conversions with analytics-based decisions and coach tendencies (run/pass/short)
- ✅ Coin toss for kickoff receiver
- ✅ Safety tracking and display
- ✅ Punt return touchdowns
- ✅ Interception return touchdowns (pick-sixes)
- ✅ Coach AI using play tendency tables (run/short/medium/long per situation)
- ✅ Overtime (15 min, each team possesses once unless defensive TD, tie if clock expires)
- ✅ Red zone pass restrictions (no long inside 30, no medium inside 15)
- ✅ Red zone aggression per coach (-10 to +10, positive = more passes)
- ✅ Q4 4th down decisions based on clock and score (desperation mode, clock killing, late game adjustments)
- ✅ Game persistence (full stats saved to database after each game)
- ✅ Schedule tracking (games marked complete, linked to results)
- ✅ Standings calculated from actual game results (W/L/T, PF/PA)
- ✅ Game browser UI (view schedule, box scores, scoring summaries)

## Coach Tendency System

Each coach has unique play-calling tendencies stored in the database. Tendencies are per-situation:

**Situations:** 1st_10, 2nd_short, 2nd_medium, 2nd_long, 3rd_short, 3rd_medium, 3rd_long, 4th_short, 4th_medium, 4th_long

**Play Types:** run, short pass, medium pass, long pass (percentages sum to 100)

### Generation Ranges (normalized to 100%)

| Situation | Run | Short | Medium | Long | Notes |
|-----------|-----|-------|--------|------|-------|
| 1st_10 | 35-55 | 20-35 | 12-25 | 4-15 | Base |
| 2nd/3rd short | 45-65 | 15-30 | 8-20 | 2-10 | Run heavy |
| 2nd/3rd medium | 30-50 | 22-37 | 14-27 | 5-16 | Slight pass |
| 2nd/3rd long | 25-45 | 22-37 | 15-28 | 6-18 | Pass heavy |

### Usage

Teams passed to `initializeGame()` can include tendencies:
```javascript
const team = {
  id: 1,
  name: 'Cardinals',
  tendencies: {
    '1st_10': { run: 45, short: 28, medium: 18, long: 9 },
    '2nd_short': { run: 52, short: 24, medium: 16, long: 8 },
    // ... etc
  }
}
```

If tendencies are not provided, defaults from `GAME_CONSTANTS.DEFAULT_TENDENCIES` are used.

## Tabled for Later

### Core Mechanics
- Blocked punts (was in original 1979 game)
- Kneel downs (clock management, was in original 1979 game)
- Two-minute warning
- Timeouts
- Spike plays (stop clock)

### Season/League Features
- Playoffs / Super Bowl bracket
- Realistic NFL schedule (6 division games, weighted conference matchups)
- Standings tiebreakers (head-to-head, division record, strength of schedule)
- Historical records (franchise records, league records)

### UI/Frontend
- Live game display polish
- Play-by-play feed with scrolling history
- Team season stats page (aggregated from all games)

### Game Depth
- Home field advantage
- Weather effects (rain, snow, wind affecting passes/kicks)
- Onside kicks
- Field goal blocks
- Missed FG return for TD
- Punt blocks
- Fumble return touchdowns
- Kickoff out of bounds penalty
- Blitzing (higher sack rate, higher big play risk)
- Coverage schemes affecting pass completion rates
