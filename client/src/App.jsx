import { useState, useEffect } from 'react'
import './App.css'
import logger from './utils/logger'
import GameDisplay from './components/GameDisplay'

function App() {
  const [nextGame, setNextGame] = useState(null)
  const [standings, setStandings] = useState([])
  const [loading, setLoading] = useState(true)
  const [pauseDuration, setPauseDuration] = useState(3) // Default 3 seconds
  const [gameInProgress, setGameInProgress] = useState(false)
  const [currentGame, setCurrentGame] = useState(null)

  useEffect(() => {
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

    // Set up game with team info
    setCurrentGame({
      gameNumber: nextGame.game_number,
      homeTeam: {
        id: nextGame.home_team_id,
        city: nextGame.home_city,
        name: nextGame.home_name,
        abbreviation: nextGame.home_abbr
      },
      awayTeam: {
        id: nextGame.away_team_id,
        city: nextGame.away_city,
        name: nextGame.away_name,
        abbreviation: nextGame.away_abbr
      }
    })

    setGameInProgress(true)
  }

  function handleGameComplete(finalGameState) {
    logger.info('Game completed, returning to home screen')
    setGameInProgress(false)
    setCurrentGame(null)
    // TODO: Save game results to database
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
          onGameComplete={handleGameComplete}
        />
      </div>
    )
  }

  // Show home screen
  return (
    <div className="app">
      <div className="pause-control">
        <label>Pause (seconds):</label>
        {[1, 2, 3, 4, 5].map(seconds => (
          <label key={seconds} className="radio-option">
            <input
              type="radio"
              name="pause"
              value={seconds}
              checked={pauseDuration === seconds}
              onChange={(e) => setPauseDuration(Number(e.target.value))}
            />
            {seconds}
          </label>
        ))}
      </div>

      <h1>TI Football - 1979 Game Simulator</h1>

      {nextGame && (
        <div className="next-game">
          <h2>Next Game</h2>
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
