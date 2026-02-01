/**
 * TI Football Game Engine
 * Handles game simulation, play execution, and stat tracking
 */

import {
  generatePlayTime,
  runningPlay,
  runAfterCatch,
  kickoffReturn,
  generateAirYards,
  generatePuntDistance,
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

  // 2-Point Conversion Tendencies (defaults, can be overridden by coach)
  TWO_PT_RUN_PCT: 0.50,        // 50% run, 50% pass
  TWO_PT_SHORT_PASS_PCT: 0.60, // When passing: 60% short, 40% medium

  // 2-Point Conversion Success Rates by play type
  TWO_PT_RUN_SUCCESS: 0.50,         // Goal-line run
  TWO_PT_SHORT_PASS_SUCCESS: 0.52,  // Quick slant/fade
  TWO_PT_MEDIUM_PASS_SUCCESS: 0.42, // Deeper route, riskier

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
 * 2 runs, 2 short passes, 2 medium passes, 2 long passes, repeat
 */
const PLAY_ROTATION = ['run', 'run', 'short', 'short', 'medium', 'medium', 'long', 'long']

/**
 * Initialize game state
 * @param {boolean} simplifiedMode - If true, runs only, no kicks, always go on 4th
 * @param {boolean} rotationMode - If true, use fixed play rotation (3 run, 3 short, 3 medium)
 */
export function initializeGame(homeTeam, awayTeam, simplifiedMode = false, rotationMode = false) {
  // Coin toss - winner receives first, loser receives at halftime
  const coinToss = Math.random() < 0.5 ? 'home' : 'away'
  const firstHalfReceiver = coinToss
  const secondHalfReceiver = coinToss === 'home' ? 'away' : 'home'

  logger.info(`Game initialized: ${awayTeam.name} @ ${homeTeam.name}${simplifiedMode ? ' (Simplified Mode)' : ''}${rotationMode ? ' (Rotation Mode)' : ''}`)
  logger.info(`Coin toss: ${coinToss === 'home' ? homeTeam.name : awayTeam.name} wins, receives first`)

  return {
    // Game mode
    simplifiedMode,
    rotationMode,
    rotationIndex: 0,  // Current position in play rotation

    // Teams
    homeTeam,
    awayTeam,
    possession: firstHalfReceiver,
    secondHalfReceiver,  // Team that receives at halftime

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
      kickReturnAttempts: 0,
      kickReturnYards: 0,
      puntReturnYards: 0,
      interceptionReturnYards: 0,
      fgAttempted: 0,
      fgMade: 0,
      xpAttempted: 0,
      xpMade: 0,
      twoPtAttempted: 0,
      twoPtMade: 0,
      safetiesScored: 0
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
      kickReturnAttempts: 0,
      kickReturnYards: 0,
      puntReturnYards: 0,
      interceptionReturnYards: 0,
      fgAttempted: 0,
      fgMade: 0,
      xpAttempted: 0,
      xpMade: 0,
      twoPtAttempted: 0,
      twoPtMade: 0,
      safetiesScored: 0
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

  // Rotation mode: cycle through run, short pass, medium pass, long pass
  if (gameState.rotationMode) {
    // On 4th down: punt if on own side, go for it if past midfield
    if (gameState.down === 4) {
      if (gameState.yardline < 50) {
        return 'punt'
      }
      // Past midfield - go for it with next play in rotation
    }

    // Inside own 15: always run to avoid sack-safeties
    // (Sacks can be up to 10 yards, so need buffer)
    if (gameState.yardline <= 15) {
      return 'run'
    }

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

  // Check for safety (stuffed run into end zone)
  if (wouldBeSafety(gameState, yards)) {
    gameState.yardline += yards  // Move to the spot (will be <= 0)
    const safetyKick = executeSafety(gameState, 'run')
    return {
      type: 'run',
      yards: yards,
      steps: steps,
      safety: true,
      safetyKick: safetyKick,
      description: `Tackled for a loss of ${Math.abs(yards)} yards in the end zone - SAFETY!`
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

  // Add conversion result and scoring log if touchdown
  if (isTouchdown && gameState.lastXpResult !== undefined) {
    result.xpGood = gameState.lastXpResult
    result.conversionType = gameState.lastConversionType || 'xp'
    if (gameState.lastTwoPtPlayType) {
      result.twoPtPlayType = gameState.lastTwoPtPlayType
    }
    const extraPointValue = gameState.lastConversionType === '2pt'
      ? (gameState.lastXpResult ? '2pt_good' : '2pt_no_good')
      : (gameState.lastXpResult ? 'good' : 'no_good')
    addScoringEntry(gameState, 'TD', 'run', yards, extraPointValue, scoringTeam)
    delete gameState.lastXpResult
    delete gameState.lastConversionType
    delete gameState.lastTwoPtPlayType
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
    // Sack! Lose 3-10 yards (reduced when backed up near goal line)
    let sackYards = Math.floor(Math.random() * 8) + 3  // 3-10 yards lost
    if (gameState.yardline <= 10) {
      // QB is more careful near own goal line - throw it away faster
      sackYards = Math.floor(sackYards * 0.6)
    }
    stats.sacks++
    stats.sackYardsLost += sackYards

    // Check for safety first (sack into end zone)
    if (wouldBeSafety(gameState, -sackYards)) {
      gameState.yardline -= sackYards  // Move to the spot (will be <= 0)
      const safetyKick = executeSafety(gameState, 'sack')
      return {
        type: 'sack',
        yards: -sackYards,
        safety: true,
        safetyKick: safetyKick,
        description: `SACK for ${sackYards} yard loss in the end zone - SAFETY!`
      }
    }

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

  // Sack check passed - this counts as a pass attempt
  stats.passAttempts++

  // Generate air yards for this pass attempt
  const airYards = generateAirYards(passType)

  // Calculate interception rate - for long passes, increases with distance
  let interceptionRate = GAME_CONSTANTS.PASS_INTERCEPTION[passType]
  if (passType === 'long') {
    // 6% base for 20-29, +2% for each 10 yards beyond
    const extraTens = Math.floor((airYards - 20) / 10)  // 0 for 20-29, 1 for 30-39, 2 for 40-49, 3 for 50
    interceptionRate = 0.06 + (extraTens * 0.02)
  }

  // Check for interception (checked before completion)
  if (Math.random() < interceptionRate) {
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
      passType: passType,
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

    // Add conversion result and scoring log if touchdown
    if (isTouchdown && gameState.lastXpResult !== undefined) {
      result.xpGood = gameState.lastXpResult
      result.conversionType = gameState.lastConversionType || 'xp'
      if (gameState.lastTwoPtPlayType) {
        result.twoPtPlayType = gameState.lastTwoPtPlayType
      }
      const extraPointValue = gameState.lastConversionType === '2pt'
        ? (gameState.lastXpResult ? '2pt_good' : '2pt_no_good')
        : (gameState.lastXpResult ? 'good' : 'no_good')
      addScoringEntry(gameState, 'TD', 'pass', totalYards, extraPointValue, scoringTeam)
      delete gameState.lastXpResult
      delete gameState.lastConversionType
      delete gameState.lastTwoPtPlayType
    }

    return result
  } else {
    // Incomplete pass
    updateDownAndDistance(gameState, 0)

    return {
      type: 'pass',
      passType: passType,
      yards: 0,
      airYards: airYards,
      complete: false,
      description: `${passType.charAt(0).toUpperCase() + passType.slice(1)} pass incomplete`
    }
  }
}

/**
 * Execute punt
 * Punt is kicked from 7 yards behind line of scrimmage
 */
function executePunt(gameState) {
  const SNAP_DISTANCE = 7
  const puntAirYards = generatePuntDistance()

  // Punt is kicked from 7 yards behind line of scrimmage
  const kickSpot = gameState.yardline - SNAP_DISTANCE
  const landSpot = kickSpot + puntAirYards

  // Check for touchback (ball lands in or past end zone)
  if (landSpot >= 100) {
    // Touchback - receiving team gets ball at their 20
    const netPuntYards = 100 - gameState.yardline  // Punted to goal line essentially
    gameState.possession = gameState.possession === 'home' ? 'away' : 'home'
    gameState.yardline = 20
    gameState.down = 1
    gameState.distance = 10

    return {
      type: 'punt',
      yards: puntAirYards,
      netYards: netPuntYards,
      touchback: true,
      description: `Punt ${puntAirYards} yards, touchback`
    }
  }

  // Net punt yards from line of scrimmage
  const netPuntYards = landSpot - gameState.yardline

  // Fair catch?
  if (Math.random() < GAME_CONSTANTS.FAIR_CATCH_PCT) {
    changePossession(gameState, netPuntYards)
    return {
      type: 'punt',
      yards: puntAirYards,
      netYards: netPuntYards,
      fairCatch: true,
      description: `Punt ${puntAirYards} yards, fair catch at the ${100 - landSpot}`
    }
  }

  // Return
  const yardsToGoal = landSpot  // Returner's distance to their own goal (which is opponent's end zone)
  const racResult = runAfterCatch({ yardsToGoal: 100 - landSpot })  // Distance to scoring end zone
  const returnYards = racResult.yards
  const defenseStats = getStats(gameState, gameState.possession === 'home' ? 'away' : 'home')
  defenseStats.puntReturnYards += returnYards

  changePossession(gameState, netPuntYards - returnYards)

  return {
    type: 'punt',
    yards: puntAirYards,
    netYards: netPuntYards - returnYards,
    returnYards: returnYards,
    description: `Punt ${puntAirYards} yards, returned ${returnYards} yards`
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
 * Check if a play would result in a safety
 * @returns {boolean} true if the new yardline would be at or behind own goal line
 */
function wouldBeSafety(gameState, yards) {
  return gameState.yardline + yards <= 0
}

/**
 * Execute a safety - award points and execute safety kick
 * @param {Object} gameState - Current game state
 * @param {string} playType - 'run' or 'sack' for scoring log
 */
function executeSafety(gameState, playType) {
  const offense = gameState.possession
  const defense = offense === 'home' ? 'away' : 'home'
  const defenseStats = getStats(gameState, defense)

  // Award 2 points to defense and track stat
  gameState.score[defense] += 2
  defenseStats.safetiesScored++
  logger.info(`🚨 SAFETY! ${defense} scores 2 points. Score: ${gameState.score.home}-${gameState.score.away}`)

  // Add scoring entry
  addScoringEntry(gameState, 'SAFETY', playType, 0, null, defense)

  // Safety kick: offense punts from their own 20
  // Generate punt distance and handle like a normal punt
  const SAFETY_KICK_SPOT = 20
  const puntAirYards = generatePuntDistance()
  const landSpot = SAFETY_KICK_SPOT + puntAirYards

  // Check for touchback on safety kick
  if (landSpot >= 100) {
    // Touchback - receiving team gets ball at their 20
    gameState.possession = defense
    gameState.yardline = 20
    gameState.down = 1
    gameState.distance = 10
    return { puntYards: puntAirYards, touchback: true }
  }

  // Fair catch or return
  if (Math.random() < GAME_CONSTANTS.FAIR_CATCH_PCT) {
    gameState.possession = defense
    gameState.yardline = 100 - landSpot
    gameState.down = 1
    gameState.distance = 10
    return { puntYards: puntAirYards, fairCatch: true, landSpot: 100 - landSpot }
  }

  // Return the safety kick
  const racResult = runAfterCatch({ yardsToGoal: 100 - landSpot })
  const returnYards = racResult.yards
  defenseStats.puntReturnYards += returnYards

  gameState.possession = defense
  gameState.yardline = 100 - landSpot + returnYards
  gameState.down = 1
  gameState.distance = 10

  return { puntYards: puntAirYards, returnYards: returnYards }
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

    // Decide: 2-point conversion or extra point?
    if (shouldGoForTwo(gameState)) {
      const twoPtGood = attemptTwoPointConversion(gameState)
      gameState.lastXpResult = twoPtGood
      gameState.lastConversionType = '2pt'
    } else {
      const xpGood = attemptExtraPoint(gameState)
      gameState.lastXpResult = xpGood
      gameState.lastConversionType = 'xp'
    }

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

  // Safety check moved to individual play handlers for proper result reporting
  // This is a fallback that shouldn't normally trigger
  if (gameState.yardline <= 0) {
    executeSafety(gameState, 'tackle')
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
 * Decide whether to attempt 2-point conversion based on game situation
 * Analytics-based decision for Q4 (and late Q3)
 * @returns {boolean} true if should go for 2
 */
function shouldGoForTwo(gameState) {
  const scoringTeam = gameState.possession
  const myScore = gameState.score[scoringTeam]
  const oppScore = gameState.score[scoringTeam === 'home' ? 'away' : 'home']

  // Point differential AFTER the TD (6 points already added)
  const diff = myScore - oppScore

  // Only consider 2PT in Q4, or late Q3 (under 5 min)
  const isLateGame = gameState.quarter === 4 ||
                     (gameState.quarter === 3 && gameState.clock < 300)

  if (!isLateGame) {
    return false
  }

  // Go for 2 in these situations (diff is after TD scored):
  // Down 8: diff = -8 (go for 2 first, know what you need later)
  // Down 5: diff = -5 (success = down 3, FG ties)
  // Down 4: diff = -4 (down 2 helps more than down 4 hurts)
  // Down 2: diff = -2 (go for tie/lead)
  // Down 9: diff = -9 (success = 1-score game)
  // Down 12: diff = -12 (need 2 TDs anyway, maximize info)
  // Down 15: diff = -15 (success = down 13, need 2 TDs)
  // Down 16: diff = -16 (need 2 TDs + 2PT anyway)

  const goForTwoSituations = [-2, -4, -5, -8, -9, -12, -15, -16]

  return goForTwoSituations.includes(diff)
}

/**
 * Attempt 2-point conversion after touchdown
 * Uses coach tendencies to decide run vs pass, short vs medium
 * @returns {Object} { success: boolean, playType: string }
 */
function attemptTwoPointConversion(gameState) {
  const stats = getStats(gameState, gameState.possession)
  stats.twoPtAttempted++

  // Get coach tendencies (use defaults for now, will pull from coach data later)
  const runPct = GAME_CONSTANTS.TWO_PT_RUN_PCT
  const shortPassPct = GAME_CONSTANTS.TWO_PT_SHORT_PASS_PCT

  // Decide play type
  let playType, successRate
  if (Math.random() < runPct) {
    playType = 'run'
    successRate = GAME_CONSTANTS.TWO_PT_RUN_SUCCESS
  } else {
    // Pass - short or medium?
    if (Math.random() < shortPassPct) {
      playType = 'short pass'
      successRate = GAME_CONSTANTS.TWO_PT_SHORT_PASS_SUCCESS
    } else {
      playType = 'medium pass'
      successRate = GAME_CONSTANTS.TWO_PT_MEDIUM_PASS_SUCCESS
    }
  }

  const success = Math.random() < successRate

  if (success) {
    stats.twoPtMade++
    gameState.score[gameState.possession] += 2
    logger.info(`✓ 2-POINT CONVERSION (${playType}) GOOD! Score: ${gameState.score.home}-${gameState.score.away}`)
  } else {
    logger.info(`✗ 2-point conversion (${playType}) FAILED! Score: ${gameState.score.home}-${gameState.score.away}`)
  }

  // Store play type for display
  gameState.lastTwoPtPlayType = playType

  return success
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
 * Starting position: 5-8 yard line (evenly distributed)
 * Return algorithm: 1-4 vs 1-40 gauntlet, then run mode
 */
function kickoff(gameState) {
  const receiver = gameState.possession === 'home' ? 'away' : 'home'
  const receiverStats = getStats(gameState, receiver)

  if (Math.random() < GAME_CONSTANTS.TOUCHBACK_PCT) {
    gameState.possession = receiver
    gameState.yardline = 30  // 2024 NFL touchback rule (35 in 2025)
    gameState.down = 1
    gameState.distance = 10
  } else {
    // Starting position: evenly distributed 5-8 yard line
    const startYardline = 5 + Math.floor(Math.random() * 4)  // 5, 6, 7, or 8
    const yardsToGoal = 100 - startYardline

    receiverStats.kickReturnAttempts++
    const returnResult = kickoffReturn({ yardsToGoal })
    const returnYards = returnResult.yards
    receiverStats.kickReturnYards += returnYards

    gameState.possession = receiver
    gameState.yardline = startYardline + returnYards
    gameState.down = 1
    gameState.distance = 10

    // Check for kick return touchdown
    if (gameState.yardline >= 100) {
      gameState.yardline = 100
      // TD will be handled by next play or we need to score it here
      // For now, just cap at 100 - the yardline check will handle it
    }
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

  // Halftime - second half receiver gets the ball
  if (gameState.quarter === 3) {
    if (gameState.simplifiedMode) {
      // Simplified mode: second half receiver starts at own 35
      gameState.possession = gameState.secondHalfReceiver
      gameState.yardline = 35
      gameState.down = 1
      gameState.distance = 10
    } else {
      // Set possession to kicking team so kickoff gives ball to receiver
      gameState.possession = gameState.secondHalfReceiver === 'home' ? 'away' : 'home'
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
