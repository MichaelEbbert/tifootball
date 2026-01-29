import { useState, useEffect } from 'react'
import { initializeGame, executePlay, isGameOver } from '../utils/gameEngine'
import { formatGameClock } from '../utils/gameSimulation'
import logger from '../utils/logger'
import './GameDisplay.css'

function GameDisplay({ game, pauseDuration, onGameComplete }) {
  const [gameState, setGameState] = useState(null)
  const [currentPlay, setCurrentPlay] = useState(null)
  const [isSimulating, setIsSimulating] = useState(false)

  useEffect(() => {
    // Initialize game when component mounts
    const initialState = initializeGame(game.homeTeam, game.awayTeam, true) // true = simplified mode
    setGameState(initialState)
    logger.info('Game started - Simplified mode: Runs only, no kicks, always go on 4th down')

    // Start simulation after brief delay
    setTimeout(() => {
      setIsSimulating(true)
    }, 1000)
  }, [game])

  useEffect(() => {
    if (!isSimulating || !gameState || isGameOver(gameState)) {
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

      // Update game state (force re-render)
      setGameState({ ...gameState })
    }, pauseDuration * 1000)

    return () => clearTimeout(timer)
  }, [isSimulating, gameState, pauseDuration, onGameComplete])

  if (!gameState) {
    return <div className="game-display">Loading game...</div>
  }

  return (
    <div className="game-display">
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
          {gameState.down}{getOrdinal(gameState.down)} & {gameState.distance} at {gameState.yardline} yard line
        </div>
      </div>

      {/* Current Play Result */}
      {currentPlay && (
        <div className="play-result">
          <div className="play-number">Play #{gameState.playNumber}</div>
          <div className="play-description">{currentPlay.description}</div>
          {currentPlay.turnover && <div className="turnover">🔄 TURNOVER!</div>}
        </div>
      )}

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

export default GameDisplay
