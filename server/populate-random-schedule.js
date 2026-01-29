import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const db = new Database(join(__dirname, 'db', 'tifootball.db'))

console.log('🏈 Populating random schedule games...\n')

// Create schedule table if it doesn't exist
db.exec(`
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
  );
`)
console.log('✓ Schedule table ready\n')

// Get all team IDs
const teams = db.prepare('SELECT id FROM teams').all()
const teamIds = teams.map(t => t.id)

const days = ['Thursday', 'Friday', 'Saturday', 'Sunday', 'Monday']
const startDate = new Date('2025-09-04')

// Clear existing schedule
db.prepare('DELETE FROM schedule').run()
console.log('✓ Cleared existing schedule\n')

const insertGame = db.prepare(`
  INSERT INTO schedule (game_number, week, game_date, game_day, away_team_id, home_team_id)
  VALUES (?, ?, ?, ?, ?, ?)
`)

// Generate 10 random games
for (let i = 1; i <= 10; i++) {
  // Random week 1-18
  const week = Math.floor(Math.random() * 18) + 1

  // Random date (add 0-120 days to start date for variety)
  const date = new Date(startDate)
  date.setDate(date.getDate() + Math.floor(Math.random() * 120))
  const gameDate = date.toISOString().split('T')[0]

  // Random day of week
  const gameDay = days[Math.floor(Math.random() * days.length)]

  // Random away and home teams (ensure different)
  let awayTeamId = teamIds[Math.floor(Math.random() * teamIds.length)]
  let homeTeamId = teamIds[Math.floor(Math.random() * teamIds.length)]
  while (homeTeamId === awayTeamId) {
    homeTeamId = teamIds[Math.floor(Math.random() * teamIds.length)]
  }

  insertGame.run(i, week, gameDate, gameDay, awayTeamId, homeTeamId)

  // Get team names for display
  const awayTeam = db.prepare('SELECT city, name FROM teams WHERE id = ?').get(awayTeamId)
  const homeTeam = db.prepare('SELECT city, name FROM teams WHERE id = ?').get(homeTeamId)

  console.log(`Game ${i}: Week ${week}, ${gameDate} (${gameDay})`)
  console.log(`  ${awayTeam.city} ${awayTeam.name} @ ${homeTeam.city} ${homeTeam.name}`)
}

console.log('\n✅ 10 random games created!')

db.close()
