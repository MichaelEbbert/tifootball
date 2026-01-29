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

/**
 * Generate random percentages that sum to 100
 * @param {number} count - Number of values to generate
 * @param {number} minEach - Minimum value for each (default 5)
 * @returns {number[]} Array of integers summing to 100
 */
function randomPercentages(count, minEach = 5) {
  // Start with minimum for each
  const values = Array(count).fill(minEach)
  let remaining = 100 - (minEach * count)

  // Distribute remaining randomly
  while (remaining > 0) {
    const idx = Math.floor(Math.random() * count)
    const add = Math.min(remaining, Math.floor(Math.random() * 15) + 1)
    values[idx] += add
    remaining -= add
  }

  return values
}

/**
 * Generate play tendencies with some variance based on situation
 */
function generatePlayTendencies(situation) {
  // Base tendencies vary by down/distance
  let runBias, longBias
  switch (situation) {
    case '1st_10':
      runBias = 0.1 + Math.random() * 0.2  // 10-30% extra run tendency
      longBias = 0
      break
    case '2nd_short':
    case '3rd_short':
    case '4th_short':
      runBias = 0.15 + Math.random() * 0.2  // Run-heavy on short
      longBias = -0.1
      break
    case '2nd_medium':
    case '3rd_medium':
    case '4th_medium':
      runBias = -0.05 + Math.random() * 0.1
      longBias = 0
      break
    case '2nd_long':
    case '3rd_long':
    case '4th_long':
      runBias = -0.15 + Math.random() * 0.1  // Pass-heavy on long
      longBias = 0.1 + Math.random() * 0.1
      break
    default:
      runBias = 0
      longBias = 0
  }

  // Generate base percentages
  let [run, short, medium, long] = randomPercentages(4, 5)

  // Apply biases
  const runAdjust = Math.round(runBias * 30)
  const longAdjust = Math.round(longBias * 20)

  run = Math.max(5, Math.min(70, run + runAdjust))
  long = Math.max(5, Math.min(40, long + longAdjust))

  // Rebalance to 100
  const total = run + short + medium + long
  const diff = 100 - total
  if (diff !== 0) {
    // Adjust medium (usually the most flexible)
    medium = Math.max(5, medium + diff)
  }

  // Final normalization
  const finalTotal = run + short + medium + long
  if (finalTotal !== 100) {
    short = 100 - run - medium - long
  }

  return { run_pct: run, short_pct: short, medium_pct: medium, long_pct: long }
}

/**
 * Generate red zone tendencies (no long pass)
 */
function generateRedZoneTendencies(situation) {
  let runBias
  switch (situation) {
    case '1st_10':
      runBias = 0.1 + Math.random() * 0.15
      break
    case '2nd_short':
    case '3rd_short':
    case '4th_short':
      runBias = 0.2 + Math.random() * 0.2  // Very run-heavy in short yardage
      break
    case '2nd_medium':
    case '3rd_medium':
    case '4th_medium':
      runBias = Math.random() * 0.15
      break
    case '2nd_long':
    case '3rd_long':
    case '4th_long':
      runBias = -0.1 + Math.random() * 0.1
      break
    default:
      runBias = 0
  }

  let [run, short, medium] = randomPercentages(3, 10)

  const runAdjust = Math.round(runBias * 30)
  run = Math.max(10, Math.min(70, run + runAdjust))

  // Rebalance
  const total = run + short + medium
  const diff = 100 - total
  short = Math.max(10, short + Math.floor(diff / 2))
  medium = 100 - run - short

  return { run_pct: run, short_pct: short, medium_pct: medium }
}

/**
 * Generate 4th down go/punt/fg tendencies
 */
