import initSqlJs from 'sql.js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'

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

// Database path
const dbDir = join(__dirname, 'db')
const dbPath = join(dbDir, 'tifootball.db')

// Ensure db directory exists
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true })
}

// Helper functions
function getRandomSurname() {
  return surnames[Math.floor(Math.random() * surnames.length)]
}

function getRandomFirstName() {
  return firstNames[Math.floor(Math.random() * firstNames.length)]
}

async function seed() {
  console.log('Seeding TI Football database...\n')

  const SQL = await initSqlJs()

  // Always create a fresh database for seeding
  const db = new SQL.Database()

  // Create tables
  console.log('Creating database tables...')
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
  console.log('Tables created\n')

  // Insert teams
  console.log('Inserting NFL teams...')

  let teamCount = 0
  let coachCount = 0

  teams.forEach(team => {
    db.run(
      'INSERT OR REPLACE INTO teams (id, name, city, abbreviation, division, conference) VALUES (?, ?, ?, ?, ?, ?)',
      [team.id, team.name, team.city, team.abbreviation, team.division, team.conference]
    )
    teamCount++

    // Assign a random coach to each team
    const coachFirstName = getRandomFirstName()
    const coachLastName = getRandomSurname()
    db.run(
      'INSERT INTO coaches (team_id, first_name, last_name) VALUES (?, ?, ?)',
      [team.id, coachFirstName, coachLastName]
    )
    coachCount++

    console.log(`  ${team.city} ${team.name} - Coach ${coachFirstName} ${coachLastName}`)
  })

  // Save database to file
  const data = db.export()
  const buffer = Buffer.from(data)
  writeFileSync(dbPath, buffer)

  console.log(`\nSeeding complete!`)
  console.log(`   ${teamCount} teams inserted`)
  console.log(`   ${coachCount} coaches assigned\n`)

  db.close()
}

seed().catch(err => {
  console.error('Seeding failed:', err)
  process.exit(1)
})
