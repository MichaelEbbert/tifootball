/**
 * TI Football Game Engine
 * Handles game simulation, play execution, and stat tracking
 */

import {
  generatePlayTime,
  runningPlay,
  runAfterCatch,
  formatGameClock,
  QUARTER_LENGTH
} from './gameSimulation.js'
import logger from './logger.js'

/**
 * Game Design Constants
 * See game-design-decisions.md for full documentation
 */
const GAME_CONSTANTS = {
  // Passing
  PASS_COMPLETION: { short: 0.70, medium: 0.60, long: 0.45 },
  PASS_INTERCEPTION: { short: 0.02, medium: 0.03, long: 0.05 },
  AIR_YARDS: { short: [5, 10], medium: [11, 20], long: [21, 40] },

  // Fumbles
  FUMBLE_RATE_RUN: 0.03,    // 3% on running plays
  FUMBLE_RATE_PASS: 0.02,   // 2% after catch (for now)
  FUMBLE_RECOVERY_OFFENSE: 0.50,

  // Punts
  PUNT_DISTANCE_AVG: 45,
  FAIR_CATCH_PCT: 0.40,

  // Field Goals
  FG_SUCCESS: { '0-29': 0.95, '30-39': 0.85, '40-49': 0.70, '50+': 0.50 },

  // Kickoffs
  TOUCHBACK_PCT: 0.60,
  KICKOFF_RETURN_START: 5,

  // Extra Points
  XP_SUCCESS: 0.95,
  TWO_PT_SUCCESS: 0.47,

  // Play Calling
  PLAY_CALL: {
    '1st-10': { run: 0.55, pass: 0.45 },
    '2nd-short': { run: 0.65, pass: 0.35 },
    '2nd-medium': { run: 0.50, pass: 0.50 },
    '2nd-long': { run: 0.35, pass: 0.65 },
    '3rd-short': { run: 0.60, pass: 0.40 },
    '3rd-medium': { run: 0.30, pass: 0.70 },
    '3rd-long': { run: 0.15, pass: 0.85 }
  }
}

/**
 * Initialize game state
 * @param {boolean} simplifiedMode - If true, runs only, no kicks, always go on 4th
 */
export function initializeGame(homeTeam, awayTeam, simplifiedMode = false) {
  logger.info(`Game initialized: ${awayTeam.name} @ ${homeTeam.name}${simplifiedMode ? ' (Simplified Mode)' : ''}`)

  return {
    // Game mode
    simplifiedMode,

    // Teams
    homeTeam,
    awayTeam,
    possession: 'away', // Away team starts with ball

    // Score
    score: { home: 0, away: 0 },

    // Field state
    quarter: 1,
    clock: QUARTER_LENGTH, // seconds remaining in quarter
    down: 1,
    distance: 10,
    yardline: 35, // Starting field position (own 35)
    ballOn: 'away', // Which team's side of field ('home' or 'away')

    // Play tracking
    playNumber: 0,
    playLog: [],

    // Stats - Home Team
    homeStats: {
      runningPlays: 0,
      runningYards: 0,
      passPlays: 0,
      passYards: 0,
      firstDowns: 0,
      thirdDownAttempts: 0,
      thirdDownConversions: 0,
      fourthDownAttempts: 0,
      fourthDownConversions: 0,
      fumblesLost: 0,
      interceptionsLost: 0,
      timeOfPossession: 0,
      kickReturnYards: 0,
      puntReturnYards: 0,
      interceptionReturnYards: 0,
      fgAttempted: 0,
      fgMade: 0,
      xpAttempted: 0,
      xpMade: 0
    },

    // Stats - Away Team
    awayStats: {
      runningPlays: 0,
      runningYards: 0,
      passPlays: 0,
      passYards: 0,
      firstDowns: 0,
      thirdDownAttempts: 0,
      thirdDownConversions: 0,
      fourthDownAttempts: 0,
      fourthDownConversions: 0,
      fumblesLost: 0,
      interceptionsLost: 0,
      timeOfPossession: 0,
      kickReturnYards: 0,
      puntReturnYards: 0,
      interceptionReturnYards: 0,
      fgAttempted: 0,
      fgMade: 0,
      xpAttempted: 0,
      xpMade: 0
    }
  }
}

/**
 * Get current stats for a team
 */
function getStats(gameState, team) {
  return team === 'home' ? gameState.homeStats : gameState.awayStats
}

/**
 * Execute a single play
 */
