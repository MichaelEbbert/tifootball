import { useState, useEffect } from 'react'
import { formatGameClock } from '../utils/gameSimulation'
import './GameBrowser.css'

function GameBrowser({ onBack, onViewGame }) {
  const [games, setGames] = useState([])
  const [selectedGame, setSelectedGame] = useState(null)
  const [gameDetail, setGameDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('schedule') // 'schedule' or 'detail'

  useEffect(() => {
    fetchGames()
  }, [])

  async function fetchGames() {
    try {
      const response = await fetch('/api/schedule/games')
      const data = await response.json()
      setGames(data)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching games:', error)
      setLoading(false)
    }
  }

  async function viewGameDetail(gameId) {
    try {
      const response = await fetch(`/api/games/${gameId}`)
      const data = await response.json()
      setGameDetail(data)
      setViewMode('detail')
    } catch (error) {
      console.error('Error fetching game detail:', error)
    }
  }

  // Group games by week
  const gamesByWeek = games.reduce((acc, game) => {
    const week = game.week || 0
    if (!acc[week]) acc[week] = []
    acc[week].push(game)
    return acc
  }, {})

  if (loading) {
    return <div className="game-browser">Loading games...</div>
  }

  // Game Detail View
  if (viewMode === 'detail' && gameDetail) {
    const { game, stats, scoringLog } = gameDetail
    const homeStats = stats.find(s => s.team_id === game.home_team_id) || {}
    const awayStats = stats.find(s => s.team_id === game.away_team_id) || {}

    return (
      <div className="game-browser">
        <div className="browser-header">
          <button className="back-btn" onClick={() => setViewMode('schedule')}>
            Back to Schedule
          </button>
          <h2>Game Detail</h2>
        </div>

        <div className="game-detail">
          <div className="game-final-score">
            <h1>FINAL</h1>
            <div className="final-matchup">
              <span className="team-name">{game.away_city} {game.away_name}</span>
              <span className="score">{game.away_score}</span>
              <span className="at">@</span>
              <span className="score">{game.home_score}</span>
              <span className="team-name">{game.home_city} {game.home_name}</span>
            </div>
          </div>

          {/* Scoring Summary */}
          {scoringLog && scoringLog.length > 0 && (
            <div className="scoring-summary">
              <h3>Scoring Summary</h3>
              <div className="scoring-log">
                {scoringLog.map((entry, index) => (
                  <div key={index} className="scoring-entry">
                    <span className="score-quarter">Q{entry.quarter}</span>
                    <span className="score-time">{formatGameClock(entry.time_remaining)}</span>
                    <span className="score-team">{entry.team_abbr}</span>
                    <span className="score-desc">{entry.description}</span>
                    <span className="score-total">{entry.away_score}-{entry.home_score}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Box Score */}
          <div className="box-score">
            <h3>Box Score</h3>
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Stat</th>
                  <th>{game.away_abbr}</th>
                  <th>{game.home_abbr}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Rushing</td>
                  <td>{awayStats.rushing_attempts}-{awayStats.rushing_yards}</td>
                  <td>{homeStats.rushing_attempts}-{homeStats.rushing_yards}</td>
                </tr>
                <tr>
                  <td>Passing</td>
                  <td>{awayStats.pass_completions}/{awayStats.pass_attempts} for {awayStats.pass_yards}</td>
                  <td>{homeStats.pass_completions}/{homeStats.pass_attempts} for {homeStats.pass_yards}</td>
                </tr>
                <tr>
                  <td>Total Yards</td>
                  <td>{(awayStats.rushing_yards || 0) + (awayStats.pass_yards || 0)}</td>
                  <td>{(homeStats.rushing_yards || 0) + (homeStats.pass_yards || 0)}</td>
                </tr>
                <tr>
                  <td>First Downs</td>
                  <td>{awayStats.first_downs || 0}</td>
                  <td>{homeStats.first_downs || 0}</td>
                </tr>
                <tr>
                  <td>3rd Down</td>
                  <td>{awayStats.third_down_conversions || 0}/{awayStats.third_down_attempts || 0}</td>
                  <td>{homeStats.third_down_conversions || 0}/{homeStats.third_down_attempts || 0}</td>
                </tr>
                <tr>
                  <td>4th Down</td>
                  <td>{awayStats.fourth_down_conversions || 0}/{awayStats.fourth_down_attempts || 0}</td>
                  <td>{homeStats.fourth_down_conversions || 0}/{homeStats.fourth_down_attempts || 0}</td>
                </tr>
                <tr>
                  <td>Turnovers</td>
                  <td>{awayStats.turnovers || 0}</td>
                  <td>{homeStats.turnovers || 0}</td>
                </tr>
                <tr>
                  <td>Sacks</td>
                  <td>{awayStats.sacks || 0} for {awayStats.sack_yards_lost || 0}</td>
                  <td>{homeStats.sacks || 0} for {homeStats.sack_yards_lost || 0}</td>
                </tr>
                <tr>
                  <td>Time of Possession</td>
                  <td>{formatGameClock(awayStats.time_of_possession || 0)}</td>
                  <td>{formatGameClock(homeStats.time_of_possession || 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // Schedule View
  return (
    <div className="game-browser">
      <div className="browser-header">
        <button className="back-btn" onClick={onBack}>
          Back to Home
        </button>
        <h2>Season Schedule</h2>
      </div>

      <div className="schedule-list">
        {Object.keys(gamesByWeek).sort((a, b) => a - b).map(week => (
          <div key={week} className="week-section">
            <h3>Week {week}</h3>
            <div className="week-games">
              {gamesByWeek[week].map(game => (
                <div
                  key={game.game_number}
                  className={`game-row ${game.simulated ? 'completed' : 'upcoming'}`}
                  onClick={() => game.simulated && game.game_id && viewGameDetail(game.game_id)}
                >
                  <span className="game-number">#{game.game_number}</span>
                  <span className="game-matchup">
                    {game.away_abbr} @ {game.home_abbr}
                  </span>
                  {game.simulated ? (
                    <span className="game-score">
                      {game.away_score} - {game.home_score}
                    </span>
                  ) : (
                    <span className="game-status">Upcoming</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default GameBrowser
