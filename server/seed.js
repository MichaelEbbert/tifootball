import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load data files
const teams = JSON.parse(
  readFileSync(join(__dirname, 'data', 'nfl-teams.json'), 'utf-8')
)
const surnames = JSON.parse(
  readFileSync(join(__dirname, 'data', 'surnames.json'), 'utf-8')
)
const firstNames = JSON.parse(
  readFileSync(join(__dirname, 'data', 'firstnames.json'), 'utf-8')
)

// Initialize database
const db = new Database(join(__dirname, 'db', 'tifootball.db'))

// Helper functions
function getRandomSurname() {
  return surnames[Math.floor(Math.random() * surnames.length)]
}

function getRandomFirstName() {
  return firstNames[Math.floor(Math.random() * firstNames.length)]
}

console.log('🏈 Seeding TI Football database...\n')

// Create tables if they don't exist
console.log('Creating database tables...')
db.exec(`
  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    abbreviation TEXT NOT NULL UNIQUE,
    division TEXT NOT NULL,
    conference TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS coaches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL,
    last_name TEXT NOT NULL,
    first_name TEXT,
    hired_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id)
  );

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
  );

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
  );
`)
console.log('✓ Tables created\n')

// Insert teams
console.log('Inserting NFL teams...')
const insertTeam = db.prepare(`
  INSERT OR REPLACE INTO teams (id, name, city, abbreviation, division, conference)
  VALUES (?, ?, ?, ?, ?, ?)
`)

const insertCoach = db.prepare(`
  INSERT INTO coaches (team_id, first_name, last_name)
  VALUES (?, ?, ?)
`)

let teamCount = 0
let coachCount = 0

teams.forEach(team => {
  insertTeam.run(
    team.id,
    team.name,
    team.city,
    team.abbreviation,
    team.division,
    team.conference
  )
  teamCount++

  // Assign a random coach to each team
  const coachFirstName = getRandomFirstName()
  const coachLastName = getRandomSurname()
  insertCoach.run(team.id, coachFirstName, coachLastName)
  coachCount++

  console.log(`  ✓ ${team.city} ${team.name} - Coach ${coachFirstName} ${coachLastName}`)
})

console.log(`\n✅ Seeding complete!`)
console.log(`   ${teamCount} teams inserted`)
console.log(`   ${coachCount} coaches assigned\n`)

db.close()
