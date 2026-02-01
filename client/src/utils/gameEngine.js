/**
 * TI Football Game Engine
 * Handles game simulation, play execution, and stat tracking
 */

import {
  generatePlayTime,
  runningPlay,
  runAfterCatch,
  generateAirYards,
  formatGameClock,
  QUARTER_LENGTH
} from './gameSimulation.js'
import logger from './logger.js'

/**
 * Game Design Constants
 * See game-design-decisions.md for full documentation
 */
const GAME_CONSTANTS = {
  // Passing (by air yards: short 0-9, medium 10-19, long 20+)
  PASS_COMPLETION: { short: 0.70, medium: 0.58, long: 0.42 },
  PASS_INTERCEPTION: { short: 0.02, medium: 0.03, long: 0.06 },
  // Air yards generated via normal distribution with these means
  AIR_YARDS_MEAN: { short: 4, medium: 14 },  // long TBD
  AIR_YARDS_RANGE: { short: [0, 9], medium: [10, 19], long: [20, 50] },

  // Sacks (checked before completion/interception)
  SACK_RATE: { short: 0.04, medium: 0.07, long: 0.10 },  // Mean: 7%
  SACK_FUMBLE_RATE: 0.18,      // 18% of sacks cause fumble
  SACK_FUMBLE_LOST: 0.47,      // 47% of sack fumbles lost to defense

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
 * Play rotation pattern for "game tape" mode
 * 3 runs, 3 short passes, 3 medium passes, repeat
 */
const PLAY_ROTATION = ['run', 'run', 'run', 'short', 'short', 'short', 'medium', 'medium', 'medium']

/**
 * Initialize game state
 * @param {boolean} simplifiedMode - If true, runs only, no kicks, always go on 4th
 * @param {boolean} rotationMode - If true, use fixed play rotation (3 run, 3 short, 3 medium)
 */
export function initializeGame(homeTeam, awayTeam, simplifiedMode = false, rotationMode = false) {
  logger.info(`Game initialized: ${awayTeam.name} @ ${homeTeam.name}${simplifiedMode ? ' (Simplified Mode)' : ''}${rotationMode ? ' (Rotation Mode)' : ''}`)

  return {
    // Game mode
    simplifiedMode,
    rotationMode,
    rotationIndex: 0,  // Current position in play rotation

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
    scoringLog: [],  // Newspaper-style scoring summary

    // Stats - Home Team
    homeStats: {
      // Rushing
      rushingAttempts: 0,
      rushingYards: 0,
      rushingFumbles: 0,
      rushingFumblesLost: 0,
      rushingTouchdowns: 0,
      // Passing
      passAttempts: 0,
      passCompletions: 0,
      passYards: 0,
      passRacYards: 0,
      passInterceptions: 0,
      passTouchdowns: 0,
      // Sacks
      sacks: 0,
      sackYardsLost: 0,
      sackFumbles: 0,
      sackFumblesLost: 0,
      // Receiving fumbles
      recFumbles: 0,
      recFumblesLost: 0,
      //Downs
      firstDowns: 0,
      thirdDownAttempts: 0,
      thirdDownConversions: 0,
      fourthDownAttempts: 0,
      fourthDownConversions: 0,
      // Other
      timeOfPossession: 0,
      kickReturnYards: 0,
      puntReturnYards: 0,
      interceptionReturnYards: 0,
      fgAttempted: 0,
      fgMade: 0,
      xpAttempted: 0,
      xpMade: 0,
      twoPtAttempted: 0,
      twoPtMade: 0
    },

    // Stats - Away Team
    awayStats: {
      // Rushing
      rushingAttempts: 0,
      rushingYards: 0,
      rushingFumbles: 0,
      rushingFumblesLost: 0,
      rushingTouchdowns: 0,
      // Passing
      passAttempts: 0,
      passCompletions: 0,
      passYards: 0,
      passRacYards: 0,
      passInterceptions: 0,
      passTouchdowns: 0,
      // Sacks
      sacks: 0,
      sackYardsLost: 0,
      sackFumbles: 0,
      sackFumblesLost: 0,
      // Receiving fumbles
      recFumbles: 0,
      recFumblesLost: 0,
      // Downs
      firstDowns: 0,
      thirdDownAttempts: 0,
      thirdDownConversions: 0,
      fourthDownAttempts: 0,
      fourthDownConversions: 0,
      // Other
      timeOfPossession: 0,
      kickReturnYards: 0,
      puntReturnYards: 0,
      interceptionReturnYards: 0,
      fgAttempted: 0,
      fgMade: 0,
      xpAttempted: 0,
      xpMade: 0,
      twoPtAttempted: 0,
      twoPtMade: 0
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
 * Add a scoring entry to the game log
 * @param {Object} gameState - Current game state
 * @param {string} scoreType - 'TD', 'FG', 'SAFETY'
 * @param {string} playType - 'run', 'pass', 'kick_return', 'punt_return', 'int_return', 'fumble_return'
 * @param {number} yards - Yards on the scoring play
 * @param {string} extraPoint - 'good', 'no_good', '2pt_good', '2pt_no_good', or null
 * @param {string} scoringTeam - 'home' or 'away'
 */
function addScoringEntry(gameState, scoreType, playType, yards, extraPoint, scoringTeam) {
  const team = scoringTeam === 'home' ? gameState.homeTeam : gameState.awayTeam

  let description
  if (scoreType === 'TD') {
    const xpText = extraPoint === 'good' ? 'kick good' :
                   extraPoint === 'no_good' ? 'kick failed' :
                   extraPoint === '2pt_good' ? '2pt good' :
                   extraPoint === '2pt_no_good' ? '2pt failed' : ''
    description = `TD ${yards} yard ${playType} (${xpText})`
  } else if (scoreType === 'FG') {
    description = `FG ${yards} yards`
  } else if (scoreType === 'SAFETY') {
    description = 'Safety'
  }

  gameState.scoringLog.push({
    quarter: gameState.quarter,
    time_remaining: gameState.clock,
    team_id: team.id,
    team_abbr: team.abbreviation,
    score_type: scoreType,
    play_type: playType,
    yards: yards,
    extra_point: extraPoint,
    home_score: gameState.score.home,
    away_score: gameState.score.away,
    description: description
  })
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
    case 'short':
      playResult = executePass(gameState, 'short')
      break
    case 'medium':
      playResult = executePass(gameState, 'medium')
      break
    case 'long':
      playResult = executePass(gameState, 'long')
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
  if (gameState.clock <= 0 && gameState.quarter < 4) {
    advanceQuarter(gameState)
  }
  // Q4 clock expiring ends the game (handled by isGameOver check)

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
  // Check for debug-forced play type
  if (gameState.forcedPlayType) {
    const forced = gameState.forcedPlayType
    delete gameState.forcedPlayType  // Clear after use (one play only)
    return forced
  }

  // Rotation mode: cycle through run, short pass, medium pass
  if (gameState.rotationMode) {
    const playType = PLAY_ROTATION[gameState.rotationIndex]
    gameState.rotationIndex = (gameState.rotationIndex + 1) % PLAY_ROTATION.length
    return playType
  }

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
  stats.rushingAttempts++

  // 4th and 1 uses tighter defense (1-4 vs 1-4 instead of 1-4 vs 1-5)
  const isFourthAndOne = gameState.down === 4 && gameState.distance === 1
  const yardsToGoal = 100 - gameState.yardline
  const runResult = runningPlay({ fourthAndOne: isFourthAndOne, yardsToGoal })
  const yards = runResult.yards
  const steps = runResult.steps
  stats.rushingYards += yards

  // Check for fumble on running play (3%)
  if (Math.random() < GAME_CONSTANTS.FUMBLE_RATE_RUN) {
    stats.rushingFumbles++
    if (Math.random() > GAME_CONSTANTS.FUMBLE_RECOVERY_OFFENSE) {
      // Defense recovers - turnover at the spot of the fumble
      stats.rushingFumblesLost++
      gameState.yardline += yards  // Move to fumble spot
      logger.info(`FUMBLE! ${gameState.possession} loses the ball at ${gameState.yardline}`)
      changePossession(gameState, 0, true)  // Maintain field position
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
      logger.info(`FUMBLE! ${gameState.possession} recovers`)
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
  const scoringTeam = gameState.possession  // Capture before possession might change
  if (isTouchdown) {
    stats.rushingTouchdowns++
  }

  updateDownAndDistance(gameState, yards)

  // Build result
  const result = {
    type: 'run',
    yards: yards,
    steps: steps,
    touchdown: isTouchdown,
    description: yards >= 0 ? `Tackled for a gain of ${yards} yards` : `Tackled for a loss of ${Math.abs(yards)} yards`
  }

  // Add XP result and scoring log if touchdown
  if (isTouchdown && gameState.lastXpResult !== undefined) {
    result.xpGood = gameState.lastXpResult
    addScoringEntry(gameState, 'TD', 'run', yards, gameState.lastXpResult ? 'good' : 'no_good', scoringTeam)
    delete gameState.lastXpResult // Clean up
  }

  return result
}

/**
 * Execute passing play
 * @param {Object} gameState - Current game state
 * @param {string} forcedType - Optional forced pass type ('short', 'medium', 'long')
 */
function executePass(gameState, forcedType = null) {
  const stats = getStats(gameState, gameState.possession)
  stats.passAttempts++

  // Determine pass type based on distance needed (or use forced type)
  // Short (0-9 air yards): for short yardage situations
  // Medium (10-19 air yards): for moderate gains
  // Long (20+ air yards): for big plays
  let passType
  if (forcedType) {
    passType = forcedType
  } else if (gameState.distance <= 5) {
    passType = 'short'
  } else if (gameState.distance <= 15) {
    passType = 'medium'
  } else {
    passType = 'long'
  }

  // Check for sack (longer developing passes = higher sack rate)
  if (Math.random() < GAME_CONSTANTS.SACK_RATE[passType]) {
    // Sack! Lose 3-10 yards
    const sackYards = Math.floor(Math.random() * 8) + 3  // 3-10 yards lost
    stats.sacks++
    stats.sackYardsLost += sackYards

    // Check for strip sack (18% of sacks cause fumble)
    if (Math.random() < GAME_CONSTANTS.SACK_FUMBLE_RATE) {
      stats.sackFumbles++
      if (Math.random() < GAME_CONSTANTS.SACK_FUMBLE_LOST) {
        // Defense recovers - turnover!
        stats.sackFumblesLost++
        gameState.yardline -= sackYards  // Move back from sack
        logger.info(`STRIP SACK! ${gameState.possession} loses the ball at ${gameState.yardline}`)
        changePossession(gameState, 0, true)
        return {
          type: 'sack',
          yards: -sackYards,
          fumble: true,
          turnover: true,
          description: `SACK for ${sackYards} yard loss, FUMBLE! Recovered by defense`
        }
      } else {
        // Offense recovers fumble
        logger.info(`Sack with fumble, ${gameState.possession} recovers`)
        updateDownAndDistance(gameState, -sackYards)
        return {
          type: 'sack',
          yards: -sackYards,
          fumble: true,
          turnover: false,
          description: `SACK for ${sackYards} yard loss, fumble recovered by offense`
        }
      }
    }

    // Regular sack, no fumble
    logger.debug(`  Sack for ${sackYards} yard loss`)
    updateDownAndDistance(gameState, -sackYards)
    return {
      type: 'sack',
      yards: -sackYards,
      description: `SACK! Loss of ${sackYards} yards`
    }
  }

  // Generate air yards for this pass attempt
  const airYards = generateAirYards(passType)

  // Check for interception (checked before completion)
  if (Math.random() < GAME_CONSTANTS.PASS_INTERCEPTION[passType]) {
    stats.passInterceptions++
    const racResult = runAfterCatch()
    const returnYards = racResult.yards
    // Defense gets the return yards
    const defenseStats = getStats(gameState, gameState.possession === 'home' ? 'away' : 'home')
    defenseStats.interceptionReturnYards += returnYards
    logger.info(`INTERCEPTION! ${gameState.possession} pass picked off at ${airYards} air yards, returned ${returnYards} yards`)

    // Change possession at the interception spot
    gameState.yardline += airYards  // Move to where INT happened
    changePossession(gameState, 0, true)

    return {
      type: 'pass',
      yards: 0,
      airYards: airYards,
      interception: true,
      turnover: true,
      returnYards: returnYards,
      description: `${passType.charAt(0).toUpperCase() + passType.slice(1)} pass intercepted! Returned ${returnYards} yards`
    }
  }

  // Check for completion
  if (Math.random() < GAME_CONSTANTS.PASS_COMPLETION[passType]) {
    // Check where the pass lands
    const passLandsAt = gameState.yardline + airYards

    // Pass out the back of the end zone (110+ yards) is incomplete
    if (passLandsAt >= 110) {
      updateDownAndDistance(gameState, 0)
      return {
        type: 'pass',
        passType: passType,
        yards: 0,
        airYards: airYards,
        complete: false,
        outOfBounds: true,
        description: `${passType.charAt(0).toUpperCase() + passType.slice(1)} pass out of bounds in end zone`
      }
    }

    // Pass lands in end zone (100-109 yards) is immediate touchdown, no RAC
    let racYards = 0
    let racSteps = []
    if (passLandsAt >= 100) {
      // Caught in end zone - touchdown!
      racYards = 0
      racSteps = []
    } else {
      // Completed pass in field of play - add run after catch
      const yardsToGoal = 100 - passLandsAt
      const racResult = runAfterCatch({ yardsToGoal })
      racYards = racResult.yards
      racSteps = racResult.steps.map(step => airYards + step)  // Adjust steps for display
    }

    const totalYards = airYards + racYards

    stats.passCompletions++
    stats.passYards += totalYards
    stats.passRacYards += racYards

    // Check for fumble after catch (2% for now, will use RAC fumble rate later)
    // Only check if there was RAC (not if caught in end zone)
    if (racYards > 0 && Math.random() < GAME_CONSTANTS.FUMBLE_RATE_PASS) {
      stats.recFumbles++
      if (Math.random() > GAME_CONSTANTS.FUMBLE_RECOVERY_OFFENSE) {
        // Defense recovers - turnover at the spot of the fumble
        stats.recFumblesLost++
        gameState.yardline += totalYards  // Move to fumble spot
        logger.info(`FUMBLE! ${gameState.possession} loses the ball at ${gameState.yardline}`)
        changePossession(gameState, 0, true)  // Maintain field position
        return {
          type: 'pass',
          passType: passType,
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
          passType: passType,
          yards: totalYards,
          complete: true,
          fumble: true,
          turnover: false,
          description: `Pass complete for ${totalYards} yards, FUMBLE, recovered by offense`
        }
      }
    }

    // Check for passing touchdown before updating
    const isTouchdown = gameState.yardline + totalYards >= 100
    const scoringTeam = gameState.possession  // Capture before possession might change
    if (isTouchdown) {
      stats.passTouchdowns++
    }

    updateDownAndDistance(gameState, totalYards)

    const result = {
      type: 'pass',
      passType: passType,
      yards: totalYards,
      airYards: airYards,
      racYards: racYards,
      racSteps: racSteps,
      complete: true,
      touchdown: isTouchdown,
      description: isTouchdown && racYards === 0
        ? `Pass complete for ${totalYards} yards in the end zone`
        : `Pass complete for ${totalYards} yards (${airYards} air, ${racYards} RAC)`
    }

    // Add XP result and scoring log if touchdown
    if (isTouchdown && gameState.lastXpResult !== undefined) {
      result.xpGood = gameState.lastXpResult
      addScoringEntry(gameState, 'TD', 'pass', totalYards, gameState.lastXpResult ? 'good' : 'no_good', scoringTeam)
      delete gameState.lastXpResult
    }

    return result
  } else {
    // Incomplete pass
    updateDownAndDistance(gameState, 0)

    return {
      type: 'pass',
      yards: 0,
      airYards: airYards,
      complete: false,
      description: `${passType.charAt(0).toUpperCase() + passType.slice(1)} pass incomplete`
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
    const scoringTeam = gameState.possession
    gameState.score[gameState.possession] += 3
    logger.info(`Field goal GOOD! ${fgDistance} yards. Score: ${gameState.score.home}-${gameState.score.away}`)

    // Add scoring entry
    addScoringEntry(gameState, 'FG', 'kick', fgDistance, null, scoringTeam)

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
    // Add scoring entry for the defense
    addScoringEntry(gameState, 'SAFETY', 'tackle', 0, null, defense)
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
      // Turnover on downs - other team takes over at this spot
      changePossession(gameState, 0, true)
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
function changePossession(gameState, fieldChange, turnoverOnDowns = false) {
  gameState.possession = gameState.possession === 'home' ? 'away' : 'home'

  if (gameState.simplifiedMode && !turnoverOnDowns) {
    // Simplified mode: fumbles start at own 35
    gameState.yardline = 35
  } else {
    // Turnover on downs or normal mode: maintain field position
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

  // Halftime - other team gets the ball
  if (gameState.quarter === 3) {
    if (gameState.simplifiedMode) {
      // Simplified mode: swap possession, start at own 35
      gameState.possession = gameState.possession === 'home' ? 'away' : 'home'
      gameState.yardline = 35
      gameState.down = 1
      gameState.distance = 10
    } else {
      kickoff(gameState)
    }
  }
}

/**
 * Check if game is over
 */
export function isGameOver(gameState) {
  // Game ends when Q4 clock expires (or if somehow quarter > 4)
  return gameState.quarter > 4 || (gameState.quarter === 4 && gameState.clock <= 0)
}
