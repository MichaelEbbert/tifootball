import { useState, useEffect } from 'react'
import './App.css'
import logger from './utils/logger'
import GameDisplay from './components/GameDisplay'
import GameBrowser from './components/GameBrowser'

const SAVED_GAME_KEY = 'tifootball_saved_game'

function App() {
  const [nextGame, setNextGame] = useState(null)
  const [standings, setStandings] = useState([])
  const [loading, setLoading] = useState(true)
  const [pauseDuration, setPauseDuration] = useState(3) // Default 3 seconds
  const [gameInProgress, setGameInProgress] = useState(false)
  const [currentGame, setCurrentGame] = useState(null)
  const [savedGameState, setSavedGameState] = useState(null)
  const [showBrowser, setShowBrowser] = useState(false)

  useEffect(() => {
    // Check for saved game on load
    const saved = localStorage.getItem(SAVED_GAME_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setSavedGameState(parsed)
        logger.info('Found saved game in progress')
      } catch (e) {
        logger.error('Failed to parse saved game:', e)
        localStorage.removeItem(SAVED_GAME_KEY)
      }
    }
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const [gameRes, standingsRes] = await Promise.all([
        fetch('/api/schedule/next'),
        fetch('/api/standings')
      ])

      const gameData = await gameRes.json()
      const standingsData = await standingsRes.json()

      setNextGame(gameData)
      setStandings(standingsData)
      setLoading(false)
      logger.info('Data loaded successfully')
    } catch (error) {
      logger.error('Error fetching data:', error)
      setLoading(false)
    }
  }

  function handleBeginGame() {
    logger.info(`Starting Game ${nextGame.game_number}`)

    // Set up game with team info and coach tendencies
    setCurrentGame({
      gameNumber: nextGame.game_number,
      homeTeam: {
        id: nextGame.home_team_id,
        city: nextGame.home_city,
        name: nextGame.home_name,
        abbreviation: nextGame.home_abbr,
        tendencies: nextGame.home_tendencies
      },
      awayTeam: {
        id: nextGame.away_team_id,
        city: nextGame.away_city,
        name: nextGame.away_name,
        abbreviation: nextGame.away_abbr,
        tendencies: nextGame.away_tendencies
      }
    })

    setGameInProgress(true)
  }

  function handleNextGame(finalGameState) {
    logger.info('Game completed, continuing to next game')
    localStorage.removeItem(SAVED_GAME_KEY)
    setSavedGameState(null)
    setGameInProgress(false)
    setCurrentGame(null)
    // TODO: Save game results to database
    // Refresh data to get next game
    fetchData()
  }

  function handleDone(finalGameState) {
    logger.info('Game completed, done for now')
    localStorage.removeItem(SAVED_GAME_KEY)
    setSavedGameState(null)
    setGameInProgress(false)
    setCurrentGame(null)
    // TODO: Save game results to database
  }

  function handleResumeGame() {
    if (savedGameState) {
      logger.info('Resuming saved game')
      setCurrentGame(savedGameState.game)
      setGameInProgress(true)
    }
  }

  function handleAbandonGame() {
    logger.info('Abandoning saved game')
    localStorage.removeItem(SAVED_GAME_KEY)
    setSavedGameState(null)
  }

  if (loading) {
    return <div className="app"><h1>Loading...</h1></div>
  }

  // Show game display if game is in progress
  if (gameInProgress && currentGame) {
    return (
      <div className="app">
        <GameDisplay
          game={currentGame}
          pauseDuration={pauseDuration}
          onPauseDurationChange={setPauseDuration}
          onNextGame={handleNextGame}
          onDone={handleDone}
          savedGameState={savedGameState?.gameState}
          saveKey={SAVED_GAME_KEY}
        />
      </div>
    )
  }

  // Show game browser
  if (showBrowser) {
    return (
      <div className="app">
        <GameBrowser onBack={() => { setShowBrowser(false); fetchData(); }} />
      </div>
    )
  }

  // Show home screen
  return (
    <div className="app">
      <h1>TI Football - 1979 Game Simulator</h1>

      <div className="nav-buttons">
        <button className="nav-btn" onClick={() => setShowBrowser(true)}>
          View Schedule & Results
        </button>
      </div>

      {savedGameState && (
        <div className="saved-game">
          <h2>Game In Progress</h2>
          <div className="saved-game-info">
            <div className="saved-game-header">
              Game #{savedGameState.game.gameNumber}: {savedGameState.gameState.awayTeam.abbreviation} @ {savedGameState.gameState.homeTeam.abbreviation}
            </div>
            <div className="saved-game-score">
              {savedGameState.gameState.awayTeam.name} {savedGameState.gameState.score.away} - {savedGameState.gameState.homeTeam.name} {savedGameState.gameState.score.home}
            </div>
            <div className="saved-game-status">
              Q{savedGameState.gameState.quarter} - {Math.floor(savedGameState.gameState.clock / 60)}:{(savedGameState.gameState.clock % 60).toString().padStart(2, '0')}
            </div>
            <div className="saved-game-possession">
              {savedGameState.gameState.possession === 'home'
                ? savedGameState.gameState.homeTeam.name
                : savedGameState.gameState.awayTeam.name}'s ball, {savedGameState.gameState.down}&{savedGameState.gameState.distance}
            </div>
          </div>
          <div className="saved-game-buttons">
            <button className="resume-game-btn" onClick={handleResumeGame}>
              Resume Game
            </button>
            <button className="abandon-game-btn" onClick={handleAbandonGame}>
              Abandon Game
            </button>
          </div>
        </div>
      )}

      {nextGame && !savedGameState && (
        <div className="next-game">
          <h2>Next Game</h2>
          <div className="pause-control">
            <label>Speed:</label>
            {[1, 2, 3, 4, 5].map(seconds => (
              <label key={seconds} className="radio-option">
                <input
                  type="radio"
                  name="pause"
                  value={seconds}
                  checked={pauseDuration === seconds}
                  onChange={(e) => setPauseDuration(Number(e.target.value))}
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
                onChange={(e) => setPauseDuration(Number(e.target.value))}
              />
              I'm going fast again!
            </label>
          </div>
          <br />
          <button className="begin-game-btn" onClick={handleBeginGame}>
            Begin Game {nextGame.game_number}: {nextGame.away_abbr} @ {nextGame.home_abbr}
          </button>
          <p className="game-details">
            Week {nextGame.week} - {nextGame.game_day}, {nextGame.game_date}
          </p>
          <p className="matchup">
            {nextGame.away_city} {nextGame.away_name} @ {nextGame.home_city} {nextGame.home_name}
          </p>
        </div>
      )}

      <div className="standings">
        <h2>League Standings</h2>

        <div className="conference">
          <h3>AFC</h3>
          {['East', 'North', 'South', 'West'].map(division => (
            <div key={`AFC-${division}`} className="division">
              <h4>AFC {division}</h4>
              <table>
                <thead>
                  <tr>
                    <th>Team</th>
                    <th>Coach</th>
                    <th>W</th>
                    <th>L</th>
                    <th>T</th>
                    <th>PF</th>
                    <th>PA</th>
                  </tr>
                </thead>
                <tbody>
                  {standings
                    .filter(t => t.conference === 'AFC' && t.division === division)
                    .map(team => (
                      <tr key={team.id}>
                        <td>{team.city} {team.name}</td>
                        <td>{team.coach_first_name} {team.coach_last_name}</td>
                        <td>{team.wins}</td>
                        <td>{team.losses}</td>
                        <td>{team.ties}</td>
                        <td>{team.points_for || 0}</td>
                        <td>{team.points_against || 0}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        <div className="conference">
          <h3>NFC</h3>
          {['East', 'North', 'South', 'West'].map(division => (
            <div key={`NFC-${division}`} className="division">
              <h4>NFC {division}</h4>
              <table>
                <thead>
                  <tr>
                    <th>Team</th>
                    <th>Coach</th>
                    <th>W</th>
                    <th>L</th>
                    <th>T</th>
                    <th>PF</th>
                    <th>PA</th>
                  </tr>
                </thead>
                <tbody>
                  {standings
                    .filter(t => t.conference === 'NFC' && t.division === division)
                    .map(team => (
                      <tr key={team.id}>
                        <td>{team.city} {team.name}</td>
                        <td>{team.coach_first_name} {team.coach_last_name}</td>
                        <td>{team.wins}</td>
                        <td>{team.losses}</td>
                        <td>{team.ties}</td>
                        <td>{team.points_for || 0}</td>
                        <td>{team.points_against || 0}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default App
