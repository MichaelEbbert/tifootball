import express from 'express'
import cors from 'cors'
import initSqlJs from 'sql.js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = 3002

// Middleware
app.use(cors())
app.use(express.json())

// Load name data from JSON files
const surnames = JSON.parse(
  readFileSync(join(__dirname, 'data', 'surnames.json'), 'utf-8')
)
const firstNames = JSON.parse(
  readFileSync(join(__dirname, 'data', 'firstnames.json'), 'utf-8')
)

// Database path
const dbPath = join(__dirname, 'db', 'tifootball.db')

// Initialize SQLite database
let db

async function initDatabase() {
  const SQL = await initSqlJs()

  // Load existing database or create new one
  if (existsSync(dbPath)) {
    const fileBuffer = readFileSync(dbPath)
    db = new SQL.Database(fileBuffer)
  } else {
    db = new SQL.Database()
  }

  // Create tables if they don't exist
  db.run(`
    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      abbreviation TEXT NOT NULL UNIQUE,
      division TEXT NOT NULL,
      conference TEXT NOT NULL
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS coaches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      last_name TEXT NOT NULL,
      first_name TEXT,
      hired_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (team_id) REFERENCES teams(id)
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS schedule (
      game_number INTEGER PRIMARY KEY,
      week INTEGER NOT NULL,
      game_date TEXT NOT NULL,
      game_day TEXT NOT NULL,
      away_team_id INTEGER NOT NULL,
      home_team_id INTEGER NOT NULL,
      simulated INTEGER DEFAULT 0,
      game_id INTEGER,
      FOREIGN KEY (away_team_id) REFERENCES teams(id),
      FOREIGN KEY (home_team_id) REFERENCES teams(id),
      FOREIGN KEY (game_id) REFERENCES games(id)
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      home_team_id INTEGER NOT NULL,
      away_team_id INTEGER NOT NULL,
      home_score INTEGER NOT NULL,
      away_score INTEGER NOT NULL,
      total_plays INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (home_team_id) REFERENCES teams(id),
      FOREIGN KEY (away_team_id) REFERENCES teams(id)
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS game_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      team_id INTEGER NOT NULL,
      -- Rushing
      rushing_attempts INTEGER DEFAULT 0,
      rushing_yards INTEGER DEFAULT 0,
      rushing_touchdowns INTEGER DEFAULT 0,
      rushing_fumbles INTEGER DEFAULT 0,
      rushing_fumbles_lost INTEGER DEFAULT 0,
      -- Passing
      pass_attempts INTEGER DEFAULT 0,
      pass_completions INTEGER DEFAULT 0,
      pass_yards INTEGER DEFAULT 0,
      pass_rac_yards INTEGER DEFAULT 0,
      pass_touchdowns INTEGER DEFAULT 0,
      pass_interceptions INTEGER DEFAULT 0,
      -- Sacks
      sacks INTEGER DEFAULT 0,
      sack_yards_lost INTEGER DEFAULT 0,
      sack_fumbles INTEGER DEFAULT 0,
      sack_fumbles_lost INTEGER DEFAULT 0,
      -- Receiving fumbles
      rec_fumbles INTEGER DEFAULT 0,
      rec_fumbles_lost INTEGER DEFAULT 0,
      -- Conversions
      first_downs INTEGER DEFAULT 0,
      third_down_attempts INTEGER DEFAULT 0,
      third_down_conversions INTEGER DEFAULT 0,
      fourth_down_attempts INTEGER DEFAULT 0,
      fourth_down_conversions INTEGER DEFAULT 0,
      -- Scoring
      xp_attempted INTEGER DEFAULT 0,
      xp_made INTEGER DEFAULT 0,
      two_pt_attempted INTEGER DEFAULT 0,
      two_pt_made INTEGER DEFAULT 0,
      fg_attempted INTEGER DEFAULT 0,
      fg_made INTEGER DEFAULT 0,
      safeties_scored INTEGER DEFAULT 0,
      -- Special teams
      kick_return_attempts INTEGER DEFAULT 0,
      kick_return_yards INTEGER DEFAULT 0,
      kick_return_touchdowns INTEGER DEFAULT 0,
      punt_return_attempts INTEGER DEFAULT 0,
      punt_return_yards INTEGER DEFAULT 0,
      punt_return_touchdowns INTEGER DEFAULT 0,
      int_return_yards INTEGER DEFAULT 0,
      int_return_touchdowns INTEGER DEFAULT 0,
      -- Time
      time_of_possession INTEGER DEFAULT 0,
      -- Legacy columns for backwards compatibility
      passing_yards INTEGER DEFAULT 0,
      total_yards INTEGER DEFAULT 0,
      turnovers INTEGER DEFAULT 0,
      FOREIGN KEY (game_id) REFERENCES games(id),
      FOREIGN KEY (team_id) REFERENCES teams(id)
    )
  `)

  // Scoring log for newspaper-style game summaries
  db.run(`
    CREATE TABLE IF NOT EXISTS scoring_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      quarter INTEGER NOT NULL,
      time_remaining INTEGER NOT NULL,
      team_id INTEGER NOT NULL,
      score_type TEXT NOT NULL,
      play_type TEXT,
      yards INTEGER,
      extra_point TEXT,
      home_score INTEGER NOT NULL,
      away_score INTEGER NOT NULL,
      description TEXT,
      FOREIGN KEY (game_id) REFERENCES games(id),
      FOREIGN KEY (team_id) REFERENCES teams(id)
    )
  `)

  saveDatabase()
}

