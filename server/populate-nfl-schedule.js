import initSqlJs from 'sql.js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const dbPath = join(__dirname, '..', 'data', 'tifootball.db')
const mhtmlPath = join(__dirname, 'data', 'raw', 'nfl_2025_schedule.mhtml')

// Team name to ID mapping
const teamNameToId = {
  'Cardinals': 1,
  'Falcons': 2,
  'Ravens': 3,
  'Bills': 4,
  'Panthers': 5,
  'Bears': 6,
  'Bengals': 7,
  'Browns': 8,
  'Cowboys': 9,
  'Broncos': 10,
  'Lions': 11,
  'Packers': 12,
  'Texans': 13,
  'Colts': 14,
  'Jaguars': 15,
  'Chiefs': 16,
  'Raiders': 17,
  'Chargers': 18,
  'Rams': 19,
  'Dolphins': 20,
  'Vikings': 21,
  'Patriots': 22,
  'Saints': 23,
  'Giants': 24,
  'Jets': 25,
  'Eagles': 26,
  'Steelers': 27,
  '49ers': 28,
  'Seahawks': 29,
  'Buccaneers': 30,
  'Titans': 31,
  'Commanders': 32
}

// Helper function to run a query
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

// Decode quoted-printable encoding
function decodeQuotedPrintable(str) {
  return str
    .replace(/=3D/g, '=')
    .replace(/=\r?\n/g, '') // Remove soft line breaks
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

// Parse date string like "September 4, 2025" to "2025-09-04"
function parseDate(dayStr, dateStr) {
  const months = {
    'January': '01', 'February': '02', 'March': '03', 'April': '04',
    'May': '05', 'June': '06', 'July': '07', 'August': '08',
    'September': '09', 'October': '10', 'November': '11', 'December': '12'
  }

  // Parse "September 4, 2025" format
  const match = dateStr.match(/(\w+)\s+(\d+),?\s+(\d{4})/)
  if (match) {
    const month = months[match[1]]
    const day = match[2].padStart(2, '0')
    const year = match[3]
    return `${year}-${month}-${day}`
  }
  return null
}

function parseSchedule(content) {
  // Join all content and remove newlines for easier parsing
  let decoded = decodeQuotedPrintable(content).replace(/\r?\n/g, ' ')

  // Strip Chrome source-view HTML formatting (spans with html-tag, html-attribute-* classes)
  decoded = decoded.replace(/<span class="html-[^"]*">/g, '')
  decoded = decoded.replace(/<\/span>/g, '')
  // Clean up remaining HTML while preserving structure we need
  decoded = decoded.replace(/<td[^>]*>/g, ' ')
  decoded = decoded.replace(/<\/td>/g, ' ')
  decoded = decoded.replace(/<tr[^>]*>/g, ' ')
  decoded = decoded.replace(/<\/tr>/g, ' ')
  decoded = decoded.replace(/<table[^>]*>/g, ' ')
  decoded = decoded.replace(/<\/table>/g, ' ')
  // Clean up multiple spaces
  decoded = decoded.replace(/\s+/g, ' ')

  const games = []

  // Find Regular Season section - starts with "Regular Season Schedule" and ends at "Preseason"
  const regularSeasonStart = decoded.indexOf('Regular Season Schedule')
  const preseasonStart = decoded.indexOf('Preseason Schedule')

  if (regularSeasonStart === -1) {
    console.error('Could not find Regular Season Schedule marker')
    return games
  }

  // Extract just the regular season portion
  const regularSeasonEnd = preseasonStart > regularSeasonStart ? preseasonStart : decoded.length
  const regularSeason = decoded.substring(regularSeasonStart, regularSeasonEnd)

  console.log('Found Regular Season section, parsing weeks...')

  // Find all week sections
  const weekPattern = /Week (\d+):/g
  let weekMatch
  const weekPositions = []

  while ((weekMatch = weekPattern.exec(regularSeason)) !== null) {
    const weekNum = parseInt(weekMatch[1])
    if (weekNum >= 1 && weekNum <= 18) {
      weekPositions.push({ week: weekNum, pos: weekMatch.index })
    }
  }

  console.log(`Found ${weekPositions.length} weeks`)

  let gameNumber = 0

  // Process each week
  for (let i = 0; i < weekPositions.length; i++) {
    const week = weekPositions[i].week
    const startPos = weekPositions[i].pos
    const endPos = i < weekPositions.length - 1 ? weekPositions[i + 1].pos : regularSeason.length
    const weekContent = regularSeason.substring(startPos, endPos)

    // Find all day headers in this week
    const dayPattern = /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+(\w+)\s+(\d+),?\s+(\d{4})/g
    let dayMatch
    const dayPositions = []

    while ((dayMatch = dayPattern.exec(weekContent)) !== null) {
      const dayName = dayMatch[1]
      const month = dayMatch[2]
      const day = dayMatch[3]
      const year = dayMatch[4]
      const dateStr = `${month} ${day}, ${year}`
      dayPositions.push({
        day: dayName,
        dateStr: dateStr,
        date: parseDate(dayName, dateStr),
        pos: dayMatch.index
      })
    }

    // Process each day's games
    for (let j = 0; j < dayPositions.length; j++) {
      const dayInfo = dayPositions[j]
      const dayStart = dayInfo.pos
      const dayEnd = j < dayPositions.length - 1 ? dayPositions[j + 1].pos : weekContent.length
      const dayContent = weekContent.substring(dayStart, dayEnd)

      // Find all games: look for pattern with team links and @ symbol
      // Game link pattern: /nfl/2025/week\d+/xxx-xxx (this appears for each game)
      // Use negative lookbehind to avoid matching the full URL (which has .com before /nfl)
      // Match only paths that start with > or " before /nfl
      const gameLinks = [...dayContent.matchAll(/(?<![a-z])\/nfl\/2025\/week\d+\/([a-z]+)-([a-z]+)/g)]

      for (const gameLink of gameLinks) {
        // The game link contains abbr codes like "dal-phi" for Dallas @ Philadelphia
        // But we need the team names which appear before the game link

        // Find the position of this game link in the day content
        const linkPos = gameLink.index

        // Look backwards from the link to find the two team names
        const beforeLink = dayContent.substring(0, linkPos)

        // Find team names - they appear as ">TeamName</a>" after team links
        // Pattern: ">TeamName</a> where TeamName can include numbers like "49ers"
        const teamNameMatches = [...beforeLink.matchAll(/">([A-Za-z0-9]+)<\/a>/g)]

        // Get the last two team names before this game link - they should be away @ home
        if (teamNameMatches.length >= 2) {
          const awayName = teamNameMatches[teamNameMatches.length - 2][1].trim()
          const homeName = teamNameMatches[teamNameMatches.length - 1][1].trim()

          const awayId = teamNameToId[awayName]
          const homeId = teamNameToId[homeName]

          if (awayId && homeId) {
            gameNumber++
            games.push({
              game_number: gameNumber,
              week: week,
              game_date: dayInfo.date,
              game_day: dayInfo.day,
              away_team_id: awayId,
              home_team_id: homeId,
              away_name: awayName,
              home_name: homeName
            })
          }
        }
      }
    }
  }

  return games
}

async function populateSchedule() {
  console.log('Parsing NFL 2025 schedule from MHTML file...\n')

  if (!existsSync(mhtmlPath)) {
    console.error('MHTML file not found:', mhtmlPath)
    process.exit(1)
  }

  const content = readFileSync(mhtmlPath, 'utf-8')
  const games = parseSchedule(content)

  console.log(`Found ${games.length} regular season games\n`)

  if (games.length === 0) {
    console.error('No games found! Check parser.')
    process.exit(1)
  }

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

  // Clear existing schedule
  db.run('DELETE FROM schedule')
  console.log('Cleared existing schedule\n')

  // Insert games
  let weekGames = {}
  for (const game of games) {
    db.run(
      'INSERT INTO schedule (game_number, week, game_date, game_day, away_team_id, home_team_id) VALUES (?, ?, ?, ?, ?, ?)',
      [game.game_number, game.week, game.game_date, game.game_day, game.away_team_id, game.home_team_id]
    )

    // Track games per week
    if (!weekGames[game.week]) {
      weekGames[game.week] = []
    }
    weekGames[game.week].push(game)
  }

  // Print summary by week
  console.log('Games by week:')
  for (let week = 1; week <= 18; week++) {
    const wg = weekGames[week] || []
    console.log(`  Week ${week}: ${wg.length} games`)
  }

  // Save database
  const data = db.export()
  const buffer = Buffer.from(data)
  writeFileSync(dbPath, buffer)

  console.log(`\n${games.length} NFL 2025 games loaded!`)

  // Show first few games
  console.log('\nFirst 10 games:')
  for (let i = 0; i < Math.min(10, games.length); i++) {
    const g = games[i]
    console.log(`  ${g.game_number}. Week ${g.week}, ${g.game_date} (${g.game_day}): ${g.away_name} @ ${g.home_name}`)
  }

  db.close()
}

populateSchedule().catch(err => {
  console.error('Failed to populate schedule:', err)
  process.exit(1)
})
