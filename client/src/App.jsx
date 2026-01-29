import { useState } from 'react'
import './App.css'

function App() {
  const [gameState, setGameState] = useState({
    quarter: 1,
    clock: "15:00",
    down: 1,
    distance: 10,
    yardline: 20,
    possession: 'home',
    score: { home: 0, away: 0 }
  })

  return (
    <div className="app">
      <h1>TI Football - 1979 Game Simulator</h1>
      <div className="scoreboard">
        <div className="score">
          <span>Home: {gameState.score.home}</span>
          <span>Away: {gameState.score.away}</span>
        </div>
        <div className="game-info">
          <span>Q{gameState.quarter}</span>
          <span>{gameState.clock}</span>
        </div>
      </div>
      <div className="field-position">
        <p>
          {gameState.down}{getOrdinal(gameState.down)} & {gameState.distance} at yard line {gameState.yardline}
        </p>
      </div>
      <div className="play-result">
        {/* Play results will appear here */}
      </div>
    </div>
  )
}

function getOrdinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return s[(v - 20) % 10] || s[v] || s[0]
}

export default App