export function executePlay(gameState) {
  const playTime = generatePlayTime()
  gameState.playNumber++

  logger.debug(`Play ${gameState.playNumber}: Q${gameState.quarter} ${formatGameClock(gameState.clock)} - ${gameState.possession} ball, ${gameState.down} & ${gameState.distance} at ${gameState.yardline}`)

  // Update time of possession
  const possessionStats = getStats(gameState, gameState.possession)
  possessionStats.timeOfPossession += playTime

  // Determine play type
  const playType = determinePlayType(gameState)
  logger.debug(`  Play type: ${playType}`)

  let playResult
  switch (playType) {
    case 'run':
      playResult = executeRun(gameState)
      break
    case 'pass':
      playResult = executePass(gameState)
      break
    case 'punt':
      playResult = executePunt(gameState)
      break
    case 'fieldgoal':
      playResult = executeFieldGoal(gameState)
      break
    default:
      playResult = { type: 'unknown', yards: 0, description: 'Unknown play' }
  }

  // Update clock
  gameState.clock -= playTime
  if (gameState.clock <= 0) {
    advanceQuarter(gameState)
  }

  // Log the play
  gameState.playLog.push({
    playNumber: gameState.playNumber,
    quarter: gameState.quarter,
    time: formatGameClock(gameState.clock),
    down: gameState.down,
    distance: gameState.distance,
    yardline: gameState.yardline,
    possession: gameState.possession,
    ...playResult
  })

  return playResult
}

/**
 * Determine what play to call based on down, distance, field position
 */
function determinePlayType(gameState) {
  const { down, simplifiedMode } = gameState

  // Simplified mode: always run, always go for it on 4th
  if (simplifiedMode) {
    return 'run'
  }

  const { distance, yardline } = gameState

  // 4th down logic
  if (down === 4) {
    // Field goal range (inside opponent 45)
    if (yardline >= 55) {
      return 'fieldgoal'
    }
    // Go for it if short yardage and good field position
    if (distance <= 2 && yardline >= 40) {
      return Math.random() < 0.50 ? 'run' : 'pass'
    }
    // Otherwise punt
    return 'punt'
  }

  // 1st-3rd down: use tendency chart
  let situation
  if (down === 1 && distance === 10) {
    situation = '1st-10'
  } else if (down === 2) {
    if (distance <= 3) situation = '2nd-short'
    else if (distance <= 7) situation = '2nd-medium'
    else situation = '2nd-long'
  } else if (down === 3) {
    if (distance <= 3) situation = '3rd-short'
    else if (distance <= 7) situation = '3rd-medium'
    else situation = '3rd-long'
  }

  const tendency = GAME_CONSTANTS.PLAY_CALL[situation]
  return Math.random() < tendency.run ? 'run' : 'pass'
}

/**
 * Execute running play
 */
function executeRun(gameState) {
  const stats = getStats(gameState, gameState.possession)
  stats.runningPlays++

  // 4th and 1 uses tighter defense (1-4 vs 1-4 instead of 1-4 vs 1-5)
  const isFourthAndOne = gameState.down === 4 && gameState.distance === 1
  const runResult = runningPlay({ fourthAndOne: isFourthAndOne })
  const yards = runResult.yards
  const steps = runResult.steps
  stats.runningYards += yards

  // Check for fumble on running play (3%)
  if (Math.random() < GAME_CONSTANTS.FUMBLE_RATE_RUN) {
    if (Math.random() > GAME_CONSTANTS.FUMBLE_RECOVERY_OFFENSE) {
      // Defense recovers - turnover
      stats.fumblesLost++
      logger.info(`💨 FUMBLE! ${gameState.possession} loses the ball`)
      return {
        type: 'run',
        yards: yards,
        steps: steps,
        fumble: true,
        turnover: true,
        description: `Run for ${yards} yards, FUMBLE, recovered by defense`
      }
    } else {
      // Offense recovers - no turnover but play ends
      logger.info(`💨 FUMBLE! ${gameState.possession} recovers`)
      updateDownAndDistance(gameState, yards)
      return {
        type: 'run',
        yards: yards,
        steps: steps,
        fumble: true,
        turnover: false,
        description: `Run for ${yards} yards, FUMBLE, recovered by offense`
      }
    }
  }

  // Check if this will be a touchdown before updating
  const isTouchdown = gameState.yardline + yards >= 100

  updateDownAndDistance(gameState, yards)

  // Build result
  const result = {
    type: 'run',
    yards: yards,
    steps: steps,
    touchdown: isTouchdown,
    description: yards >= 0 ? `Tackled for a gain of ${yards} yards` : `Tackled for a loss of ${Math.abs(yards)} yards`
  }

  // Add XP result if touchdown
  if (isTouchdown && gameState.lastXpResult !== undefined) {
    result.xpGood = gameState.lastXpResult
    delete gameState.lastXpResult // Clean up
  }

  return result
}

