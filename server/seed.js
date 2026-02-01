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
 * Situational ranges for play tendency generation
 * Each coach generates random values within these ranges, then normalized to 100%
 */
const TENDENCY_RANGES = {
  '1st_10':     { run: [35, 55], short: [20, 35], medium: [12, 25], long: [4, 15] },   // Base
  '2nd_short':  { run: [40, 60], short: [18, 32], medium: [10, 22], long: [3, 12] },   // Lean run
  '2nd_medium': { run: [30, 50], short: [22, 37], medium: [14, 27], long: [5, 16] },   // Slight pass
  '2nd_long':   { run: [25, 45], short: [22, 37], medium: [15, 28], long: [6, 18] },   // Pass heavy
  '3rd_short':  { run: [45, 65], short: [15, 30], medium: [8, 20], long: [2, 10] },    // Run heavy
  '3rd_medium': { run: [30, 50], short: [22, 37], medium: [14, 27], long: [5, 16] },   // Slight pass
  '3rd_long':   { run: [25, 45], short: [22, 37], medium: [15, 28], long: [6, 18] },   // Pass heavy
  '4th_short':  { run: [45, 65], short: [15, 30], medium: [8, 20], long: [2, 10] },    // Run heavy (like 3rd short)
  '4th_medium': { run: [30, 50], short: [22, 37], medium: [14, 27], long: [5, 16] },   // Slight pass
  '4th_long':   { run: [25, 45], short: [22, 37], medium: [15, 28], long: [6, 18] }    // Pass heavy
}

/**
 * Generate play tendencies for a situation
 * Each value is randomly generated within situational ranges, then normalized to 100%
 */
function generatePlayTendencies(situation) {
  const ranges = TENDENCY_RANGES[situation] || TENDENCY_RANGES['1st_10']

  // Generate random values within each range
  const run = ranges.run[0] + Math.random() * (ranges.run[1] - ranges.run[0])
  const short = ranges.short[0] + Math.random() * (ranges.short[1] - ranges.short[0])
  const medium = ranges.medium[0] + Math.random() * (ranges.medium[1] - ranges.medium[0])
  const long = ranges.long[0] + Math.random() * (ranges.long[1] - ranges.long[0])

  // Normalize to 100%
  const total = run + short + medium + long
  return {
    run_pct: Math.round((run / total) * 100),
    short_pct: Math.round((short / total) * 100),
    medium_pct: Math.round((medium / total) * 100),
    long_pct: Math.round((long / total) * 100)
  }
}

/**
 * Red zone ranges (no long pass - compressed field)
 */
const RED_ZONE_RANGES = {
  '1st_10':     { run: [40, 60], short: [25, 40], medium: [15, 30] },   // Base, lean run
  '2nd_short':  { run: [50, 70], short: [18, 32], medium: [10, 22] },   // Run heavy
  '2nd_medium': { run: [35, 55], short: [28, 42], medium: [18, 32] },   // Balanced
  '2nd_long':   { run: [30, 50], short: [30, 45], medium: [20, 35] },   // Pass lean
  '3rd_short':  { run: [55, 75], short: [15, 28], medium: [8, 18] },    // Very run heavy
  '3rd_medium': { run: [35, 55], short: [28, 42], medium: [18, 32] },   // Balanced
  '3rd_long':   { run: [30, 50], short: [30, 45], medium: [20, 35] },   // Pass lean
  '4th_short':  { run: [55, 75], short: [15, 28], medium: [8, 18] },    // Very run heavy
  '4th_medium': { run: [35, 55], short: [28, 42], medium: [18, 32] },   // Balanced
  '4th_long':   { run: [30, 50], short: [30, 45], medium: [20, 35] }    // Pass lean
}

/**
 * Generate red zone tendencies (no long pass - compressed field)
 */
function generateRedZoneTendencies(situation) {
  const ranges = RED_ZONE_RANGES[situation] || RED_ZONE_RANGES['1st_10']

  // Generate random values within each range
  const run = ranges.run[0] + Math.random() * (ranges.run[1] - ranges.run[0])
  const short = ranges.short[0] + Math.random() * (ranges.short[1] - ranges.short[0])
  const medium = ranges.medium[0] + Math.random() * (ranges.medium[1] - ranges.medium[0])

  // Normalize to 100%
  const total = run + short + medium
  return {
    run_pct: Math.round((run / total) * 100),
    short_pct: Math.round((short / total) * 100),
    medium_pct: Math.round((medium / total) * 100)
  }
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
