import { useState, useEffect, useRef } from 'react'
import { initializeGame, executePlay, isGameOver } from '../utils/gameEngine'
import { formatGameClock } from '../utils/gameSimulation'
import logger from '../utils/logger'
import './GameDisplay.css'

function GameDisplay({ game, pauseDuration, onPauseDurationChange, onGameComplete, savedGameState, saveKey }) {
  const [gameState, setGameState] = useState(null)
  const [currentPlay, setCurrentPlay] = useState(null)
  const [isSimulating, setIsSimulating] = useState(false)
  const [isPaused, setIsPaused] = useState(false)

  // Animation states
  const [animationPhase, setAnimationPhase] = useState('idle') // 'idle', 'running', 'result', 'touchdown'
  const [runningText, setRunningText] = useState('')
  const animationRef = useRef(null)

  useEffect(() => {
    // Initialize game when component mounts - either from saved state or fresh
    if (savedGameState) {
      setGameState(savedGameState)
      logger.info('Resumed saved game')
    } else {
      const initialState = initializeGame(game.homeTeam, game.awayTeam, true) // true = simplified mode
      setGameState(initialState)
      logger.info('Game started - Simplified mode: Runs only, no kicks, always go on 4th down')
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
    if (gameState && saveKey && !isGameOver(gameState)) {
      const saveData = {
        game,
        gameState,
        savedAt: Date.now()
      }
      localStorage.setItem(saveKey, JSON.stringify(saveData))
    }
  }, [gameState, game, saveKey])

  useEffect(() => {
    if (!isSimulating || !gameState || isGameOver(gameState) || isPaused || animationPhase !== 'idle') {
      if (gameState && isGameOver(gameState)) {
        logger.info('Game complete!')
        if (onGameComplete) {
          setTimeout(() => onGameComplete(gameState), 2000)
        }
      }
      return
    }

    // Execute next play after pause
    const timer = setTimeout(() => {
      const playResult = executePlay(gameState)
      setCurrentPlay(playResult)

      // If it's a run with steps, animate it
      if (playResult.type === 'run' && playResult.steps && playResult.steps.length > 0) {
        animateRunningPlay(playResult, gameState)
      } else {
        // Non-running play or no steps, show result directly
        setGameState(prevState => ({ ...prevState }))
        setAnimationPhase('result')

        // After showing result, return to idle
        animationRef.current = setTimeout(() => {
          setAnimationPhase('idle')
        }, pauseDuration * 1000)
      }
    }, pauseDuration * 1000)

    return () => clearTimeout(timer)
  }, [isSimulating, gameState, pauseDuration, isPaused, animationPhase, onGameComplete])

  function animateRunningPlay(playResult, currentGameState) {
    setAnimationPhase('running')
    const steps = playResult.steps
    let stepIndex = 0

    // Animation speed: 1 second per yard, or 100ms in fast mode
    const stepDelay = pauseDuration < 1 ? 100 : 1000

    function showNextStep() {
      if (stepIndex < steps.length) {
        const yardsText = steps.slice(0, stepIndex + 1).map(y => `...${y}`).join(' ')
        setRunningText(`Running ${yardsText}`)
        stepIndex++
        animationRef.current = setTimeout(showNextStep, stepDelay)
      } else {
        // Animation complete, show result and force re-render with fresh state copy
        setGameState(prevState => ({ ...prevState }))
        setAnimationPhase('result')

        // Check for touchdown
        if (playResult.touchdown) {
          animationRef.current = setTimeout(() => {
            setAnimationPhase('touchdown')
            // Touchdown pause is 5x normal
            animationRef.current = setTimeout(() => {
              setAnimationPhase('idle')
            }, pauseDuration * 5 * 1000)
          }, 500)
        } else {
          // Normal pause after result
          animationRef.current = setTimeout(() => {
            setAnimationPhase('idle')
          }, pauseDuration * 1000)
        }
      }
    }

    // Start with "Running..."
    setRunningText('Running...')
    animationRef.current = setTimeout(showNextStep, stepDelay)
  }

  if (!gameState) {
    return <div className="game-display">Loading game...</div>
  }

  // Determine what to show in play result area
  function getPlayDisplay() {
    if (animationPhase === 'running') {
      return (
        <div className="play-result">
          <div className="play-number">Play #{gameState.playNumber}</div>
          <div className="play-description running-animation">{runningText}</div>
        </div>
      )
    }

    if (animationPhase === 'touchdown') {
      return (
        <div className="play-result touchdown-display">
          <div className="play-number">Play #{gameState.playNumber}</div>
          <div className="touchdown-text">TOUCHDOWN!</div>
          <div className="play-description">{currentPlay?.description}</div>
        </div>
      )
    }

    if ((animationPhase === 'result' || animationPhase === 'idle') && currentPlay) {
      return (
        <div className="play-result">
          <div className="play-number">Play #{gameState.playNumber}</div>
          <div className="play-description">{currentPlay.description}</div>
          {currentPlay.turnover && <div className="turnover">TURNOVER!</div>}
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
              value={0.1}
              checked={pauseDuration === 0.1}
              onChange={(e) => onPauseDurationChange(Number(e.target.value))}
            />
            I'm going fast again!
          </label>
        </div>
      </div>

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

      {/* Field Position */}
      <div className="field-position">
        <div className="possession-indicator">
          {gameState.possession === 'home' ? '▶' : '◀'} {gameState.possession === 'home' ? gameState.homeTeam.name : gameState.awayTeam.name}
        </div>
        <div className="down-distance">
          {gameState.down}{getOrdinal(gameState.down)} & {gameState.distance} at {formatFieldPosition(gameState.yardline)}
        </div>
      </div>

      {/* Current Play Result */}
      {getPlayDisplay()}

      {/* Game Status */}
      {isGameOver(gameState) && (
        <div className="game-over">
          <h2>GAME OVER</h2>
          <div className="final-score">
            {gameState.homeTeam.name} {gameState.score.home} - {gameState.awayTeam.name} {gameState.score.away}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="stats-container">
        <div className="team-stats">
          <h3>{gameState.homeTeam.name}</h3>
          <div className="stat-line">
            <span>Rushing:</span>
            <span>{gameState.homeStats.runningPlays} carries, {gameState.homeStats.runningYards} yards</span>
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
            <span>Turnovers:</span>
            <span>{gameState.homeStats.fumblesLost}</span>
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
            <span>{gameState.awayStats.runningPlays} carries, {gameState.awayStats.runningYards} yards</span>
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
            <span>Turnovers:</span>
            <span>{gameState.awayStats.fumblesLost}</span>
          </div>
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