/**
 * Execute passing play
 */
function executePass(gameState) {
  const stats = getStats(gameState, gameState.possession)
  stats.passPlays++

  // Determine pass type based on distance needed
  let passType
  if (gameState.distance <= 5) passType = 'short'
  else if (gameState.distance <= 15) passType = 'medium'
  else passType = 'long'

  // Check for interception
  if (Math.random() < GAME_CONSTANTS.PASS_INTERCEPTION[passType]) {
    stats.interceptionsLost++
    const racResult = runAfterCatch()
    const returnYards = racResult.yards
    // Defense gets the return yards
    const defenseStats = getStats(gameState, gameState.possession === 'home' ? 'away' : 'home')
    defenseStats.interceptionReturnYards += returnYards
    logger.info(`🚫 INTERCEPTION! ${gameState.possession} pass picked off, returned ${returnYards} yards`)

    return {
      type: 'pass',
      yards: 0,
      interception: true,
      turnover: true,
      returnYards: returnYards,
      description: `Pass intercepted! Returned ${returnYards} yards`
    }
  }

  // Check for completion
  if (Math.random() < GAME_CONSTANTS.PASS_COMPLETION[passType]) {
    // Completed pass
    const [minAir, maxAir] = GAME_CONSTANTS.AIR_YARDS[passType]
    const airYards = Math.floor(Math.random() * (maxAir - minAir + 1)) + minAir
    const racResult = runAfterCatch()
    const racYards = racResult.yards
    const totalYards = airYards + racYards

    stats.passYards += totalYards

    // Check for fumble after catch (2% for now, will use RAC fumble rate later)
    if (Math.random() < GAME_CONSTANTS.FUMBLE_RATE_PASS) {
      if (Math.random() > GAME_CONSTANTS.FUMBLE_RECOVERY_OFFENSE) {
        // Defense recovers - turnover
        stats.fumblesLost++
        return {
          type: 'pass',
          yards: totalYards,
          complete: true,
          fumble: true,
          turnover: true,
          description: `Pass complete for ${totalYards} yards, FUMBLE, recovered by defense`
        }
      } else {
        // Offense recovers - no turnover but play ends
        updateDownAndDistance(gameState, totalYards)
        return {
          type: 'pass',
          yards: totalYards,
          complete: true,
          fumble: true,
          turnover: false,
          description: `Pass complete for ${totalYards} yards, FUMBLE, recovered by offense`
        }
      }
    }

    updateDownAndDistance(gameState, totalYards)

    return {
      type: 'pass',
      yards: totalYards,
      complete: true,
      description: `Pass complete for ${totalYards} yards (${airYards} air, ${racYards} RAC)`
    }
  } else {
    // Incomplete pass
    updateDownAndDistance(gameState, 0)

    return {
      type: 'pass',
      yards: 0,
      complete: false,
      description: 'Pass incomplete'
    }
  }
}

/**
 * Execute punt
 */
function executePunt(gameState) {
  const puntYards = GAME_CONSTANTS.PUNT_DISTANCE_AVG + (Math.random() * 20 - 10) // ±10 variance

  // Fair catch?
  if (Math.random() < GAME_CONSTANTS.FAIR_CATCH_PCT) {
    changePossession(gameState, Math.floor(puntYards))
    return {
      type: 'punt',
      yards: Math.floor(puntYards),
      fairCatch: true,
      description: `Punt ${Math.floor(puntYards)} yards, fair catch`
    }
  }

  // Return
  const racResult = runAfterCatch()
  const returnYards = racResult.yards
  const defenseStats = getStats(gameState, gameState.possession === 'home' ? 'away' : 'home')
  defenseStats.puntReturnYards += returnYards

  changePossession(gameState, Math.floor(puntYards) + returnYards)

  return {
    type: 'punt',
    yards: Math.floor(puntYards),
    returnYards: returnYards,
    description: `Punt ${Math.floor(puntYards)} yards, returned ${returnYards} yards`
  }
}

/**
 * Execute field goal attempt
 */