function saveDatabase() {
  const data = db.export()
  const buffer = Buffer.from(data)
  writeFileSync(dbPath, buffer)
}

// Helper function to run a query and get all results
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql)
  if (params.length > 0) {
    stmt.bind(params)
  }
  const results = []
  while (stmt.step()) {
    results.push(stmt.getAsObject())
  }
  stmt.free()
  return results
}

// Helper function to run a query and get one result
function queryOne(sql, params = []) {
  const results = queryAll(sql, params)
  return results.length > 0 ? results[0] : null
}

// Helper function to run an insert/update/delete
function runSql(sql, params = []) {
  db.run(sql, params)
  saveDatabase()
  // Get last insert rowid
  const result = queryOne('SELECT last_insert_rowid() as id')
  return { lastInsertRowid: result ? result.id : null }
}

// Utility functions
function getRandomSurname() {
  return surnames[Math.floor(Math.random() * surnames.length)]
}

function getRandomFirstName() {
  return firstNames[Math.floor(Math.random() * firstNames.length)]
}

function createCoachForTeam(teamId) {
  const firstName = getRandomFirstName()
  const lastName = getRandomSurname()
  const result = runSql(
    'INSERT INTO coaches (team_id, first_name, last_name) VALUES (?, ?, ?)',
    [teamId, firstName, lastName]
  )
  return { id: result.lastInsertRowid, firstName, lastName, teamId }
}

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'TI Football API is running' })
})

// Teams routes
app.get('/api/teams', (req, res) => {
  const teams = queryAll(`
    SELECT t.*, c.first_name as coach_first_name, c.last_name as coach_last_name
    FROM teams t
    LEFT JOIN coaches c ON t.id = c.team_id
    ORDER BY t.conference, t.division, t.name
  `)
  res.json(teams)
})

app.get('/api/teams/:id', (req, res) => {
  const team = queryOne(`
    SELECT t.*, c.first_name as coach_first_name, c.last_name as coach_last_name, c.id as coach_id
    FROM teams t
    LEFT JOIN coaches c ON t.id = c.team_id
    WHERE t.id = ?
  `, [parseInt(req.params.id)])

  if (!team) {
    return res.status(404).json({ error: 'Team not found' })
  }

  res.json(team)
})

// Coaches routes
app.post('/api/coaches', (req, res) => {
  const { team_id } = req.body

  if (!team_id) {
    return res.status(400).json({ error: 'team_id is required' })
  }

  const coach = createCoachForTeam(team_id)
  res.json(coach)
})

app.get('/api/surnames/random', (req, res) => {
  res.json({ surname: getRandomSurname() })
})

// Schedule routes
app.get('/api/schedule/next', (req, res) => {
  const nextGame = queryOne(`
    SELECT s.*,
           away.city as away_city, away.name as away_name, away.abbreviation as away_abbr,
           home.city as home_city, home.name as home_name, home.abbreviation as home_abbr
    FROM schedule s
    JOIN teams away ON s.away_team_id = away.id
    JOIN teams home ON s.home_team_id = home.id
    WHERE s.simulated = 0
    ORDER BY s.game_number
    LIMIT 1
  `)

  if (!nextGame) {
    return res.status(404).json({ error: 'No unplayed games found' })
  }

  res.json(nextGame)
})

