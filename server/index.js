import express from 'express'
import cors from 'cors'
import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = 3001

// Middleware
app.use(cors())
app.use(express.json())

// Initialize SQLite database
const db = new Database(join(__dirname, 'db', 'tifootball.db'))

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    home_score INTEGER NOT NULL,
    away_score INTEGER NOT NULL,
    total_plays INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS game_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    team TEXT NOT NULL,
    rushing_yards INTEGER,
    passing_yards INTEGER,
    total_yards INTEGER,
    turnovers INTEGER,
    FOREIGN KEY (game_id) REFERENCES games(id)
  );
`)

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'TI Football API is running' })
})

app.get('/api/games', (req, res) => {
  const games = db.prepare('SELECT * FROM games ORDER BY created_at DESC LIMIT 50').all()
  res.json(games)
})

app.post('/api/games', (req, res) => {
  const { home_team, away_team, home_score, away_score, total_plays, stats } = req.body

  const insertGame = db.prepare(`
    INSERT INTO games (home_team, away_team, home_score, away_score, total_plays)
    VALUES (?, ?, ?, ?, ?)
  `)

  const insertStats = db.prepare(`
    INSERT INTO game_stats (game_id, team, rushing_yards, passing_yards, total_yards, turnovers)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const result = insertGame.run(home_team, away_team, home_score, away_score, total_plays)
  const gameId = result.lastInsertRowid

  // Insert stats for both teams
  if (stats) {
    stats.forEach(stat => {
      insertStats.run(
        gameId,
        stat.team,
        stat.rushing_yards,
        stat.passing_yards,
        stat.total_yards,
        stat.turnovers
      )
    })
  }

  res.json({ id: gameId, message: 'Game saved successfully' })
})

app.listen(PORT, () => {
  console.log(`TI Football API server running on http://localhost:${PORT}`)
})
