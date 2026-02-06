/**
 * Silent Simulator - Headless game simulation for statistics research
 *
 * Runs games using the same logic as the UI but without delays or rendering.
 * Useful for testing game balance and gathering statistics.
 *
 * Usage:
 *   node silent-simulator.js [--games N]
 *
 * Examples:
 *   node silent-simulator.js              # Run 100 games (default)
 *   node silent-simulator.js --games 1000 # Run 1000 games
 */

import { fileURLToPath, pathToFileURL } from 'url'
import { dirname, join } from 'path'
import { readFileSync, existsSync } from 'fs'
import initSqlJs from 'sql.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Import game logic from client (convert to file:// URL for Windows compatibility)
const gameEnginePath = pathToFileURL(join(__dirname, '..', 'client', 'src', 'utils', 'gameEngine.js')).href
const gameSimPath = pathToFileURL(join(__dirname, '..', 'client', 'src', 'utils', 'gameSimulation.js')).href

const { initializeGame, executePlay, isGameOver } = await import(gameEnginePath)
const { runningPlay } = await import(gameSimPath)

// Load teams and coach tendencies from database
async function loadTeamsFromDatabase() {
  const dbPath = join(__dirname, '..', 'data', 'tifootball.db')

  if (!existsSync(dbPath)) {
    console.log('Database not found, using mock teams')
    return null
  }

  const SQL = await initSqlJs()
  const db = new SQL.Database(readFileSync(dbPath))

  // Load all teams with division/conference and coach's red zone aggression
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
    redZoneAggression: row[6] || 0,  // -10 to +10, default 0
    tendencies: {}
  }))

  // Load tendencies for each team's coach
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

// Pick two random different teams
function pickRandomMatchup(teams) {
  const homeIdx = Math.floor(Math.random() * teams.length)
  let awayIdx = Math.floor(Math.random() * teams.length)
  while (awayIdx === homeIdx) {
    awayIdx = Math.floor(Math.random() * teams.length)
  }
  return { homeTeam: teams[homeIdx], awayTeam: teams[awayIdx] }
}

// Parse command line arguments
const args = process.argv.slice(2)
let numGames = 100
let fourthDownTest = false
let rotationMode = false
let fullMode = true  // Use full game mode (with kickoffs/punts/FGs) - default on
let validateYardlines = false

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--games' && args[i + 1]) {
    numGames = parseInt(args[i + 1], 10)
  }
  if (args[i] === '--4th-down') {
    fourthDownTest = true
  }
  if (args[i] === '--rotation') {
    rotationMode = true
  }
  if (args[i] === '--full') {
    fullMode = true
  }
  if (args[i] === '--round-robin') {
    // Round-robin mode handled after DB load
  }
  if (args[i] === '--validate-yardlines') {
    validateYardlines = true
  }
}

const roundRobinMode = args.includes('--round-robin')