// Standings route - calculates W/L/T from games table
app.get('/api/standings', (req, res) => {
  const standings = queryAll(`
    SELECT
      t.*,
      c.first_name as coach_first_name,
      c.last_name as coach_last_name,
      COALESCE(w.wins, 0) as wins,
      COALESCE(l.losses, 0) as losses,
      COALESCE(ti.ties, 0) as ties,
      COALESCE(pf.points_for, 0) as points_for,
      COALESCE(pa.points_against, 0) as points_against
    FROM teams t
    LEFT JOIN coaches c ON t.id = c.team_id
    LEFT JOIN (
      SELECT team_id, COUNT(*) as wins FROM (
        SELECT home_team_id as team_id FROM games WHERE home_score > away_score
        UNION ALL
        SELECT away_team_id as team_id FROM games WHERE away_score > home_score
      ) GROUP BY team_id
    ) w ON t.id = w.team_id
    LEFT JOIN (
      SELECT team_id, COUNT(*) as losses FROM (
        SELECT home_team_id as team_id FROM games WHERE home_score < away_score
        UNION ALL
        SELECT away_team_id as team_id FROM games WHERE away_score < home_score
      ) GROUP BY team_id
    ) l ON t.id = l.team_id
    LEFT JOIN (
      SELECT team_id, COUNT(*) as ties FROM (
        SELECT home_team_id as team_id FROM games WHERE home_score = away_score
        UNION ALL
        SELECT away_team_id as team_id FROM games WHERE away_score = home_score
      ) GROUP BY team_id
    ) ti ON t.id = ti.team_id
    LEFT JOIN (
      SELECT team_id, SUM(points) as points_for FROM (
        SELECT home_team_id as team_id, home_score as points FROM games
        UNION ALL
        SELECT away_team_id as team_id, away_score as points FROM games
      ) GROUP BY team_id
    ) pf ON t.id = pf.team_id
    LEFT JOIN (
      SELECT team_id, SUM(points) as points_against FROM (
        SELECT home_team_id as team_id, away_score as points FROM games
        UNION ALL
        SELECT away_team_id as team_id, home_score as points FROM games
      ) GROUP BY team_id
    ) pa ON t.id = pa.team_id
    ORDER BY t.conference, t.division, (COALESCE(w.wins, 0) * 2 + COALESCE(ti.ties, 0)) DESC, t.name
  `)

  res.json(standings)
})

app.get('/api/games', (req, res) => {
  const games = queryAll('SELECT * FROM games ORDER BY created_at DESC LIMIT 50')
  res.json(games)
})

