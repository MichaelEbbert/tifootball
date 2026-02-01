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

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Import game logic from client (convert to file:// URL for Windows compatibility)
const gameEnginePath = pathToFileURL(join(__dirname, '..', 'client', 'src', 'utils', 'gameEngine.js')).href
const gameSimPath = pathToFileURL(join(__dirname, '..', 'client', 'src', 'utils', 'gameSimulation.js')).href

const { initializeGame, executePlay, isGameOver } = await import(gameEnginePath)
const { runningPlay } = await import(gameSimPath)

// Parse command line arguments
const args = process.argv.slice(2)
let numGames = 100
let fourthDownTest = false
let rotationMode = false
let fullMode = false  // Use full game mode (with kickoffs/punts)

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
}

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

// Mock team data
const homeTeam = {
  id: 1,
  city: 'Home',
  name: 'Team',
  abbreviation: 'HME'
}

const awayTeam = {
  id: 2,
  city: 'Away',
  name: 'Team',
  abbreviation: 'AWY'
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
const modeFlags = [rotationMode && 'rotation', fullMode && 'full'].filter(Boolean).join(', ')
console.log(`Running ${numGames} games...${modeFlags ? ` (${modeFlags})` : ''}\n`)

const startTime = Date.now()

// Run simulations
for (let game = 0; game < numGames; game++) {
  const simplifiedMode = !fullMode
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

console.log(`\n📈 Game Flow:`)
console.log(`  Avg plays/game:             ${avgPlaysPerGame.toFixed(1)}`)
console.log(`  Avg first downs/game:       ${avgFirstDownsPerGame.toFixed(1)}`)
console.log(`  Avg turnovers/game:         ${avgFumblesPerGame.toFixed(2)}`)

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