// 4th down conversion probability test
if (fourthDownTest) {
  console.log(`\n🏈 4th Down Conversion Probability Test (Running Plays)`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

  const trials = 100000
  const results = {
    1: { attempts: 0, conversions: 0 },
    2: { attempts: 0, conversions: 0 },
    3: { attempts: 0, conversions: 0 },
    4: { attempts: 0, conversions: 0 },
    5: { attempts: 0, conversions: 0 }
  }

  console.log(`\nRunning ${trials.toLocaleString()} rushing plays per scenario...\n`)

  for (let needed = 1; needed <= 5; needed++) {
    for (let i = 0; i < trials; i++) {
      // 4th and 1 uses tighter coverage (1-4 vs 1-4)
      const { yards } = runningPlay({ fourthAndOne: needed === 1 })
      results[needed].attempts++
      if (yards >= needed) {
        results[needed].conversions++
      }
    }
  }

  for (let needed = 1; needed <= 5; needed++) {
    const pct = (results[needed].conversions / results[needed].attempts * 100).toFixed(1)
    const note = needed === 1 ? ' (uses 1-4 vs 1-4)' : ''
    console.log(`  4th and ${needed}: ${pct}% conversion rate${note}`)
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
  process.exit(0)
}

// Load teams from database (or use mock if not available)
const dbTeamsPreload = await loadTeamsFromDatabase()

// Yardline validation test
if (validateYardlines) {
  console.log(`\n🏈 Yardline Validation Test`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`Running ${numGames} games, checking every play for invalid yardlines...\n`)

  const useDbTeamsValidate = dbTeamsPreload && dbTeamsPreload.length >= 2
  let totalPlays = 0
  let invalidYardlines = []

  const startTimeValidate = Date.now()

  for (let game = 0; game < numGames; game++) {
    // Pick teams
    let homeTeam, awayTeam
    if (useDbTeamsValidate) {
      const homeIdx = Math.floor(Math.random() * dbTeamsPreload.length)
      let awayIdx = Math.floor(Math.random() * dbTeamsPreload.length)
      while (awayIdx === homeIdx) {
        awayIdx = Math.floor(Math.random() * dbTeamsPreload.length)
      }
      homeTeam = dbTeamsPreload[homeIdx]
      awayTeam = dbTeamsPreload[awayIdx]
    } else {
      homeTeam = { id: 1, city: 'Home', name: 'Team', abbreviation: 'HME' }
      awayTeam = { id: 2, city: 'Away', name: 'Team', abbreviation: 'AWY' }
    }

    const gameState = initializeGame(homeTeam, awayTeam, false, false)

    while (!isGameOver(gameState)) {
      executePlay(gameState)
      totalPlays++

      // Check for invalid yardline
      // Note: yardline >= 100 is valid if awaitingKickoff (TD just scored)
      // yardline <= 0 is valid if... actually it shouldn't happen
      const isInvalidYardline = (gameState.yardline < 1 || gameState.yardline > 99) && !gameState.awaitingKickoff
      if (isInvalidYardline) {
        invalidYardlines.push({
          game: game + 1,
          play: gameState.playNumber,
          yardline: gameState.yardline,
          quarter: gameState.quarter,
          down: gameState.down,
          distance: gameState.distance,
          possession: gameState.possession,
          awaitingKickoff: gameState.awaitingKickoff || false
        })
      }
    }

    // Progress indicator
    if ((game + 1) % 100 === 0 || game === numGames - 1) {
      process.stdout.write(`\r  Simulated ${game + 1} / ${numGames} games (${totalPlays} plays)`)
    }
  }

  const endTimeValidate = Date.now()
  const durationValidate = (endTimeValidate - startTimeValidate) / 1000

  console.log(`\n\n📊 Results`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`  Games simulated:            ${numGames}`)
  console.log(`  Total plays checked:        ${totalPlays}`)
  console.log(`  Invalid yardlines found:    ${invalidYardlines.length}`)

  if (invalidYardlines.length > 0) {
    console.log(`\n❌ INVALID YARDLINES DETECTED:`)
    invalidYardlines.slice(0, 20).forEach(inv => {
      console.log(`  Game ${inv.game}, Play ${inv.play}: Q${inv.quarter} ${inv.down}&${inv.distance} at YARDLINE ${inv.yardline} (${inv.possession} ball)`)
    })
    if (invalidYardlines.length > 20) {
      console.log(`  ... and ${invalidYardlines.length - 20} more`)
    }
  } else {
    console.log(`\n✅ All yardlines valid (1-99)!`)
  }

  console.log(`\n  Completed in ${durationValidate.toFixed(2)} seconds`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
  process.exit(invalidYardlines.length > 0 ? 1 : 0)
}

// Use preloaded teams for other modes
const dbTeams = dbTeamsPreload

// Fallback mock teams if database not available
const mockHomeTeam = {
  id: 1,
  city: 'Home',
  name: 'Team',
  abbreviation: 'HME'
}

const mockAwayTeam = {
  id: 2,
  city: 'Away',
  name: 'Team',
  abbreviation: 'AWY'
}

const useDbTeams = dbTeams && dbTeams.length >= 2

// Round-robin tournament mode
if (roundRobinMode) {
  if (!useDbTeams) {
    console.log('Round-robin mode requires database with teams. Run seed.js first.')
    process.exit(1)
  }

  // Check for --games-per-team flag (default: full round-robin = 31 games each)
  let gamesPerTeam = 31
  const gamesPerTeamIdx = args.indexOf('--games-per-team')
  if (gamesPerTeamIdx !== -1 && args[gamesPerTeamIdx + 1]) {
    gamesPerTeam = parseInt(args[gamesPerTeamIdx + 1], 10)
  }

  const isPartialSeason = gamesPerTeam < 31

  console.log(`\n🏈 ${isPartialSeason ? gamesPerTeam + '-Game Season' : 'Round-Robin Tournament'}`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`${dbTeams.length} teams, ${gamesPerTeam} games each\n`)

  // Initialize team records
  const records = {}
  dbTeams.forEach(team => {
    records[team.id] = {
      team: team,
      wins: 0,
      losses: 0,
      ties: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      gamesPlayed: 0
    }
  })

  const startTime = Date.now()
  let gamesPlayed = 0

  // Play games until all teams have enough games
  // Use greedy random pairing: find teams needing games, pair randomly
  while (true) {
    // Get teams that still need games, sorted by fewest games played
    const teamsNeedingGames = dbTeams
      .filter(t => records[t.id].gamesPlayed < gamesPerTeam)
      .sort((a, b) => records[a.id].gamesPlayed - records[b.id].gamesPlayed)

    if (teamsNeedingGames.length < 2) break

    // Pick the team with fewest games
    const team1 = teamsNeedingGames[0]

    // Find valid opponents (also need games, haven't played each other too much)
    const validOpponents = teamsNeedingGames
      .slice(1)
      .filter(t => records[t.id].gamesPlayed < gamesPerTeam)

    if (validOpponents.length === 0) break

    // Pick random opponent from valid ones
    const team2 = validOpponents[Math.floor(Math.random() * validOpponents.length)]

    // Randomly assign home/away
    const homeTeam = Math.random() < 0.5 ? team1 : team2
    const awayTeam = homeTeam === team1 ? team2 : team1

    const gameState = initializeGame(homeTeam, awayTeam, false, false)

    while (!isGameOver(gameState)) {
      executePlay(gameState)
    }

    // Update records
    const homeRecord = records[homeTeam.id]
    const awayRecord = records[awayTeam.id]

    homeRecord.gamesPlayed++
    awayRecord.gamesPlayed++
    homeRecord.pointsFor += gameState.score.home
    homeRecord.pointsAgainst += gameState.score.away
    awayRecord.pointsFor += gameState.score.away
    awayRecord.pointsAgainst += gameState.score.home

    if (gameState.score.home > gameState.score.away) {
      homeRecord.wins++
      awayRecord.losses++
    } else if (gameState.score.away > gameState.score.home) {
      awayRecord.wins++
      homeRecord.losses++
    } else {
      homeRecord.ties++
      awayRecord.ties++
    }

    gamesPlayed++
    if (gamesPlayed % 50 === 0) {
      process.stdout.write(`\r  Played ${gamesPlayed} games...`)
    }
  }

  const endTime = Date.now()
  const duration = (endTime - startTime) / 1000

  console.log(`\r  Played ${gamesPlayed} games                    `)

  // Group teams by conference and division
  const conferences = { AFC: {}, NFC: {} }
  Object.values(records).forEach(record => {
    const conf = record.team.conference
    const div = record.team.division
    if (!conferences[conf]) conferences[conf] = {}
    if (!conferences[conf][div]) conferences[conf][div] = []
    conferences[conf][div].push(record)
  })

  // Sort each division by wins, ties, then point differential
  const sortTeams = (a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins
    if (b.ties !== a.ties) return b.ties - a.ties
    return (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst)
  }

  // Print division standings
  const divisionOrder = ['East', 'North', 'South', 'West']

  for (const conf of ['AFC', 'NFC']) {
    console.log(`\n${'═'.repeat(70)}`)
    console.log(`  ${conf}`)
    console.log(`${'═'.repeat(70)}`)

    for (const div of divisionOrder) {
      const teams = conferences[conf][div]
      if (!teams) continue

      teams.sort(sortTeams)

      console.log(`\n  ${conf} ${div}`)
      console.log(`  ${'─'.repeat(66)}`)
      console.log(`     Team                    W    L    T    PPG    OPP   Diff`)
      console.log(`  ${'─'.repeat(66)}`)

      teams.forEach((record, idx) => {
        const rank = idx + 1
        const name = (record.team.city + ' ' + record.team.name).padEnd(23)
        const wins = String(record.wins).padStart(2)
        const losses = String(record.losses).padStart(2)
        const ties = String(record.ties).padStart(2)
        const ppg = (record.pointsFor / record.gamesPlayed).toFixed(1).padStart(6)
        const opp = (record.pointsAgainst / record.gamesPlayed).toFixed(1).padStart(6)
        const diff = record.pointsFor - record.pointsAgainst
        const diffStr = (diff >= 0 ? '+' : '') + diff

        console.log(`  ${rank}.  ${name} ${wins}   ${losses}   ${ties}  ${ppg}  ${opp}  ${diffStr.padStart(5)}`)
      })
    }
  }

  // League summary
  const allRecords = Object.values(records)
  const totalPF = allRecords.reduce((sum, r) => sum + r.pointsFor, 0)
  const totalGames = allRecords.reduce((sum, r) => sum + r.gamesPlayed, 0) / 2
  const avgPPG = totalPF / totalGames / 2

  console.log(`\n${'═'.repeat(70)}`)
  console.log(`  League Summary`)
  console.log(`${'═'.repeat(70)}`)
  console.log(`  Total games: ${gamesPlayed}`)
  console.log(`  Avg points/team/game: ${avgPPG.toFixed(1)}`)
  console.log(`  Completed in ${duration.toFixed(2)} seconds`)
  console.log(``)

  process.exit(0)
}

// Statistics collectors
const stats = {
  totalGames: 0,
  totalPoints: 0,
  totalPlays: 0,
  totalRushingYards: 0,
  totalRushingPlays: 0,
  totalPassAttempts: 0,
  totalPassCompletions: 0,
  totalPassYards: 0,
  totalInterceptions: 0,
  totalSacks: 0,
  totalKickReturns: 0,
  totalKickReturnYards: 0,
  totalPuntReturnYards: 0,
  totalIntReturnYards: 0,
  totalTwoPtAttempts: 0,
  totalTwoPtMade: 0,
  totalFirstDowns: 0,
  totalTouchdowns: 0,
  totalRushingTDs: 0,
  totalPassingTDs: 0,
  totalKickReturnTDs: 0,
  totalPuntReturnTDs: 0,
  totalIntReturnTDs: 0,
  totalFumbles: 0,
  totalSafeties: 0,
  totalFgAttempts: 0,
  totalFgMade: 0,
  total3rdDownAttempts: 0,
  total3rdDownConversions: 0,
  homeWins: 0,
  awayWins: 0,
  ties: 0,
  highScore: 0,
  lowScore: Infinity,
  shutouts: 0,
  pointsDistribution: {}
}

console.log(`\n🏈 Silent Simulator`)
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
const modeFlags = [rotationMode && 'rotation', fullMode && 'full', useDbTeams && '32 teams'].filter(Boolean).join(', ')
console.log(`Running ${numGames} games...${modeFlags ? ` (${modeFlags})` : ''}\n`)

const startTime = Date.now()

// Run simulations
for (let game = 0; game < numGames; game++) {
  const simplifiedMode = !fullMode

  // Pick teams - use DB teams with tendencies or mock teams
  let homeTeam, awayTeam
  if (useDbTeams) {
    const matchup = pickRandomMatchup(dbTeams)
    homeTeam = matchup.homeTeam
    awayTeam = matchup.awayTeam
  } else {
    homeTeam = mockHomeTeam
    awayTeam = mockAwayTeam
  }

  const gameState = initializeGame(homeTeam, awayTeam, simplifiedMode, rotationMode)

  // Run until game is over
  while (!isGameOver(gameState)) {
    executePlay(gameState)
  }

  // Collect game stats
  stats.totalGames++

  const totalGamePoints = gameState.score.home + gameState.score.away
  stats.totalPoints += totalGamePoints
  stats.totalPlays += gameState.playNumber

  stats.totalRushingYards += gameState.homeStats.rushingYards + gameState.awayStats.rushingYards
  stats.totalRushingPlays += gameState.homeStats.rushingAttempts + gameState.awayStats.rushingAttempts
  stats.totalPassAttempts += gameState.homeStats.passAttempts + gameState.awayStats.passAttempts
  stats.totalPassCompletions += gameState.homeStats.passCompletions + gameState.awayStats.passCompletions
  stats.totalPassYards += gameState.homeStats.passYards + gameState.awayStats.passYards
  stats.totalInterceptions += gameState.homeStats.passInterceptions + gameState.awayStats.passInterceptions
  stats.totalSacks += gameState.homeStats.sacks + gameState.awayStats.sacks
  stats.totalKickReturns += gameState.homeStats.kickReturnAttempts + gameState.awayStats.kickReturnAttempts
  stats.totalKickReturnYards += gameState.homeStats.kickReturnYards + gameState.awayStats.kickReturnYards
  stats.totalTwoPtAttempts += gameState.homeStats.twoPtAttempted + gameState.awayStats.twoPtAttempted
  stats.totalTwoPtMade += gameState.homeStats.twoPtMade + gameState.awayStats.twoPtMade
  stats.totalFirstDowns += gameState.homeStats.firstDowns + gameState.awayStats.firstDowns
  const homeFumbles = gameState.homeStats.rushingFumblesLost + gameState.homeStats.recFumblesLost + gameState.homeStats.sackFumblesLost
  const awayFumbles = gameState.awayStats.rushingFumblesLost + gameState.awayStats.recFumblesLost + gameState.awayStats.sackFumblesLost
  stats.totalFumbles += homeFumbles + awayFumbles

  // Count touchdowns and safeties from scoring log
  if (gameState.scoringLog) {
    for (const entry of gameState.scoringLog) {
      if (entry.score_type === 'TD') {
        stats.totalTouchdowns++
        if (entry.play_type === 'run') stats.totalRushingTDs++
        else if (entry.play_type === 'pass') stats.totalPassingTDs++
        else if (entry.play_type === 'kick_return') stats.totalKickReturnTDs++
        else if (entry.play_type === 'punt_return') stats.totalPuntReturnTDs++
        else if (entry.play_type === 'int_return') stats.totalIntReturnTDs++
      }
      if (entry.score_type === 'SAFETY') stats.totalSafeties++
    }
  }

  // Track return yardage
  stats.totalPuntReturnYards += gameState.homeStats.puntReturnYards + gameState.awayStats.puntReturnYards
  stats.totalIntReturnYards += gameState.homeStats.interceptionReturnYards + gameState.awayStats.interceptionReturnYards

  // Track field goals
  stats.totalFgAttempts += (gameState.homeStats.fgAttempted || 0) + (gameState.awayStats.fgAttempted || 0)
  stats.totalFgMade += (gameState.homeStats.fgMade || 0) + (gameState.awayStats.fgMade || 0)

  // Track 3rd down conversions
  stats.total3rdDownAttempts += (gameState.homeStats.thirdDownAttempts || 0) + (gameState.awayStats.thirdDownAttempts || 0)
  stats.total3rdDownConversions += (gameState.homeStats.thirdDownConversions || 0) + (gameState.awayStats.thirdDownConversions || 0)

  // Win/loss tracking
  if (gameState.score.home > gameState.score.away) {
    stats.homeWins++
  } else if (gameState.score.away > gameState.score.home) {
    stats.awayWins++
  } else {
    stats.ties++
  }

  // High/low scores
  stats.highScore = Math.max(stats.highScore, gameState.score.home, gameState.score.away)
  stats.lowScore = Math.min(stats.lowScore, gameState.score.home, gameState.score.away)

  // Shutouts
  if (gameState.score.home === 0 || gameState.score.away === 0) {
    stats.shutouts++
  }

  // Points distribution
  const homePoints = gameState.score.home
  const awayPoints = gameState.score.away
  stats.pointsDistribution[homePoints] = (stats.pointsDistribution[homePoints] || 0) + 1
  stats.pointsDistribution[awayPoints] = (stats.pointsDistribution[awayPoints] || 0) + 1

  // Progress indicator
  if ((game + 1) % 100 === 0 || game === numGames - 1) {
    process.stdout.write(`\r  Simulated ${game + 1} / ${numGames} games`)
  }
}

const endTime = Date.now()
const duration = (endTime - startTime) / 1000

// Calculate averages
const avgPointsPerGame = stats.totalPoints / stats.totalGames
const avgPointsPerTeam = avgPointsPerGame / 2
const avgPlaysPerGame = stats.totalPlays / stats.totalGames
const avgYardsPerCarry = stats.totalRushingYards / stats.totalRushingPlays
const avgRushingYardsPerGame = stats.totalRushingYards / stats.totalGames
const avgFirstDownsPerGame = stats.totalFirstDowns / stats.totalGames
const avgTDsPerGame = stats.totalTouchdowns / stats.totalGames
const avgFumblesPerGame = stats.totalFumbles / stats.totalGames

// Output results
console.log(`\n\n📊 Results (${numGames} games)`)
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

console.log(`\n🏆 Scoring:`)
console.log(`  Avg points/game (total):    ${avgPointsPerGame.toFixed(1)}`)
console.log(`  Avg points/team/game:       ${avgPointsPerTeam.toFixed(1)}`)
console.log(`  Avg touchdowns/game:        ${avgTDsPerGame.toFixed(2)} (${stats.totalRushingTDs} rush, ${stats.totalPassingTDs} pass, ${stats.totalKickReturnTDs + stats.totalPuntReturnTDs + stats.totalIntReturnTDs} return)`)
console.log(`  Total safeties:             ${stats.totalSafeties} (${(stats.totalSafeties / stats.totalGames).toFixed(2)}/game)`)
console.log(`  High score (single team):   ${stats.highScore}`)
console.log(`  Low score (single team):    ${stats.lowScore}`)
console.log(`  Shutouts:                   ${stats.shutouts} (${(stats.shutouts / stats.totalGames / 2 * 100).toFixed(1)}% of teams)`)

console.log(`\n🏃 Rushing:`)
console.log(`  Avg yards/carry:            ${avgYardsPerCarry.toFixed(2)}`)
console.log(`  Avg rushing yards/game:     ${avgRushingYardsPerGame.toFixed(1)}`)
console.log(`  Avg rushing plays/game:     ${(stats.totalRushingPlays / stats.totalGames).toFixed(1)}`)

const completionRate = (stats.totalPassCompletions / stats.totalPassAttempts * 100).toFixed(1)
const avgPassYardsPerGame = stats.totalPassYards / stats.totalGames
const avgPassAttemptsPerGame = stats.totalPassAttempts / stats.totalGames
const interceptionRate = (stats.totalInterceptions / stats.totalPassAttempts * 100).toFixed(1)
const sackRate = (stats.totalSacks / stats.totalPassAttempts * 100).toFixed(1)

console.log(`\n🏈 Passing:`)
console.log(`  Completion rate:            ${completionRate}% (${stats.totalPassCompletions}/${stats.totalPassAttempts})`)
console.log(`  Avg pass attempts/game:     ${avgPassAttemptsPerGame.toFixed(1)}`)
console.log(`  Avg passing yards/game:     ${avgPassYardsPerGame.toFixed(1)}`)
console.log(`  Interception rate:          ${interceptionRate}%`)
console.log(`  Sack rate:                  ${sackRate}%`)

if (stats.totalKickReturns > 0 || stats.totalPuntReturnYards > 0 || stats.totalIntReturnYards > 0) {
  console.log(`\n⚡ Returns:`)
  if (stats.totalKickReturns > 0) {
    const avgKickReturnYards = stats.totalKickReturnYards / stats.totalKickReturns
    console.log(`  Kick returns:               ${stats.totalKickReturns} (${avgKickReturnYards.toFixed(1)} avg)`)
    console.log(`  Kick return TDs:            ${stats.totalKickReturnTDs}`)
  }
  console.log(`  Punt return yards:          ${stats.totalPuntReturnYards} (${(stats.totalPuntReturnYards / stats.totalGames).toFixed(1)}/game)`)
  console.log(`  Punt return TDs:            ${stats.totalPuntReturnTDs}`)
  console.log(`  INT return yards:           ${stats.totalIntReturnYards} (${(stats.totalIntReturnYards / stats.totalGames).toFixed(1)}/game)`)
  console.log(`  INT return TDs (pick-6):    ${stats.totalIntReturnTDs}`)
}

if (stats.totalTwoPtAttempts > 0) {
  const twoPtRate = (stats.totalTwoPtMade / stats.totalTwoPtAttempts * 100).toFixed(1)
  console.log(`\n🎯 2-Point Conversions:`)
  console.log(`  Attempts:                   ${stats.totalTwoPtAttempts} (${(stats.totalTwoPtAttempts / stats.totalGames).toFixed(2)}/game)`)
  console.log(`  Success rate:               ${twoPtRate}% (${stats.totalTwoPtMade}/${stats.totalTwoPtAttempts})`)
}

if (stats.totalFgAttempts > 0) {
  const fgRate = (stats.totalFgMade / stats.totalFgAttempts * 100).toFixed(1)
  console.log(`\n🎯 Field Goals:`)
  console.log(`  Attempts:                   ${stats.totalFgAttempts} (${(stats.totalFgAttempts / stats.totalGames).toFixed(2)}/game)`)
  console.log(`  Success rate:               ${fgRate}% (${stats.totalFgMade}/${stats.totalFgAttempts})`)
  console.log(`  Points from FGs:            ${stats.totalFgMade * 3} (${(stats.totalFgMade * 3 / stats.totalGames).toFixed(1)}/game)`)
}

console.log(`\n📈 Game Flow:`)
console.log(`  Avg plays/game:             ${avgPlaysPerGame.toFixed(1)}`)
console.log(`  Avg first downs/game:       ${avgFirstDownsPerGame.toFixed(1)}`)
console.log(`  Avg turnovers/game:         ${avgFumblesPerGame.toFixed(2)}`)
const thirdDownRate = stats.total3rdDownAttempts > 0 ? (stats.total3rdDownConversions / stats.total3rdDownAttempts * 100).toFixed(1) : '0.0'
console.log(`  3rd down conversion:        ${thirdDownRate}% (${stats.total3rdDownConversions}/${stats.total3rdDownAttempts})`)

console.log(`\n⚖️  Balance:`)
console.log(`  Home wins:                  ${stats.homeWins} (${(stats.homeWins / stats.totalGames * 100).toFixed(1)}%)`)
console.log(`  Away wins:                  ${stats.awayWins} (${(stats.awayWins / stats.totalGames * 100).toFixed(1)}%)`)
console.log(`  Ties:                       ${stats.ties} (${(stats.ties / stats.totalGames * 100).toFixed(1)}%)`)

console.log(`\n⏱️  Performance:`)
console.log(`  Total time:                 ${duration.toFixed(2)} seconds`)
console.log(`  Games/second:               ${(numGames / duration).toFixed(1)}`)

// Points distribution histogram (top 10)
console.log(`\n📊 Points Distribution (top 10):`)
const sortedPoints = Object.entries(stats.pointsDistribution)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)

for (const [points, count] of sortedPoints) {
  const pct = (count / (stats.totalGames * 2) * 100).toFixed(1)
  const bar = '█'.repeat(Math.round(pct))
  console.log(`  ${points.toString().padStart(3)} pts: ${bar} ${pct}%`)
}

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
