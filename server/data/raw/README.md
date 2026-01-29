# Raw Data Directory

This directory contains raw data files for import into the TI Football database.

## Expected Files

### Schedule Data
**Filename:** `schedule-2025.csv` (or `.json`)

**Required fields:**
- `week` - Week number (1-18)
- `date` - Game date (YYYY-MM-DD format preferred)
- `day` - Day of week (Thursday, Friday, Saturday, Sunday, Monday)
- `away_team` - Away team abbreviation (e.g., "DAL", "KC", "NE")
- `home_team` - Home team abbreviation (e.g., "PHI", "BUF", "SF")

**Optional fields:**
- `time` - Game time (for ordering games within same day)
- `game_id` - External game identifier

**Notes:**
- Games will be numbered sequentially (1-272) based on chronological order
- Within a single day, game order doesn't matter (but maintain date order)
- Use team abbreviations that match our teams table

## Team Abbreviations Reference

ARI, ATL, BAL, BUF, CAR, CHI, CIN, CLE, DAL, DEN, DET, GB, HOU, IND, JAX, KC, LV, LAC, LAR, MIA, MIN, NE, NO, NYG, NYJ, PHI, PIT, SF, SEA, TB, TEN, WAS