app.post('/api/games', (req, res) => {
  const { home_team, away_team, home_score, away_score, total_plays, stats, scoring_log, schedule_game_number } = req.body

  const result = runSql(
    'INSERT INTO games (home_team_id, away_team_id, home_score, away_score, total_plays) VALUES (?, ?, ?, ?, ?)',
    [home_team, away_team, home_score, away_score, total_plays]
  )
  const gameId = result.lastInsertRowid

  // Insert stats for both teams (full stats)
  if (stats) {
    stats.forEach(stat => {
      runSql(
        `INSERT INTO game_stats (
          game_id, team_id,
          rushing_attempts, rushing_yards, rushing_touchdowns, rushing_fumbles, rushing_fumbles_lost,
          pass_attempts, pass_completions, pass_yards, pass_rac_yards, pass_touchdowns, pass_interceptions,
          sacks, sack_yards_lost, sack_fumbles, sack_fumbles_lost,
          rec_fumbles, rec_fumbles_lost,
          first_downs, third_down_attempts, third_down_conversions, fourth_down_attempts, fourth_down_conversions,
          xp_attempted, xp_made, two_pt_attempted, two_pt_made, fg_attempted, fg_made, safeties_scored,
          kick_return_attempts, kick_return_yards, kick_return_touchdowns,
          punt_return_attempts, punt_return_yards, punt_return_touchdowns,
          int_return_yards, int_return_touchdowns,
          time_of_possession,
          passing_yards, total_yards, turnovers
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          gameId, stat.team_id,
          stat.rushing_attempts || 0, stat.rushing_yards || 0, stat.rushing_touchdowns || 0, stat.rushing_fumbles || 0, stat.rushing_fumbles_lost || 0,
          stat.pass_attempts || 0, stat.pass_completions || 0, stat.pass_yards || 0, stat.pass_rac_yards || 0, stat.pass_touchdowns || 0, stat.pass_interceptions || 0,
          stat.sacks || 0, stat.sack_yards_lost || 0, stat.sack_fumbles || 0, stat.sack_fumbles_lost || 0,
          stat.rec_fumbles || 0, stat.rec_fumbles_lost || 0,
          stat.first_downs || 0, stat.third_down_attempts || 0, stat.third_down_conversions || 0, stat.fourth_down_attempts || 0, stat.fourth_down_conversions || 0,
          stat.xp_attempted || 0, stat.xp_made || 0, stat.two_pt_attempted || 0, stat.two_pt_made || 0, stat.fg_attempted || 0, stat.fg_made || 0, stat.safeties_scored || 0,
          stat.kick_return_attempts || 0, stat.kick_return_yards || 0, stat.kick_return_touchdowns || 0,
          stat.punt_return_attempts || 0, stat.punt_return_yards || 0, stat.punt_return_touchdowns || 0,
          stat.int_return_yards || 0, stat.int_return_touchdowns || 0,
          stat.time_of_possession || 0,
          stat.pass_yards || 0, (stat.rushing_yards || 0) + (stat.pass_yards || 0), stat.turnovers || 0
        ]
      )
    })
  }

  // Insert scoring log entries
  if (scoring_log && scoring_log.length > 0) {
    scoring_log.forEach(entry => {
      runSql(
        `INSERT INTO scoring_log (game_id, quarter, time_remaining, team_id, score_type, play_type, yards, extra_point, home_score, away_score, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [gameId, entry.quarter, entry.time_remaining, entry.team_id, entry.score_type, entry.play_type, entry.yards, entry.extra_point, entry.home_score, entry.away_score, entry.description]
      )
    })
  }

  // Mark schedule entry as completed and link to game
  if (schedule_game_number) {
    runSql(
      'UPDATE schedule SET simulated = 1, game_id = ? WHERE game_number = ?',
      [gameId, schedule_game_number]
    )
  }

  res.json({ id: gameId, message: 'Game saved successfully' })
})

// Get scoring log for a game
app.get('/api/games/:id/scoring', (req, res) => {
  const gameId = parseInt(req.params.id)
  const scoringLog = queryAll(`
    SELECT sl.*, t.abbreviation as team_abbr, t.name as team_name
    FROM scoring_log sl
    JOIN teams t ON sl.team_id = t.id
    WHERE sl.game_id = ?
    ORDER BY sl.id
  `, [gameId])
  res.json(scoringLog)
})

// Get full game details (for reliving games)
app.get('/api/games/:id', (req, res) => {
  const gameId = parseInt(req.params.id)

  const game = queryOne(`
    SELECT g.*,
           home.city as home_city, home.name as home_name, home.abbreviation as home_abbr,
           away.city as away_city, away.name as away_name, away.abbreviation as away_abbr
    FROM games g
    JOIN teams home ON g.home_team_id = home.id
    JOIN teams away ON g.away_team_id = away.id
    WHERE g.id = ?
  `, [gameId])

  if (!game) {
    return res.status(404).json({ error: 'Game not found' })
  }

  const stats = queryAll(`
    SELECT gs.*, t.name as team_name, t.abbreviation as team_abbr
    FROM game_stats gs
    JOIN teams t ON gs.team_id = t.id
    WHERE gs.game_id = ?
  `, [gameId])

  const scoringLog = queryAll(`
    SELECT sl.*, t.abbreviation as team_abbr, t.name as team_name
    FROM scoring_log sl
    JOIN teams t ON sl.team_id = t.id
    WHERE sl.game_id = ?
    ORDER BY sl.id
  `, [gameId])

  res.json({ game, stats, scoringLog })
})

// Get all games for a team (season history)
app.get('/api/teams/:id/games', (req, res) => {
  const teamId = parseInt(req.params.id)
  const games = queryAll(`
    SELECT g.*,
           home.city as home_city, home.name as home_name, home.abbreviation as home_abbr,
           away.city as away_city, away.name as away_name, away.abbreviation as away_abbr,
           s.week, s.game_number
    FROM games g
    JOIN teams home ON g.home_team_id = home.id
    JOIN teams away ON g.away_team_id = away.id
    LEFT JOIN schedule s ON s.game_id = g.id
    WHERE g.home_team_id = ? OR g.away_team_id = ?
    ORDER BY s.game_number, g.created_at
  `, [teamId, teamId])
  res.json(games)
})

// Get season stats for a team (aggregated from all games)
app.get('/api/teams/:id/stats', (req, res) => {
  const teamId = parseInt(req.params.id)
  const stats = queryOne(`
    SELECT
      team_id,
      COUNT(*) as games_played,
      SUM(rushing_attempts) as rushing_attempts,
      SUM(rushing_yards) as rushing_yards,
      SUM(rushing_touchdowns) as rushing_touchdowns,
      SUM(rushing_fumbles) as rushing_fumbles,
      SUM(rushing_fumbles_lost) as rushing_fumbles_lost,
      SUM(pass_attempts) as pass_attempts,
      SUM(pass_completions) as pass_completions,
      SUM(pass_yards) as pass_yards,
      SUM(pass_rac_yards) as pass_rac_yards,
      SUM(pass_touchdowns) as pass_touchdowns,
      SUM(pass_interceptions) as pass_interceptions,
      SUM(sacks) as sacks,
      SUM(sack_yards_lost) as sack_yards_lost,
      SUM(first_downs) as first_downs,
      SUM(third_down_attempts) as third_down_attempts,
      SUM(third_down_conversions) as third_down_conversions,
      SUM(fourth_down_attempts) as fourth_down_attempts,
      SUM(fourth_down_conversions) as fourth_down_conversions,
      SUM(xp_attempted) as xp_attempted,
      SUM(xp_made) as xp_made,
      SUM(two_pt_attempted) as two_pt_attempted,
      SUM(two_pt_made) as two_pt_made,
      SUM(fg_attempted) as fg_attempted,
      SUM(fg_made) as fg_made,
      SUM(safeties_scored) as safeties_scored,
      SUM(kick_return_attempts) as kick_return_attempts,
      SUM(kick_return_yards) as kick_return_yards,
      SUM(kick_return_touchdowns) as kick_return_touchdowns,
      SUM(time_of_possession) as time_of_possession
    FROM game_stats
    WHERE team_id = ?
    GROUP BY team_id
  `, [teamId])
  res.json(stats || { team_id: teamId, games_played: 0 })
})

// Get list of all games in order (for game browser)
app.get('/api/schedule/games', (req, res) => {
  const games = queryAll(`
    SELECT
      s.game_number, s.week, s.game_date, s.game_day, s.simulated,
      away.city as away_city, away.name as away_name, away.abbreviation as away_abbr,
      home.city as home_city, home.name as home_name, home.abbreviation as home_abbr,
      g.id as game_id, g.home_score, g.away_score
    FROM schedule s
    JOIN teams away ON s.away_team_id = away.id
    JOIN teams home ON s.home_team_id = home.id
    LEFT JOIN games g ON s.game_id = g.id
    ORDER BY s.game_number
  `)
  res.json(games)
})

// Import schedule (bulk insert)
app.post('/api/schedule/import', (req, res) => {
  const { games } = req.body

  if (!games || !Array.isArray(games)) {
    return res.status(400).json({ error: 'games array is required' })
  }

  let imported = 0
  games.forEach(game => {
    runSql(
      `INSERT OR REPLACE INTO schedule (game_number, week, game_date, game_day, away_team_id, home_team_id, simulated)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [game.game_number, game.week, game.game_date, game.game_day, game.away_team_id, game.home_team_id]
    )
    imported++
  })

  res.json({ message: `Imported ${imported} games` })
})

// Clear all game data (for resetting a season)
app.post('/api/season/reset', (req, res) => {
  runSql('DELETE FROM scoring_log')
  runSql('DELETE FROM game_stats')
  runSql('DELETE FROM games')
  runSql('UPDATE schedule SET simulated = 0, game_id = NULL')
  res.json({ message: 'Season reset successfully' })
})

// Initialize database and start server
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`TI Football API server running on http://localhost:${PORT}`)
  })
}).catch(err => {
  console.error('Failed to initialize database:', err)
  process.exit(1)
})
