import initSqlJs from 'sql.js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const dbPath = join(__dirname, '..', 'data', 'tifootball.db')

// Helper function to run a query and get all results
function queryAll(db, sql, params = []) {
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
function queryOne(db, sql, params = []) {
  const results = queryAll(db, sql, params)
  return results.length > 0 ? results[0] : null
}

async function populateSchedule() {
  console.log('Populating random schedule games...\n')

  const SQL = await initSqlJs()

  if (!existsSync(dbPath)) {
    console.error('Database not found. Run "npm run seed" first.')
    process.exit(1)
  }

  const fileBuffer = readFileSync(dbPath)
  const db = new SQL.Database(fileBuffer)

  // Create schedule table if it doesn't exist
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
  console.log('Schedule table ready\n')

  // Get all team IDs
  const teams = queryAll(db, 'SELECT id FROM teams')
  const teamIds = teams.map(t => t.id)

  const days = ['Thursday', 'Friday', 'Saturday', 'Sunday', 'Monday']
  const startDate = new Date('2025-09-04')

  // Clear existing schedule
  db.run('DELETE FROM schedule')
  console.log('Cleared existing schedule\n')

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

    db.run(
      'INSERT INTO schedule (game_number, week, game_date, game_day, away_team_id, home_team_id) VALUES (?, ?, ?, ?, ?, ?)',
      [i, week, gameDate, gameDay, awayTeamId, homeTeamId]
    )

    // Get team names for display
    const awayTeam = queryOne(db, 'SELECT city, name FROM teams WHERE id = ?', [awayTeamId])
    const homeTeam = queryOne(db, 'SELECT city, name FROM teams WHERE id = ?', [homeTeamId])

    console.log(`Game ${i}: Week ${week}, ${gameDate} (${gameDay})`)
    console.log(`  ${awayTeam.city} ${awayTeam.name} @ ${homeTeam.city} ${homeTeam.name}`)
  }

  // Save database to file
  const data = db.export()
  const buffer = Buffer.from(data)
  writeFileSync(dbPath, buffer)

  console.log('\n10 random games created!')

  db.close()
}

populateSchedule().catch(err => {
  console.error('Failed to populate schedule:', err)
  process.exit(1)
})