function executeFieldGoal(gameState) {
  const stats = getStats(gameState, gameState.possession)
  stats.fgAttempted++

  // Distance = yards to goal + 10 (end zone) + 7 (snap distance)
  const fgDistance = (100 - gameState.yardline) + 17

  // Determine success rate
  let successRate
  if (fgDistance < 30) successRate = GAME_CONSTANTS.FG_SUCCESS['0-29']
  else if (fgDistance < 40) successRate = GAME_CONSTANTS.FG_SUCCESS['30-39']
  else if (fgDistance < 50) successRate = GAME_CONSTANTS.FG_SUCCESS['40-49']
  else successRate = GAME_CONSTANTS.FG_SUCCESS['50+']

  if (Math.random() < successRate) {
    stats.fgMade++
    gameState.score[gameState.possession] += 3
    logger.info(`🎯 Field goal GOOD! ${fgDistance} yards. Score: ${gameState.score.home}-${gameState.score.away}`)

    return {
      type: 'fieldgoal',
      distance: fgDistance,
      made: true,
      description: `${fgDistance}-yard field goal GOOD!`
    }
  } else {
    changePossession(gameState, 0) // Defense gets ball at spot

    return {
      type: 'fieldgoal',
      distance: fgDistance,
      made: false,
      description: `${fgDistance}-yard field goal MISSED`
    }
  }
}

/**
 * Update down and distance after a play
 */
function updateDownAndDistance(gameState, yards) {
  const stats = getStats(gameState, gameState.possession)

  // Update field position
  gameState.yardline += yards

  // Check for touchdown
  if (gameState.yardline >= 100) {
    gameState.score[gameState.possession] += 6
    logger.info(`🏈 TOUCHDOWN! ${gameState.possession} scores. Score: ${gameState.score.home}-${gameState.score.away}`)

    // Attempt extra point (both modes now)
    const xpGood = attemptExtraPoint(gameState)
    gameState.lastXpResult = xpGood // Store for play result

    if (gameState.simplifiedMode) {
      // Simplified mode: no kickoff, other team starts at own 35
      gameState.possession = gameState.possession === 'home' ? 'away' : 'home'
      gameState.yardline = 35
      gameState.down = 1
      gameState.distance = 10
    } else {
      kickoff(gameState)
    }
    return
  }

  // Check for safety
  if (gameState.yardline <= 0) {
    const defense = gameState.possession === 'home' ? 'away' : 'home'
    gameState.score[defense] += 2
    changePossession(gameState, 20) // Free kick from 20
    return
  }

  // Check for first down
  gameState.distance -= yards
  if (gameState.distance <= 0) {
    stats.firstDowns++
    if (gameState.down === 3) stats.thirdDownConversions++
    if (gameState.down === 4) stats.fourthDownConversions++

    gameState.down = 1
    gameState.distance = 10
  } else {
    gameState.down++
    if (gameState.down === 3) stats.thirdDownAttempts++
    if (gameState.down === 4) stats.fourthDownAttempts++

    if (gameState.down > 4) {
      // Turnover on downs
      changePossession(gameState, 0)
    }
  }
}

/**
 * Attempt extra point after touchdown
 * @returns {boolean} true if XP was made
 */
function attemptExtraPoint(gameState) {
  const stats = getStats(gameState, gameState.possession)
  stats.xpAttempted++

  if (Math.random() < GAME_CONSTANTS.XP_SUCCESS) {
    stats.xpMade++
    gameState.score[gameState.possession] += 1
    logger.info(`✓ Extra point GOOD! Score: ${gameState.score.home}-${gameState.score.away}`)
    return true
  } else {
    logger.info(`✗ Extra point MISSED! Score: ${gameState.score.home}-${gameState.score.away}`)
    return false
  }
}

/**
 * Execute kickoff
 */
function kickoff(gameState) {
  const receiver = gameState.possession === 'home' ? 'away' : 'home'

  if (Math.random() < GAME_CONSTANTS.TOUCHBACK_PCT) {
    gameState.possession = receiver
    gameState.yardline = 25
    gameState.down = 1
    gameState.distance = 10
  } else {
    const racResult = runAfterCatch()
    const returnYards = racResult.yards
    const receiverStats = getStats(gameState, receiver)
    receiverStats.kickReturnYards += returnYards

    gameState.possession = receiver
    gameState.yardline = GAME_CONSTANTS.KICKOFF_RETURN_START + returnYards
    gameState.down = 1
    gameState.distance = 10
  }
}

/**
 * Change possession (turnover, punt, etc.)
 */
function changePossession(gameState, fieldChange) {
  gameState.possession = gameState.possession === 'home' ? 'away' : 'home'

  if (gameState.simplifiedMode) {
    // Simplified mode: always start at own 35
    gameState.yardline = 35
  } else {
    gameState.yardline = 100 - (gameState.yardline + fieldChange)
  }

  gameState.down = 1
  gameState.distance = 10
}

/**
 * Advance to next quarter
 */
function advanceQuarter(gameState) {
  gameState.quarter++
  gameState.clock = QUARTER_LENGTH

  // Halftime - reverse possession
  if (gameState.quarter === 3) {
    kickoff(gameState)
  }
}

/**
 * Check if game is over
 */
export function isGameOver(gameState) {
  return gameState.quarter > 4
}
