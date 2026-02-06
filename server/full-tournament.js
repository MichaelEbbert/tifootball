/**
 * Full Tournament - Each team plays 100 home games against each opponent
 * 32 teams × 31 opponents × 100 games = 99,200 total games
 */

import { fileURLToPath, pathToFileURL } from 'url'
import { dirname, join } from 'path'
import { readFileSync, existsSync } from 'fs'
import initSqlJs from 'sql.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Import game logic
const gameEnginePath = pathToFileURL(join(__dirname, '..', 'client', 'src', 'utils', 'gameEngine.js')).href
const { initializeGame, executePlay, isGameOver } = await import(gameEnginePath)

// Load teams from database
async function loadTeamsFromDatabase() {
  const dbPath = join(__dirname, '..', 'data', 'tifootball.db')
  if (!existsSync(dbPath)) {
    console.log('Database not found!')
    process.exit(1)
  }

  const SQL = await initSqlJs()
  const db = new SQL.Database(readFileSync(dbPath))

  const teamsResult = db.exec(`
    SELECT t.id, t.name, t.city, t.abbreviation, t.division, t.conference, c.red_zone_aggression
    FROM teams t
    LEFT JOIN coaches c ON t.id = c.team_id
  `)
  if (!teamsResult[0]) return null

  const teams = teamsResult[0].values.map(row => ({
    id: row[0],
    name: row[1],
    city: row[2],
    abbreviation: row[3],
    division: row[4],
    conference: row[5],
    redZoneAggression: row[6] || 0,
    tendencies: {}
  }))

  // Load tendencies
  const tendenciesResult = db.exec(`
    SELECT c.team_id, t.situation, t.run_pct, t.short_pct, t.medium_pct, t.long_pct
    FROM coach_play_tendencies t
    JOIN coaches c ON t.coach_id = c.id
  `)

  if (tendenciesResult[0]) {
    tendenciesResult[0].values.forEach(row => {
      const teamId = row[0]
      const situation = row[1]
      const team = teams.find(t => t.id === teamId)
      if (team) {
        team.tendencies[situation] = {
          run: row[2],
          short: row[3],
          medium: row[4],
          long: row[5]
        }
      }
    })
  }

  db.close()
  return teams
}

const GAMES_PER_MATCHUP = 100

console.log(`\n🏈 Full Tournament`)
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
console.log(`Each team plays ${GAMES_PER_MATCHUP} home games vs each opponent`)
console.log(`Total games: 32 × 31 × ${GAMES_PER_MATCHUP} = ${32 * 31 * GAMES_PER_MATCHUP}\n`)

const teams = await loadTeamsFromDatabase()
if (!teams || teams.length < 32) {
  console.log('Need 32 teams in database')
  process.exit(1)
}

// Initialize records
const records = {}
teams.forEach(team => {
  records[team.id] = {
    team,
    wins: 0,
    losses: 0,
    ties: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    homeWins: 0,
    homeLosses: 0,
    awayWins: 0,
    awayLosses: 0
  }
})

const startTime = Date.now()
let gamesPlayed = 0
const totalGames = 32 * 31 * GAMES_PER_MATCHUP

// Play all matchups
for (let i = 0; i < teams.length; i++) {
  for (let j = 0; j < teams.length; j++) {
    if (i === j) continue

    const homeTeam = teams[i]
    const awayTeam = teams[j]

    // Play GAMES_PER_MATCHUP games with this home/away setup
    for (let g = 0; g < GAMES_PER_MATCHUP; g++) {
      const gameState = initializeGame(homeTeam, awayTeam, false, false)

      while (!isGameOver(gameState)) {
        executePlay(gameState)
      }

      // Update records
      const homeRecord = records[homeTeam.id]
      const awayRecord = records[awayTeam.id]

      homeRecord.pointsFor += gameState.score.home
      homeRecord.pointsAgainst += gameState.score.away
      awayRecord.pointsFor += gameState.score.away
      awayRecord.pointsAgainst += gameState.score.home

      if (gameState.score.home > gameState.score.away) {
        homeRecord.wins++
        homeRecord.homeWins++
        awayRecord.losses++
        awayRecord.awayLosses++
      } else if (gameState.score.away > gameState.score.home) {
        awayRecord.wins++
        awayRecord.awayWins++
        homeRecord.losses++
        homeRecord.homeLosses++
      } else {
        homeRecord.ties++
        awayRecord.ties++
      }

      gamesPlayed++
    }

    // Progress every 3100 games (one team's full home schedule)
    if (gamesPlayed % 3100 === 0) {
      const pct = (gamesPlayed / totalGames * 100).toFixed(1)
      const elapsed = (Date.now() - startTime) / 1000
      const rate = gamesPlayed / elapsed
      const eta = (totalGames - gamesPlayed) / rate
      process.stdout.write(`\r  ${gamesPlayed.toLocaleString()} / ${totalGames.toLocaleString()} games (${pct}%) - ETA: ${eta.toFixed(0)}s  `)
    }
  }
}