function generateFourthDownTendencies(quarter, scoreDiff) {
  // Base go-for-it tendency
  let goBase = 15

  // Adjust by quarter (more aggressive late)
  if (quarter === 3) goBase += 5
  if (quarter === 4) goBase += 20

  // Adjust by score
  if (scoreDiff === 'down_1_7') goBase += 10
  if (scoreDiff === 'down_7_plus') goBase += 25
  if (scoreDiff === 'up_7_plus') goBase -= 10

  // Add randomness to create unique coach personalities
  goBase += Math.floor(Math.random() * 20) - 10

  // Clamp
  const go_pct = Math.max(5, Math.min(90, goBase))

  // Split remainder between punt and FG
  const remaining = 100 - go_pct
  const fg_pct = Math.floor(remaining * (0.3 + Math.random() * 0.4))  // 30-70% of remainder
  const punt_pct = remaining - fg_pct

  return { go_pct, punt_pct, fg_pct }
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

  // Coach tendency tables
  db.run(`
    CREATE TABLE IF NOT EXISTS coach_play_tendencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      coach_id INTEGER NOT NULL,
      situation TEXT NOT NULL,
      run_pct INTEGER NOT NULL,
      short_pct INTEGER NOT NULL,
      medium_pct INTEGER NOT NULL,
      long_pct INTEGER NOT NULL,
      FOREIGN KEY (coach_id) REFERENCES coaches(id),
      UNIQUE(coach_id, situation)
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS coach_fourth_down_tendencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      coach_id INTEGER NOT NULL,
      quarter INTEGER NOT NULL,
      score_diff TEXT NOT NULL,
      go_pct INTEGER NOT NULL,
      punt_pct INTEGER NOT NULL,
      fg_pct INTEGER NOT NULL,
      FOREIGN KEY (coach_id) REFERENCES coaches(id),
      UNIQUE(coach_id, quarter, score_diff)
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS coach_red_zone_tendencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      coach_id INTEGER NOT NULL,
      situation TEXT NOT NULL,
      run_pct INTEGER NOT NULL,
      short_pct INTEGER NOT NULL,
      medium_pct INTEGER NOT NULL,
      FOREIGN KEY (coach_id) REFERENCES coaches(id),
      UNIQUE(coach_id, situation)
    )
  `)

  console.log('Tables created\n')

  // Insert teams
  console.log('Inserting NFL teams...')

  let teamCount = 0
  let coachCount = 0

  const situations = [
    '1st_10', '2nd_short', '2nd_medium', '2nd_long',
    '3rd_short', '3rd_medium', '3rd_long',
    '4th_short', '4th_medium', '4th_long'
  ]
  const quarters = [1, 2, 3, 4]
  const scoreDiffs = ['up_0_7', 'down_1_7', 'up_7_plus', 'down_7_plus']

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
    const coachId = team.id  // Coach ID matches team ID since we insert in order
    coachCount++

    // Generate play tendencies for this coach
    situations.forEach(situation => {
      const t = generatePlayTendencies(situation)
      db.run(
        'INSERT INTO coach_play_tendencies (coach_id, situation, run_pct, short_pct, medium_pct, long_pct) VALUES (?, ?, ?, ?, ?, ?)',
        [coachId, situation, t.run_pct, t.short_pct, t.medium_pct, t.long_pct]
      )
    })

    // Generate red zone tendencies (independent of normal tendencies)
    situations.forEach(situation => {
      const t = generateRedZoneTendencies(situation)
      db.run(
        'INSERT INTO coach_red_zone_tendencies (coach_id, situation, run_pct, short_pct, medium_pct) VALUES (?, ?, ?, ?, ?)',
        [coachId, situation, t.run_pct, t.short_pct, t.medium_pct]
      )
    })

    // Generate 4th down decision tendencies
    quarters.forEach(quarter => {
      scoreDiffs.forEach(scoreDiff => {
        const t = generateFourthDownTendencies(quarter, scoreDiff)
        db.run(
          'INSERT INTO coach_fourth_down_tendencies (coach_id, quarter, score_diff, go_pct, punt_pct, fg_pct) VALUES (?, ?, ?, ?, ?, ?)',
          [coachId, quarter, scoreDiff, t.go_pct, t.punt_pct, t.fg_pct]
        )
      })
    })

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
