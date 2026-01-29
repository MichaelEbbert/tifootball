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
      rushing_yards INTEGER,
      passing_yards INTEGER,
      total_yards INTEGER,
      turnovers INTEGER,
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

// Standings route
app.get('/api/standings', (req, res) => {
  // For now, return teams with 0-0 records
  // Will be updated when we track game results
  const standings = queryAll(`
    SELECT t.*, c.first_name as coach_first_name, c.last_name as coach_last_name,
           0 as wins, 0 as losses, 0 as ties
    FROM teams t
    LEFT JOIN coaches c ON t.id = c.team_id
    ORDER BY t.conference, t.division, t.name
  `)

  res.json(standings)
})

app.get('/api/games', (req, res) => {
  const games = queryAll('SELECT * FROM games ORDER BY created_at DESC LIMIT 50')
  res.json(games)
})

app.post('/api/games', (req, res) => {
  const { home_team, away_team, home_score, away_score, total_plays, stats } = req.body

  const result = runSql(
    'INSERT INTO games (home_team_id, away_team_id, home_score, away_score, total_plays) VALUES (?, ?, ?, ?, ?)',
    [home_team, away_team, home_score, away_score, total_plays]
  )
  const gameId = result.lastInsertRowid

  // Insert stats for both teams
  if (stats) {
    stats.forEach(stat => {
      runSql(
        'INSERT INTO game_stats (game_id, team_id, rushing_yards, passing_yards, total_yards, turnovers) VALUES (?, ?, ?, ?, ?, ?)',
        [gameId, stat.team, stat.rushing_yards, stat.passing_yards, stat.total_yards, stat.turnovers]
      )
    })
  }

  res.json({ id: gameId, message: 'Game saved successfully' })
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
