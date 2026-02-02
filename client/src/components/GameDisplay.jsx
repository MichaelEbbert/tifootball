import { useState, useEffect, useRef } from 'react'
import { initializeGame, executePlay, isGameOver } from '../utils/gameEngine'
import { formatGameClock } from '../utils/gameSimulation'
import logger from '../utils/logger'
import './GameDisplay.css'

function GameDisplay({ game, pauseDuration, onPauseDurationChange, onNextGame, onDone, savedGameState, saveKey }) {
  const [gameState, setGameState] = useState(null)
  const [currentPlay, setCurrentPlay] = useState(null)
  const [prePlayState, setPrePlayState] = useState(null) // Snapshot before play executes
  const [isSimulating, setIsSimulating] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [showSummary, setShowSummary] = useState(false)

  // Animation states
  const [animationPhase, setAnimationPhase] = useState('idle') // 'idle', 'running', 'result', 'touchdown'
  const [runningText, setRunningText] = useState('')
  const animationRef = useRef(null)
  const isPausedRef = useRef(isPaused)
  const gameStateRef = useRef(gameState)  // Track current gameState to avoid closure issues

  // Debug panel state
  const [debugMode, setDebugMode] = useState(false)
  const [debugPrompt, setDebugPrompt] = useState(false)
  const [debugPassword, setDebugPassword] = useState('')
  const [debugOpen, setDebugOpen] = useState(false)
  const [debugForm, setDebugForm] = useState({
    fieldSide: 'own',  // 'own' or 'opp'
    yardline: 35,
    possession: 'home',
    down: 1,
    distance: 10,
    quarter: 1,
    clockMin: 15,
    clockSec: 0,
    nextPlay: 'auto'  // 'auto', 'run', 'short', 'medium'
  })

  // Debug password hash (SHA-256 of the password)
  const DEBUG_HASH = '715773c66c9347749f5921bdce502d7de7081e19d07c7b40a70f19665700d919'

  // Hash function using Web Crypto API
  async function hashPassword(password) {
    const encoder = new TextEncoder()
    const data = encoder.encode(password)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  async function checkDebugPassword() {
    const hash = await hashPassword(debugPassword)
    if (hash === DEBUG_HASH) {
      setDebugMode(true)
      setDebugPrompt(false)
      setDebugPassword('')
      logger.info('Debug mode enabled')
    } else {
      alert('Invalid password')
      setDebugPassword('')
    }
  }

  // Go to game summary and save results
  function goToSummary() {
    if (!gameState) return

    // Save game results (placeholder - will be implemented later)
    saveGameResults(gameState)

    setShowSummary(true)
    logger.info('Viewing game summary')
  }

  // Convert gameState stats to database format
  function statsToDbFormat(teamStats, teamId) {
    return {
      team_id: teamId,
      rushing_attempts: teamStats.rushingAttempts || 0,
      rushing_yards: teamStats.rushingYards || 0,
      rushing_touchdowns: teamStats.rushingTouchdowns || 0,
      rushing_fumbles: teamStats.rushingFumbles || 0,
      rushing_fumbles_lost: teamStats.rushingFumblesLost || 0,
      pass_attempts: teamStats.passAttempts || 0,
      pass_completions: teamStats.passCompletions || 0,
      pass_yards: teamStats.passYards || 0,
      pass_rac_yards: teamStats.passRacYards || 0,
      pass_touchdowns: teamStats.passTouchdowns || 0,
      pass_interceptions: teamStats.passInterceptions || 0,
      sacks: teamStats.sacks || 0,
      sack_yards_lost: teamStats.sackYardsLost || 0,
      sack_fumbles: teamStats.sackFumbles || 0,
      sack_fumbles_lost: teamStats.sackFumblesLost || 0,
      rec_fumbles: teamStats.recFumbles || 0,
      rec_fumbles_lost: teamStats.recFumblesLost || 0,
      first_downs: teamStats.firstDowns || 0,
      third_down_attempts: teamStats.thirdDownAttempts || 0,
      third_down_conversions: teamStats.thirdDownConversions || 0,
      fourth_down_attempts: teamStats.fourthDownAttempts || 0,
      fourth_down_conversions: teamStats.fourthDownConversions || 0,
      xp_attempted: teamStats.xpAttempted || 0,
      xp_made: teamStats.xpMade || 0,
      two_pt_attempted: teamStats.twoPtAttempted || 0,
      two_pt_made: teamStats.twoPtMade || 0,
      fg_attempted: teamStats.fgAttempted || 0,
      fg_made: teamStats.fgMade || 0,
      safeties_scored: teamStats.safetiesScored || 0,
      kick_return_attempts: teamStats.kickReturnAttempts || 0,
      kick_return_yards: teamStats.kickReturnYards || 0,
      kick_return_touchdowns: teamStats.kickReturnTouchdowns || 0,
      punt_return_attempts: teamStats.puntReturnAttempts || 0,
      punt_return_yards: teamStats.puntReturnYards || 0,
      punt_return_touchdowns: teamStats.puntReturnTouchdowns || 0,
      int_return_yards: teamStats.intReturnYards || 0,
      int_return_touchdowns: teamStats.intReturnTouchdowns || 0,
      time_of_possession: teamStats.timeOfPossession || 0,
      turnovers: (teamStats.rushingFumblesLost || 0) + (teamStats.recFumblesLost || 0) +
                 (teamStats.sackFumblesLost || 0) + (teamStats.passInterceptions || 0)
    }
  }

  // Save game results to database
  async function saveGameResults(finalState) {
    try {
      const gameData = {
        home_team: finalState.homeTeam.id,
        away_team: finalState.awayTeam.id,
        home_score: finalState.score.home,
        away_score: finalState.score.away,
        total_plays: finalState.playNumber,
        schedule_game_number: game.gameNumber,  // Link to schedule
        stats: [
          statsToDbFormat(finalState.homeStats, finalState.homeTeam.id),
          statsToDbFormat(finalState.awayStats, finalState.awayTeam.id)
        ],
        scoring_log: finalState.scoringLog || []
      }

      const response = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gameData)
      })

      if (response.ok) {
        const result = await response.json()
        logger.info(`Game saved to database with ID: ${result.id}`)
      } else {
        logger.error('Failed to save game:', response.statusText)
      }
    } catch (error) {
      logger.error('Error saving game:', error)
    }

    logger.info(`Final score: ${finalState.homeTeam.name} ${finalState.score.home} - ${finalState.awayTeam.name} ${finalState.score.away}`)
  }

  // Helper to get pause duration for special plays in fast mode
  // In fast mode (pauseDuration < 1), kickoffs, punts, and scores get 3 second pauses
  function getSpecialPause(playResult, isScore = false) {
    const isFastMode = pauseDuration < 1
    if (!isFastMode) {
      return pauseDuration * 1000
    }
    // In fast mode, special plays get 3 second pause
    if (isScore || playResult?.type === 'kickoff' || playResult?.type === 'punt' ||
        playResult?.touchdown || playResult?.fieldGoalGood) {
      return 3000
    }
    return pauseDuration * 1000
  }

  // Keep refs in sync with state
  useEffect(() => {
    isPausedRef.current = isPaused
  }, [isPaused])

  useEffect(() => {
    gameStateRef.current = gameState
  }, [gameState])

  useEffect(() => {
    // Initialize game when component mounts - either from saved state or fresh
    if (savedGameState) {
      setGameState(savedGameState)
      logger.info('Resumed saved game')
    } else {
      const initialState = initializeGame(game.homeTeam, game.awayTeam, false)
      setGameState(initialState)
      logger.info('Game started')
    }

    // Start simulation after brief delay
    setTimeout(() => {
      setIsSimulating(true)
    }, 1000)

    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current)
      }
    }
  }, [game, savedGameState])

  // Auto-save game state to localStorage whenever it changes
  useEffect(() => {
    if (gameState && saveKey) {
      if (isGameOver(gameState)) {
        // Game is over - clear the save so there's nothing to resume
        localStorage.removeItem(saveKey)
      } else {
        const saveData = {
          game,
          gameState,
          savedAt: Date.now()
        }
        localStorage.setItem(saveKey, JSON.stringify(saveData))
      }
    }
  }, [gameState, game, saveKey])

  // Note: We no longer cancel animations when paused - the animation loop
  // polls isPausedRef and waits until resumed

  useEffect(() => {
    if (!isSimulating || !gameState || isGameOver(gameState) || isPaused || animationPhase !== 'idle') {
      if (gameState && isGameOver(gameState)) {
        logger.info('Game complete!')
        // Don't auto-return - let user choose via buttons
      }
      return
    }

    // Execute next play after pause
    const timer = setTimeout(() => {
      // Capture pre-play state for display during animation
      const prePlay = {
        down: gameState.down,
        distance: gameState.distance,
        yardline: gameState.yardline,
        playNumber: gameState.playNumber + 1 // Will be incremented by executePlay
      }
      setPrePlayState(prePlay)

      const playResult = executePlay(gameState)
      setCurrentPlay(playResult)

      // If it's a run with steps, animate it
      if (playResult.type === 'run' && playResult.steps && playResult.steps.length > 0) {
        animateRunningPlay(playResult, gameState)
      } else if (playResult.type === 'pass' && playResult.complete && playResult.racSteps && playResult.racSteps.length > 0) {
        // Completed pass with run after catch - animate it
        animatePassPlay(playResult, gameState)
      } else if (playResult.type === 'kickoff' && playResult.steps && playResult.steps.length > 0) {
        // Kickoff return with steps - animate it
        animateKickoffReturn(playResult, gameState)
      } else if (playResult.type === 'punt' && playResult.returnSteps && playResult.returnSteps.length > 0) {
        // Punt return with steps - animate it
        animatePuntReturn(playResult, gameState)
      } else {
        // Non-running play or no steps, show result directly
        // Deep copy to ensure React sees the change
        // Preserve user settings (rotationMode) from current state in case user toggled mid-play
        const newState = JSON.parse(JSON.stringify(gameState))
        if (gameStateRef.current) {
          newState.rotationMode = gameStateRef.current.rotationMode
          newState.rotationIndex = gameStateRef.current.rotationIndex
        }
        setGameState(newState)
        setAnimationPhase('result')

        // After showing result, return to idle and clear prePlayState
        const finishNonRunPlay = () => {
          if (isPausedRef.current) {
            animationRef.current = setTimeout(finishNonRunPlay, 100)
            return
          }
          setPrePlayState(null)
          setCurrentPlay(null)
          setAnimationPhase('idle')
        }
        animationRef.current = setTimeout(finishNonRunPlay, getSpecialPause(playResult))
      }
    }, pauseDuration * 1000)

    return () => clearTimeout(timer)
  }, [isSimulating, gameState, pauseDuration, isPaused, animationPhase])

  function animateRunningPlay(playResult, mutatedGameState) {
    setAnimationPhase('running')
    const steps = playResult.steps
    let stepIndex = 0

    // Animation speed: 0.5 second per yard, or 50ms in fast mode
    const stepDelay = pauseDuration < 1 ? 50 : 500

    function showNextStep() {
      // Check if paused - keep polling instead of exiting
      if (isPausedRef.current) {
        animationRef.current = setTimeout(showNextStep, 100) // Poll every 100ms
        return
      }

      if (stepIndex < steps.length) {
        const yardsText = steps.slice(0, stepIndex + 1).map(y => `...${y}`).join(' ')
        setRunningText(`Running ${yardsText}`)
        stepIndex++
        animationRef.current = setTimeout(showNextStep, stepDelay)
      } else {
        // Animation complete - create deep copy of mutated state to trigger React update
        // Preserve user settings (rotationMode) from current state in case user toggled mid-play
        const newState = JSON.parse(JSON.stringify(mutatedGameState))
        if (gameStateRef.current) {
          newState.rotationMode = gameStateRef.current.rotationMode
          newState.rotationIndex = gameStateRef.current.rotationIndex
        }
        setGameState(newState)
        setAnimationPhase('result')

        // Check for touchdown
        if (playResult.touchdown) {
          const showTouchdown = () => {
            if (isPausedRef.current) {
              animationRef.current = setTimeout(showTouchdown, 100)
              return
            }
            setAnimationPhase('touchdown')
            // Touchdown pause is 5x normal, or 3s minimum in fast mode
            const tdPause = pauseDuration < 1 ? 3000 : pauseDuration * 5 * 1000
            const finishTouchdown = () => {
              if (isPausedRef.current) {
                animationRef.current = setTimeout(finishTouchdown, 100)
                return
              }
              setPrePlayState(null)
              setCurrentPlay(null)
              setAnimationPhase('idle')
            }
            animationRef.current = setTimeout(finishTouchdown, tdPause)
          }
          animationRef.current = setTimeout(showTouchdown, 500)
        } else {
          // Normal pause after result, then clear prePlayState
          const finishPlay = () => {
            if (isPausedRef.current) {
              animationRef.current = setTimeout(finishPlay, 100)
              return
            }
            setPrePlayState(null)
            setCurrentPlay(null)
            setAnimationPhase('idle')
          }
          animationRef.current = setTimeout(finishPlay, pauseDuration * 1000)
        }
      }
    }

    // Start with "Running..."
    setRunningText('Running...')
    animationRef.current = setTimeout(showNextStep, stepDelay)
  }

  function animatePassPlay(playResult, mutatedGameState) {
    setAnimationPhase('running')
    const steps = playResult.racSteps
    const passType = playResult.passType || 'Short'
    const passTypeCap = passType.charAt(0).toUpperCase() + passType.slice(1)
    let stepIndex = 0

    // Animation speed: 0.5 second per yard, or 50ms in fast mode
    const stepDelay = pauseDuration < 1 ? 50 : 500

    function showNextStep() {
      // Check if paused - keep polling instead of exiting
      if (isPausedRef.current) {
        animationRef.current = setTimeout(showNextStep, 100)
        return
      }

      if (stepIndex < steps.length) {
        const yardsText = steps.slice(0, stepIndex + 1).map(y => `...${y}`).join(' ')
        setRunningText(`${passTypeCap} pass complete for ${playResult.airYards} yards, running ${yardsText}`)
        stepIndex++
        animationRef.current = setTimeout(showNextStep, stepDelay)
      } else {
        // Animation complete
        const newState = JSON.parse(JSON.stringify(mutatedGameState))
        if (gameStateRef.current) {
          newState.rotationMode = gameStateRef.current.rotationMode
          newState.rotationIndex = gameStateRef.current.rotationIndex
        }
        setGameState(newState)
        setRunningText(`${passTypeCap} pass complete for ${playResult.airYards} yards, running ${steps.map(y => `...${y}`).join(' ')} Tackled for a gain of ${playResult.yards} yards`)
        setAnimationPhase('result')

        // Check for touchdown
        if (playResult.touchdown) {
          const showTouchdown = () => {
            if (isPausedRef.current) {
              animationRef.current = setTimeout(showTouchdown, 100)
              return
            }
            setAnimationPhase('touchdown')
            // Touchdown pause is 5x normal, or 3s minimum in fast mode
            const tdPause = pauseDuration < 1 ? 3000 : pauseDuration * 5 * 1000
            const finishTouchdown = () => {
              if (isPausedRef.current) {
                animationRef.current = setTimeout(finishTouchdown, 100)
                return
              }
              setPrePlayState(null)
              setCurrentPlay(null)
              setAnimationPhase('idle')
            }
            animationRef.current = setTimeout(finishTouchdown, tdPause)
          }
          animationRef.current = setTimeout(showTouchdown, 500)
        } else {
          const finishPlay = () => {
            if (isPausedRef.current) {
              animationRef.current = setTimeout(finishPlay, 100)
              return
            }
            setPrePlayState(null)
            setCurrentPlay(null)
            setAnimationPhase('idle')
          }
          animationRef.current = setTimeout(finishPlay, pauseDuration * 1000)
        }
      }
    }

    // Start with pass complete message
    setRunningText(`${passTypeCap} pass complete for ${playResult.airYards} yards, running...`)
    animationRef.current = setTimeout(showNextStep, stepDelay)
  }

  function animateKickoffReturn(playResult, mutatedGameState) {
    setAnimationPhase('running')
    const steps = playResult.steps
    const startYardline = playResult.startYardline
    const kickingTeamName = playResult.kickingTeamName
    let stepIndex = 0

    // Animation speed: 0.5 second per yard, or 50ms in fast mode
    const stepDelay = pauseDuration < 1 ? 50 : 500

    function showNextStep() {
      // Check if paused - keep polling instead of exiting
      if (isPausedRef.current) {
        animationRef.current = setTimeout(showNextStep, 100)
        return
      }

      if (stepIndex < steps.length) {
        const yardsText = steps.slice(0, stepIndex + 1).map(y => `...${y}`).join(' ')
        setRunningText(`Kickoff fielded at the ${startYardline}. Running ${yardsText}`)
        stepIndex++
        animationRef.current = setTimeout(showNextStep, stepDelay)
      } else {
        // Animation complete
        const newState = JSON.parse(JSON.stringify(mutatedGameState))
        if (gameStateRef.current) {
          newState.rotationMode = gameStateRef.current.rotationMode
          newState.rotationIndex = gameStateRef.current.rotationIndex
        }
        setGameState(newState)
        setAnimationPhase('result')

        // Check for touchdown
        if (playResult.touchdown) {
          const showTouchdown = () => {
            if (isPausedRef.current) {
              animationRef.current = setTimeout(showTouchdown, 100)
              return
            }
            setAnimationPhase('touchdown')
            // Touchdown pause is 5x normal, or 3s minimum in fast mode
            const tdPause = pauseDuration < 1 ? 3000 : pauseDuration * 5 * 1000
            const finishTouchdown = () => {
              if (isPausedRef.current) {
                animationRef.current = setTimeout(finishTouchdown, 100)
                return
              }
              setPrePlayState(null)
              setCurrentPlay(null)
              setAnimationPhase('idle')
            }
            animationRef.current = setTimeout(finishTouchdown, tdPause)
          }
          animationRef.current = setTimeout(showTouchdown, 500)
        } else {
          // Kickoff gets 3s pause in fast mode
          const kickoffPause = pauseDuration < 1 ? 3000 : pauseDuration * 1000
          const finishPlay = () => {
            if (isPausedRef.current) {
              animationRef.current = setTimeout(finishPlay, 100)
              return
            }
            setPrePlayState(null)
            setCurrentPlay(null)
            setAnimationPhase('idle')
          }
          animationRef.current = setTimeout(finishPlay, kickoffPause)
        }
      }
    }

    // Start by showing kicking team, then show fielded message
    // Use 3s pause in fast mode for kickoff
    const kickoffStartPause = pauseDuration < 1 ? 3000 : pauseDuration * 1000
    setRunningText(`${kickingTeamName} kicking off...`)
    const startReturn = () => {
      if (isPausedRef.current) {
        animationRef.current = setTimeout(startReturn, 100)
        return
      }
      setRunningText(`Kickoff fielded at the ${startYardline}. Running...`)
      animationRef.current = setTimeout(showNextStep, stepDelay)
    }
    animationRef.current = setTimeout(startReturn, kickoffStartPause)
  }

  function animatePuntReturn(playResult, mutatedGameState) {
    setAnimationPhase('running')
    const steps = playResult.returnSteps
    const puntYards = playResult.yards
    const catchYardline = playResult.catchYardline
    let stepIndex = 0

    // Animation speed: 0.5 second per yard, or 50ms in fast mode
    const stepDelay = pauseDuration < 1 ? 50 : 500

    function showNextStep() {
      // Check if paused - keep polling instead of exiting
      if (isPausedRef.current) {
        animationRef.current = setTimeout(showNextStep, 100)
        return
      }

      if (stepIndex < steps.length) {
        const yardsText = steps.slice(0, stepIndex + 1).map(y => `...${y}`).join(' ')
        setRunningText(`Punt ${puntYards} yards, fielded at the ${catchYardline}. Running ${yardsText}`)
        stepIndex++
        animationRef.current = setTimeout(showNextStep, stepDelay)
      } else {
        // Animation complete
        const newState = JSON.parse(JSON.stringify(mutatedGameState))
        if (gameStateRef.current) {
          newState.rotationMode = gameStateRef.current.rotationMode
          newState.rotationIndex = gameStateRef.current.rotationIndex
        }
        setGameState(newState)
        setAnimationPhase('result')

        // Check for touchdown
        if (playResult.touchdown) {
          const showTouchdown = () => {
            if (isPausedRef.current) {
              animationRef.current = setTimeout(showTouchdown, 100)
              return
            }
            setAnimationPhase('touchdown')
            // Touchdown pause is 5x normal, or 3s minimum in fast mode
            const tdPause = pauseDuration < 1 ? 3000 : pauseDuration * 5 * 1000
            const finishTouchdown = () => {
              if (isPausedRef.current) {
                animationRef.current = setTimeout(finishTouchdown, 100)
                return
              }
              setPrePlayState(null)
              setCurrentPlay(null)
              setAnimationPhase('idle')
            }
            animationRef.current = setTimeout(finishTouchdown, tdPause)
          }
          animationRef.current = setTimeout(showTouchdown, 500)
        } else {
          // Punt gets 3s pause in fast mode
          const puntPause = pauseDuration < 1 ? 3000 : pauseDuration * 1000
          const finishPlay = () => {
            if (isPausedRef.current) {
              animationRef.current = setTimeout(finishPlay, 100)
              return
            }
            setPrePlayState(null)
            setCurrentPlay(null)
            setAnimationPhase('idle')
          }
          animationRef.current = setTimeout(finishPlay, puntPause)
        }
      }
    }

    // Start with punt fielded message
    setRunningText(`Punt ${puntYards} yards, fielded at the ${catchYardline}. Running...`)
    animationRef.current = setTimeout(showNextStep, stepDelay)
  }

  // Apply debug settings to game state
  function applyDebugSettings() {
    if (!gameState) return

    const newState = JSON.parse(JSON.stringify(gameState))

    // Convert field position: 'own 35' = 35, 'opp 35' = 65
    if (debugForm.fieldSide === 'own') {
      newState.yardline = debugForm.yardline
    } else {
      newState.yardline = 100 - debugForm.yardline
    }

    newState.possession = debugForm.possession
    newState.down = debugForm.down
    newState.distance = debugForm.distance
    newState.quarter = debugForm.quarter
    newState.clock = debugForm.clockMin * 60 + debugForm.clockSec

    // Set forced play type for next play (if not 'auto')
    if (debugForm.nextPlay !== 'auto') {
      newState.forcedPlayType = debugForm.nextPlay
    } else {
      delete newState.forcedPlayType
    }

    setGameState(newState)
    setCurrentPlay(null)
    setPrePlayState(null)
    setAnimationPhase('idle')
    setIsPaused(true)
    setDebugOpen(false)

    logger.info(`Debug: Set game state - Q${newState.quarter} ${formatGameClock(newState.clock)}, ${newState.possession} ball, ${newState.down}&${newState.distance} at ${newState.yardline}`)
  }

  if (!gameState) {
    return <div className="game-display">Loading game...</div>
  }

  // Game Summary Screen
  if (showSummary) {
    return (
      <div className="game-display">
        <div className="game-summary">
          <h1>Game Summary</h1>

          {/* Final Score */}
          <div className="game-over">
            <h2>FINAL</h2>
            <div className="final-score">
              {gameState.homeTeam.name} {gameState.score.home} - {gameState.awayTeam.name} {gameState.score.away}
            </div>
          </div>

          {/* Scoring Summary */}
          {gameState.scoringLog && gameState.scoringLog.length > 0 && (
            <div className="scoring-summary">
              <h3>Scoring Summary</h3>
              <div className="scoring-log">
                {gameState.scoringLog.map((entry, index) => (
                  <div key={index} className="scoring-entry">
                    <span className="score-quarter">Q{entry.quarter}</span>
                    <span className="score-time">{formatGameClock(entry.time_remaining)}</span>
                    <span className="score-team">{entry.team_abbr}</span>
                    <span className="score-desc">{entry.description}</span>
                    <span className="score-total">{entry.home_score}-{entry.away_score}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="stats-container">
            <div className="team-stats">
              <h3>{gameState.homeTeam.name}</h3>
              <div className="stat-line">
                <span>Rushing:</span>
                <span>{gameState.homeStats.rushingAttempts} car, {gameState.homeStats.rushingYards} yds, {gameState.homeStats.rushingTouchdowns || 0} TD</span>
              </div>
              <div className="stat-line">
                <span>Fumbles:</span>
                <span>{(gameState.homeStats.rushingFumbles || 0) + (gameState.homeStats.recFumbles || 0) + (gameState.homeStats.sackFumbles || 0)} fum, {(gameState.homeStats.rushingFumblesLost || 0) + (gameState.homeStats.recFumblesLost || 0) + (gameState.homeStats.sackFumblesLost || 0)} lost</span>
              </div>
              <div className="stat-line">
                <span>Passing:</span>
                <span>{gameState.homeStats.passAttempts} att, {gameState.homeStats.passCompletions} cmp, {gameState.homeStats.passYards} yds, {gameState.homeStats.passRacYards} rac, {gameState.homeStats.passInterceptions} int, {gameState.homeStats.passTouchdowns} td</span>
              </div>
              <div className="stat-line">
                <span>Sacked:</span>
                <span>{gameState.homeStats.sacks} for {gameState.homeStats.sackYardsLost} yards</span>
              </div>
              <div className="stat-line">
                <span>First Downs:</span>
                <span>{gameState.homeStats.firstDowns}</span>
              </div>
              <div className="stat-line">
                <span>3rd Down:</span>
                <span>{gameState.homeStats.thirdDownConversions}/{gameState.homeStats.thirdDownAttempts}</span>
              </div>
              <div className="stat-line">
                <span>4th Down:</span>
                <span>{gameState.homeStats.fourthDownConversions}/{gameState.homeStats.fourthDownAttempts}</span>
              </div>
              <div className="stat-line">
                <span>XP:</span>
                <span>{gameState.homeStats.xpMade}/{gameState.homeStats.xpAttempted}</span>
              </div>
              <div className="stat-line">
                <span>2-PT:</span>
                <span>{gameState.homeStats.twoPtMade || 0}/{gameState.homeStats.twoPtAttempted || 0}</span>
              </div>
              <div className="stat-line">
                <span>Field Goals:</span>
                <span>{gameState.homeStats.fgMade || 0}/{gameState.homeStats.fgAttempted || 0}</span>
              </div>
              <div className="stat-line">
                <span>Kick Returns:</span>
                <span>{gameState.homeStats.kickReturnAttempts || 0} ret, {gameState.homeStats.kickReturnYards || 0} yds</span>
              </div>
              <div className="stat-line">
                <span>Punt Returns:</span>
                <span>{gameState.homeStats.puntReturnAttempts || 0} ret, {gameState.homeStats.puntReturnYards || 0} yds</span>
              </div>
              <div className="stat-line">
                <span>Safeties:</span>
                <span>{gameState.homeStats.safetiesScored || 0}</span>
              </div>
              <div className="stat-line">
                <span>Time of Possession:</span>
                <span>{formatGameClock(gameState.homeStats.timeOfPossession)}</span>
              </div>
            </div>

            <div className="team-stats">
              <h3>{gameState.awayTeam.name}</h3>
              <div className="stat-line">
                <span>Rushing:</span>
                <span>{gameState.awayStats.rushingAttempts} car, {gameState.awayStats.rushingYards} yds, {gameState.awayStats.rushingTouchdowns || 0} TD</span>
              </div>
              <div className="stat-line">
                <span>Fumbles:</span>
                <span>{(gameState.awayStats.rushingFumbles || 0) + (gameState.awayStats.recFumbles || 0) + (gameState.awayStats.sackFumbles || 0)} fum, {(gameState.awayStats.rushingFumblesLost || 0) + (gameState.awayStats.recFumblesLost || 0) + (gameState.awayStats.sackFumblesLost || 0)} lost</span>
              </div>
              <div className="stat-line">
                <span>Passing:</span>
                <span>{gameState.awayStats.passAttempts} att, {gameState.awayStats.passCompletions} cmp, {gameState.awayStats.passYards} yds, {gameState.awayStats.passRacYards} rac, {gameState.awayStats.passInterceptions} int, {gameState.awayStats.passTouchdowns} td</span>
              </div>
              <div className="stat-line">
                <span>Sacked:</span>
                <span>{gameState.awayStats.sacks} for {gameState.awayStats.sackYardsLost} yards</span>
              </div>
              <div className="stat-line">
                <span>First Downs:</span>
                <span>{gameState.awayStats.firstDowns}</span>
              </div>
              <div className="stat-line">
                <span>3rd Down:</span>
                <span>{gameState.awayStats.thirdDownConversions}/{gameState.awayStats.thirdDownAttempts}</span>
              </div>
              <div className="stat-line">
                <span>4th Down:</span>
                <span>{gameState.awayStats.fourthDownConversions}/{gameState.awayStats.fourthDownAttempts}</span>
              </div>
              <div className="stat-line">
                <span>XP:</span>
                <span>{gameState.awayStats.xpMade}/{gameState.awayStats.xpAttempted}</span>
              </div>
              <div className="stat-line">
                <span>2-PT:</span>
                <span>{gameState.awayStats.twoPtMade || 0}/{gameState.awayStats.twoPtAttempted || 0}</span>
              </div>
              <div className="stat-line">
                <span>Field Goals:</span>
                <span>{gameState.awayStats.fgMade || 0}/{gameState.awayStats.fgAttempted || 0}</span>
              </div>
              <div className="stat-line">
                <span>Kick Returns:</span>
                <span>{gameState.awayStats.kickReturnAttempts || 0} ret, {gameState.awayStats.kickReturnYards || 0} yds</span>
              </div>
              <div className="stat-line">
                <span>Punt Returns:</span>
                <span>{gameState.awayStats.puntReturnAttempts || 0} ret, {gameState.awayStats.puntReturnYards || 0} yds</span>
              </div>
              <div className="stat-line">
                <span>Safeties:</span>
                <span>{gameState.awayStats.safetiesScored || 0}</span>
              </div>
              <div className="stat-line">
                <span>Time of Possession:</span>
                <span>{formatGameClock(gameState.awayStats.timeOfPossession)}</span>
              </div>
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="summary-buttons">
            <button className="next-game-btn" onClick={() => onNextGame && onNextGame(gameState)}>
              Continue to Next Game
            </button>
            <button className="done-btn" onClick={() => onDone && onDone(gameState)}>
              Done for Now
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Format down and distance for display
  function formatDownDistance(down, distance) {
    const ordinals = ['', '1st', '2nd', '3rd', '4th']
    return `${ordinals[down]} & ${distance}`
  }

  // Get play type prefix for description
  function getPlayTypePrefix(play) {
    if (!play) return ''
    if (play.type === 'run') return 'Run: '
    if (play.type === 'pass') {
      const passType = play.passType || 'short'
      return `${passType.charAt(0).toUpperCase() + passType.slice(1)} Pass: `
    }
    return ''
  }

  // Determine what to show in play result area
  function getPlayDisplay() {
    const playNum = prePlayState?.playNumber || gameState.playNumber
    const down = prePlayState?.down || gameState.down
    const distance = prePlayState?.distance || gameState.distance
    const downDistStr = formatDownDistance(down, distance)

    // For kickoff plays, show kicking team instead of down/distance
    const isKickoff = currentPlay?.type === 'kickoff'

    if (animationPhase === 'running') {
      return (
        <div className="play-result">
          <div className="play-number">{isKickoff ? `Play #${playNum}, ${currentPlay.kickingTeamName} kicking off` : `Play #${playNum} (${downDistStr})`}</div>
          <div className="play-description running-animation">{runningText}</div>
        </div>
      )
    }

    if (animationPhase === 'touchdown') {
      const isSkipped = currentPlay?.conversionType === 'skipped'
      const is2Pt = currentPlay?.conversionType === '2pt'
      const playTypeText = currentPlay?.twoPtPlayType ? ` (${currentPlay.twoPtPlayType})` : ''
      const conversionText = isSkipped
        ? 'No XP needed - GAME OVER!'
        : is2Pt
        ? (currentPlay?.xpGood ? `2PT${playTypeText} Good!` : `2PT${playTypeText} No Good`)
        : (currentPlay?.xpGood ? 'XP Good!' : 'XP No Good')
      return (
        <div className="play-result touchdown-display">
          <div className="play-number">{isKickoff ? `Play #${playNum}, ${currentPlay.kickingTeamName} kicking off` : `Play #${playNum} (${downDistStr})`}</div>
          <div className="touchdown-text">TOUCHDOWN!</div>
          <div className="xp-result">
            {conversionText}
          </div>
          <div className="play-description">{getPlayTypePrefix(currentPlay)}{currentPlay?.description}</div>
        </div>
      )
    }

    if (animationPhase === 'result' && currentPlay) {
      return (
        <div className="play-result">
          <div className="play-number">{isKickoff ? `Play #${playNum}, ${currentPlay.kickingTeamName} kicking off` : `Play #${playNum} (${downDistStr})`}</div>
          <div className="play-description">{getPlayTypePrefix(currentPlay)}{currentPlay.description}</div>
          {currentPlay.turnover && <div className="turnover">TURNOVER!</div>}
        </div>
      )
    }

    // Idle state - show play number with down/distance but no action text
    if (animationPhase === 'idle') {
      return (
        <div className="play-result">
          <div className="play-number">Play #{gameState.playNumber + 1} ({formatDownDistance(gameState.down, gameState.distance)})</div>
          <div className="play-description">&nbsp;</div>
        </div>
      )
    }

    return null
  }

  return (
    <div className="game-display">
      {/* Game Controls */}
      <div className="game-controls">
        <button
          className={`pause-btn ${isPaused ? 'paused' : ''}`}
          onClick={() => setIsPaused(!isPaused)}
        >
          {isPaused ? 'Resume' : 'Pause'}
        </button>
        <div className="speed-control">
          <label>Speed:</label>
          {[1, 2, 3, 4, 5].map(seconds => (
            <label key={seconds} className="radio-option">
              <input
                type="radio"
                name="pause"
                value={seconds}
                checked={pauseDuration === seconds}
                onChange={(e) => onPauseDurationChange(Number(e.target.value))}
              />
              {seconds}s
            </label>
          ))}
          <label className="radio-option fast-option">
            <input
              type="radio"
              name="pause"
              value={0.05}
              checked={pauseDuration === 0.05}
              onChange={(e) => onPauseDurationChange(Number(e.target.value))}
            />
            I'm going fast again!
          </label>
        </div>
        <button
          className={`rotation-btn ${gameState?.rotationMode ? 'active' : ''}`}
          onClick={() => {
            if (gameState) {
              const newState = JSON.parse(JSON.stringify(gameState))
              newState.rotationMode = !newState.rotationMode
              if (newState.rotationMode) {
                newState.rotationIndex = 0  // Reset rotation when enabling
              }
              setGameState(newState)
            }
          }}
          title="Rotation Mode: 3 runs, 3 short passes, 3 medium passes, repeat"
        >
          {gameState?.rotationMode ? '🔄 Rotation ON' : '🔄 Rotation'}
        </button>
        {debugMode ? (
          <button
            className="debug-toggle-btn"
            onClick={() => setDebugOpen(!debugOpen)}
          >
            {debugOpen ? 'Close Debug' : 'Debug'}
          </button>
        ) : (
          <button
            className="debug-enter-btn"
            onClick={() => setDebugPrompt(true)}
            title="Enter Debug Mode"
          >
            🔧
          </button>
        )}
      </div>

      {/* Debug Password Prompt */}
      {debugPrompt && (
        <div className="debug-prompt-overlay">
          <div className="debug-prompt">
            <h3>Enter Debug Mode</h3>
            <input
              type="password"
              value={debugPassword}
              onChange={(e) => setDebugPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && checkDebugPassword()}
              placeholder="Password"
              autoFocus
            />
            <div className="debug-prompt-buttons">
              <button onClick={checkDebugPassword}>Enter</button>
              <button onClick={() => { setDebugPrompt(false); setDebugPassword(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Debug Panel */}
      {debugOpen && (
        <div className="debug-panel">
          <h3>Test Scenario</h3>
          <div className="debug-form">
            <div className="debug-row">
              <label>Field Position:</label>
              <select
                value={debugForm.fieldSide}
                onChange={(e) => setDebugForm({...debugForm, fieldSide: e.target.value})}
              >
                <option value="own">OWN</option>
                <option value="opp">OPP</option>
              </select>
              <input
                type="number"
                min="1"
                max="50"
                value={debugForm.yardline}
                onChange={(e) => setDebugForm({...debugForm, yardline: parseInt(e.target.value) || 1})}
              />
            </div>
            <div className="debug-row">
              <label>Possession:</label>
              <select
                value={debugForm.possession}
                onChange={(e) => setDebugForm({...debugForm, possession: e.target.value})}
              >
                <option value="home">{gameState?.homeTeam?.name || 'Home'}</option>
                <option value="away">{gameState?.awayTeam?.name || 'Away'}</option>
              </select>
            </div>
            <div className="debug-row">
              <label>Down & Distance:</label>
              <select
                value={debugForm.down}
                onChange={(e) => setDebugForm({...debugForm, down: parseInt(e.target.value)})}
              >
                <option value={1}>1st</option>
                <option value={2}>2nd</option>
                <option value={3}>3rd</option>
                <option value={4}>4th</option>
              </select>
              <span>&</span>
              <input
                type="number"
                min="1"
                max="99"
                value={debugForm.distance}
                onChange={(e) => setDebugForm({...debugForm, distance: parseInt(e.target.value) || 1})}
              />
            </div>
            <div className="debug-row">
              <label>Quarter:</label>
              <select
                value={debugForm.quarter}
                onChange={(e) => setDebugForm({...debugForm, quarter: parseInt(e.target.value)})}
              >
                <option value={1}>Q1</option>
                <option value={2}>Q2</option>
                <option value={3}>Q3</option>
                <option value={4}>Q4</option>
              </select>
            </div>
            <div className="debug-row">
              <label>Clock:</label>
              <input
                type="number"
                min="0"
                max="15"
                value={debugForm.clockMin}
                onChange={(e) => setDebugForm({...debugForm, clockMin: parseInt(e.target.value) || 0})}
              />
              <span>:</span>
              <input
                type="number"
                min="0"
                max="59"
                value={debugForm.clockSec}
                onChange={(e) => setDebugForm({...debugForm, clockSec: parseInt(e.target.value) || 0})}
              />
            </div>
            <div className="debug-row">
              <label>Next Play:</label>
              <select
                value={debugForm.nextPlay}
                onChange={(e) => setDebugForm({...debugForm, nextPlay: e.target.value})}
              >
                <option value="auto">Auto (normal logic)</option>
                <option value="run">Run</option>
                <option value="short">Short Pass (0-9 air)</option>
                <option value="medium">Medium Pass (10-19 air)</option>
                <option value="long">Long Pass (20+ air)</option>
              </select>
            </div>
            <button className="debug-apply-btn" onClick={applyDebugSettings}>
              Apply & Pause
            </button>
          </div>
        </div>
      )}

      {/* Scoreboard */}
      <div className="scoreboard">
        <div className="score">
          <div className="team-score">
            <span className="team-name">{gameState.homeTeam.city} {gameState.homeTeam.name}</span>
            <span className="points">{gameState.score.home}</span>
          </div>
          <div className="team-score">
            <span className="team-name">{gameState.awayTeam.city} {gameState.awayTeam.name}</span>
            <span className="points">{gameState.score.away}</span>
          </div>
        </div>
        <div className="game-info">
          <span>Q{gameState.quarter}</span>
          <span>{formatGameClock(gameState.clock)}</span>
        </div>
      </div>

      {/* Field Position - show pre-play state during animation, otherwise current state */}
      <div className="field-position">
        <div className="possession-indicator">
          {gameState.possession === 'home' ? '▶' : '◀'} {gameState.possession === 'home' ? gameState.homeTeam.name : gameState.awayTeam.name}
        </div>
        <div className="down-distance">
          {prePlayState && animationPhase !== 'idle' ? (
            // During play animation, show where we started
            <>{prePlayState.down}{getOrdinal(prePlayState.down)} & {prePlayState.distance} at {formatFieldPosition(prePlayState.yardline)}</>
          ) : (
            // When idle, show current state
            <>{gameState.down}{getOrdinal(gameState.down)} & {gameState.distance} at {formatFieldPosition(gameState.yardline)}</>
          )}
        </div>
      </div>

      {/* Current Play Result */}
      {getPlayDisplay()}

      {/* Game Over */}
      {isGameOver(gameState) && (
        <div className="game-over">
          <h2>GAME OVER</h2>
          <div className="final-score">
            {gameState.homeTeam.name} {gameState.score.home} - {gameState.awayTeam.name} {gameState.score.away}
          </div>
          <div className="game-over-buttons">
            <button className="next-game-btn" onClick={goToSummary}>
              Go to Game Summary
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="stats-container">
        <div className="team-stats">
          <h3>{gameState.homeTeam.name}</h3>
          <div className="stat-line">
            <span>Rushing:</span>
            <span>{gameState.homeStats.rushingAttempts} car, {gameState.homeStats.rushingYards} yds, {gameState.homeStats.rushingFumbles} fum, {gameState.homeStats.rushingFumblesLost} lost</span>
          </div>
          <div className="stat-line">
            <span>Passing:</span>
            <span>{gameState.homeStats.passAttempts} att, {gameState.homeStats.passCompletions} cmp, {gameState.homeStats.passYards} yds, {gameState.homeStats.passRacYards} rac, {gameState.homeStats.passInterceptions} int, {gameState.homeStats.passTouchdowns} td</span>
          </div>
          <div className="stat-line">
            <span>Sacked:</span>
            <span>{gameState.homeStats.sacks} for {gameState.homeStats.sackYardsLost} yards</span>
          </div>
          <div className="stat-line">
            <span>First Downs:</span>
            <span>{gameState.homeStats.firstDowns}</span>
          </div>
          <div className="stat-line">
            <span>3rd Down:</span>
            <span>{gameState.homeStats.thirdDownConversions}/{gameState.homeStats.thirdDownAttempts}</span>
          </div>
          <div className="stat-line">
            <span>4th Down:</span>
            <span>{gameState.homeStats.fourthDownConversions}/{gameState.homeStats.fourthDownAttempts}</span>
          </div>
          <div className="stat-line">
            <span>XP:</span>
            <span>{gameState.homeStats.xpMade}/{gameState.homeStats.xpAttempted}</span>
          </div>
          <div className="stat-line">
            <span>2-PT:</span>
            <span>{gameState.homeStats.twoPtMade || 0}/{gameState.homeStats.twoPtAttempted || 0}</span>
          </div>
          {(gameState.homeStats.kickReturnAttempts > 0) && (
            <div className="stat-line">
              <span>Kick Returns:</span>
              <span>{gameState.homeStats.kickReturnAttempts} ret, {gameState.homeStats.kickReturnYards} yds</span>
            </div>
          )}
          {(gameState.homeStats.safetiesScored > 0) && (
            <div className="stat-line">
              <span>Safeties:</span>
              <span>{gameState.homeStats.safetiesScored}</span>
            </div>
          )}
          <div className="stat-line">
            <span>Time of Possession:</span>
            <span>{formatGameClock(gameState.homeStats.timeOfPossession)}</span>
          </div>
        </div>

        <div className="team-stats">
          <h3>{gameState.awayTeam.name}</h3>
          <div className="stat-line">
            <span>Rushing:</span>
            <span>{gameState.awayStats.rushingAttempts} car, {gameState.awayStats.rushingYards} yds, {gameState.awayStats.rushingFumbles} fum, {gameState.awayStats.rushingFumblesLost} lost</span>
          </div>
          <div className="stat-line">
            <span>Passing:</span>
            <span>{gameState.awayStats.passAttempts} att, {gameState.awayStats.passCompletions} cmp, {gameState.awayStats.passYards} yds, {gameState.awayStats.passRacYards} rac, {gameState.awayStats.passInterceptions} int, {gameState.awayStats.passTouchdowns} td</span>
          </div>
          <div className="stat-line">
            <span>Sacked:</span>
            <span>{gameState.awayStats.sacks} for {gameState.awayStats.sackYardsLost} yards</span>
          </div>
          <div className="stat-line">
            <span>First Downs:</span>
            <span>{gameState.awayStats.firstDowns}</span>
          </div>
          <div className="stat-line">
            <span>3rd Down:</span>
            <span>{gameState.awayStats.thirdDownConversions}/{gameState.awayStats.thirdDownAttempts}</span>
          </div>
          <div className="stat-line">
            <span>4th Down:</span>
            <span>{gameState.awayStats.fourthDownConversions}/{gameState.awayStats.fourthDownAttempts}</span>
          </div>
          <div className="stat-line">
            <span>XP:</span>
            <span>{gameState.awayStats.xpMade}/{gameState.awayStats.xpAttempted}</span>
          </div>
          <div className="stat-line">
            <span>2-PT:</span>
            <span>{gameState.awayStats.twoPtMade || 0}/{gameState.awayStats.twoPtAttempted || 0}</span>
          </div>
          {(gameState.awayStats.kickReturnAttempts > 0) && (
            <div className="stat-line">
              <span>Kick Returns:</span>
              <span>{gameState.awayStats.kickReturnAttempts} ret, {gameState.awayStats.kickReturnYards} yds</span>
            </div>
          )}
          {(gameState.awayStats.safetiesScored > 0) && (
            <div className="stat-line">
              <span>Safeties:</span>
              <span>{gameState.awayStats.safetiesScored}</span>
            </div>
          )}
          <div className="stat-line">
            <span>Time of Possession:</span>
            <span>{formatGameClock(gameState.awayStats.timeOfPossession)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function getOrdinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return s[(v - 20) % 10] || s[v] || s[0]
}

function formatFieldPosition(yardline) {
  // yardline 0-50 is own territory, 51-100 is opponent territory
  if (yardline <= 50) {
    return `own ${yardline}`
  } else {
    return `OPP ${100 - yardline}`
  }
}

export default GameDisplay
