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
 * Player picks 1-4, computer picks 1-5
 * Match = tackled, no match = advance 1 yard and repeat
 *
 * @returns {number} Yards gained (can be negative on immediate tackle)
 */
export function runningPlay() {
  let yards = 0
  let tackled = false

  while (!tackled) {
    const playerChoice = Math.floor(Math.random() * 4) + 1  // 1-4
    const computerChoice = Math.floor(Math.random() * 5) + 1  // 1-5

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
    }
  }

  return yards
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

  while (!tackled) {
    const playerChoice = Math.floor(Math.random() * 4) + 1  // 1-4
    const computerChoice = Math.floor(Math.random() * 5) + 1  // 1-5

    if (playerChoice === computerChoice) {
      // Tackled!
      tackled = true
    } else {
      // Successful advance
      yards++
    }
  }

  return yards
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