const endTime = Date.now()
const duration = (endTime - startTime) / 1000

console.log(`\r  Completed ${gamesPlayed.toLocaleString()} games in ${duration.toFixed(1)}s                    \n`)

// Sort by win percentage
const sortedRecords = Object.values(records).sort((a, b) => {
  const aWinPct = a.wins / (a.wins + a.losses + a.ties)
  const bWinPct = b.wins / (b.wins + b.losses + b.ties)
  return bWinPct - aWinPct
})

// Print standings
console.log(`\n📊 Final Standings`)
console.log(`${'═'.repeat(80)}`)
console.log(`  Rank  Team                      W      L    T    Win%    PF/G   PA/G   Diff`)
console.log(`${'─'.repeat(80)}`)

sortedRecords.forEach((record, idx) => {
  const rank = (idx + 1).toString().padStart(2)
  const name = (record.team.city + ' ' + record.team.name).padEnd(22)
  const wins = record.wins.toString().padStart(4)
  const losses = record.losses.toString().padStart(4)
  const ties = record.ties.toString().padStart(3)
  const totalGamesTeam = record.wins + record.losses + record.ties
  const winPct = (record.wins / totalGamesTeam * 100).toFixed(1).padStart(5)
  const ppg = (record.pointsFor / totalGamesTeam).toFixed(1).padStart(6)
  const pag = (record.pointsAgainst / totalGamesTeam).toFixed(1).padStart(6)
  const diff = record.pointsFor - record.pointsAgainst
  const diffStr = (diff >= 0 ? '+' : '') + diff

  console.log(`  ${rank}.  ${name} ${wins}   ${losses}   ${ties}   ${winPct}%  ${ppg}  ${pag}  ${diffStr.padStart(7)}`)
})

// Best and worst
const best = sortedRecords[0]
const worst = sortedRecords[sortedRecords.length - 1]

console.log(`\n${'═'.repeat(80)}`)
console.log(`\n🏆 BEST: ${best.team.city} ${best.team.name}`)
console.log(`   Record: ${best.wins}-${best.losses}-${best.ties} (${(best.wins / (best.wins + best.losses + best.ties) * 100).toFixed(1)}%)`)
console.log(`   Home: ${best.homeWins}-${best.homeLosses}, Away: ${best.awayWins}-${best.awayLosses}`)
console.log(`   PPG: ${(best.pointsFor / (best.wins + best.losses + best.ties)).toFixed(1)}, Opp PPG: ${(best.pointsAgainst / (best.wins + best.losses + best.ties)).toFixed(1)}`)

console.log(`\n💩 WORST: ${worst.team.city} ${worst.team.name}`)
console.log(`   Record: ${worst.wins}-${worst.losses}-${worst.ties} (${(worst.wins / (worst.wins + worst.losses + worst.ties) * 100).toFixed(1)}%)`)
console.log(`   Home: ${worst.homeWins}-${worst.homeLosses}, Away: ${worst.awayWins}-${worst.awayLosses}`)
console.log(`   PPG: ${(worst.pointsFor / (worst.wins + worst.losses + worst.ties)).toFixed(1)}, Opp PPG: ${(worst.pointsAgainst / (worst.wins + worst.losses + worst.ties)).toFixed(1)}`)

// Output team IDs for coach comparison
console.log(`\n📋 Team IDs for coach lookup:`)
console.log(`   Best:  ${best.team.id} (${best.team.abbreviation})`)
console.log(`   Worst: ${worst.team.id} (${worst.team.abbreviation})`)
console.log(``)
