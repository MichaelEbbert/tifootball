/**
 * TI Football Game Simulation Utilities
 * Based on 1979 TI-99/4a BASIC game logic
 */

/**
 * Generate a random number from a normal distribution using Box-Muller transform
 * @param {number} mean - Mean of the distribution
 * @param {number} stdDev - Standard deviation
 * @returns {number} Random value from normal distribution
 */
function randomNormal(mean, stdDev) {
  // Box-Muller transform to generate normal distribution
  const u1 = Math.random()
  const u2 = Math.random()
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2)
  return z0 * stdDev + mean
}

/**
 * Generate random play duration in seconds
 * Uses normal distribution: mean 28.6s, std dev ~11s
 * Clamped to 5-50 seconds (minimum play time to full delay of game)
 *
 * @returns {number} Play duration in seconds (5-50)
 */
export function generatePlayTime() {
  const mean = 28.6
  const stdDev = 11
  const time = randomNormal(mean, stdDev)

  // Clamp to reasonable bounds
  return Math.max(5, Math.min(50, Math.round(time)))
}

/**
 * Running algorithm from original 1979 game
 * Player picks 1-4, computer picks 1-5 (or 1-4 on 4th and 1)
 * Match = tackled, no match = advance 1 yard and repeat
 *
 * @param {Object} options - Optional parameters
 * @param {boolean} options.fourthAndOne - If true, use 1-4 vs 1-4 for first yard (75% conversion)
 * @returns {Object} { yards, steps } - Yards gained and step-by-step progression
 */
export function runningPlay(options = {}) {
  // DEBUG: Short circuit for testing touchdowns
  // return { yards: 15, steps: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] }

  const { fourthAndOne = false } = options
  let yards = 0
  let tackled = false
  const steps = []  // Track each yard advanced

  while (!tackled) {
    const playerChoice = Math.floor(Math.random() * 4) + 1  // 1-4

    // Defense range varies by situation:
    // - 4th and 1 (first yard only): 1-4 (25% tackle = 75% conversion)
    // - Normal (0-5 yards): 1-5 (20% tackle = 80% per yard)
    // - After 6 yards: 1-7 (harder to break long runs)
    let defenseRange
    if (yards === 0 && fourthAndOne) {
      defenseRange = 4  // Tighter coverage on 4th and 1
    } else if (yards >= 6) {
      defenseRange = 7  // Defense closes in on long runs
    } else {
      defenseRange = 5  // Normal
    }
    const computerChoice = Math.floor(Math.random() * defenseRange) + 1

    if (playerChoice === computerChoice) {
      // Tackled!
      tackled = true

      if (yards === 0) {
        // Tackled immediately - lose 0-3 yards
        yards = -Math.floor(Math.random() * 4)  // 0, -1, -2, or -3
      }
      // else: gain is the number of successful advances (yards)
    } else {
      // Successful advance
      yards++
      steps.push(yards)
    }
  }

  return { yards, steps }
}

/**
 * Run after catch (RAC) - uses same algorithm as running play
 * This happens after a completed pass
 *
 * @returns {number} Additional yards gained after catch
 */
export function runAfterCatch() {
  // Same algorithm as running, but we know they already have the ball
  // so no negative yards on first attempt
  let yards = 0
  let tackled = false
  const steps = []

  while (!tackled) {
    const playerChoice = Math.floor(Math.random() * 4) + 1  // 1-4
    const computerChoice = Math.floor(Math.random() * 5) + 1  // 1-5

    if (playerChoice === computerChoice) {
      // Tackled!
      tackled = true
    } else {
      // Successful advance
      yards++
      steps.push(yards)
    }
  }

  return { yards, steps }
}

/**
 * Format seconds as MM:SS for game clock display
 * @param {number} totalSeconds
 * @returns {string} Formatted time (e.g., "12:45")
 */
export function formatGameClock(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/**
 * Game state constants
 */
export const QUARTERS = 4
export const QUARTER_LENGTH = 900  // 15 minutes = 900 seconds
export const TOTAL_GAME_TIME = QUARTERS * QUARTER_LENGTH  // 3600 seconds
export const AVERAGE_PLAYS_PER_GAME = 126
export const AVERAGE_SECONDS_PER_PLAY = 28.6
