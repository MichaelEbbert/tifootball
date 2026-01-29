# TI Football Game - 1979 BASIC Simulation

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
- **better-sqlite3** - Synchronous Node.js library for SQLite
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
│   ├── routes/                # API route handlers
│   ├── models/                # Database models
│   ├── index.js               # Server entry point
│   └── package.json           # Server dependencies
├── .gitignore                 # Git ignore rules
├── CLAUDE.md                  # Development notes (this file)
└── README.md                  # Project documentation
```

## Initial Setup Complete

### Created Files:

**Client (React + Vite):**
- `package.json` - React 18.3.1, Vite 6.0.5
- `vite.config.js` - Port 3000, proxy to API on 3001
- `index.html` - Entry point
- `src/main.jsx` - React bootstrap
- `src/App.jsx` - Main component with game state
- `src/index.css` - Global styles (monospace font for retro feel)
- `src/App.css` - Scoreboard and game display styles

**Server (Express + SQLite):**
- `package.json` - Express, better-sqlite3, cors
- `index.js` - API server with routes and database setup
  - Database schema: `games` and `game_stats` tables
  - REST endpoints: GET /api/games, POST /api/games
  - Runs on port 3001

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
- first_name (optional, currently NULL)
- hired_date (timestamp)

### API Endpoints

**Teams:**
- `GET /api/teams` - List all teams with coach names
- `GET /api/teams/:id` - Get specific team with coach details

**Coaches:**
- `POST /api/coaches` - Create new coach with random surname for a team

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

### Next Steps:

1. Install dependencies: `npm install` in both client/ and server/
2. Run seed script: `cd server && npm run seed`
3. Implement game simulation logic in client/src/utils/
4. Create React components for scoreboard, play-by-play, stats
5. Build running algorithm (1-4 vs 1-5 matching game)
6. Implement pass/kick probability tables
7. Add automated play sequencing with configurable delays
