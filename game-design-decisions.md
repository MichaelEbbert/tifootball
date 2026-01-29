# Game Design Decisions - Hardcoded Constants

This file tracks all hardcoded percentage and probability values in the game simulation. These are currently set to reasonable constants based on NFL statistics and will eventually be converted to probability distributions (bell curves, etc.) one at a time.

**Process:** At a later date, we will systematically go through each value below and determine appropriate distributions rather than fixed constants.

---

## Passing Mechanics

### Completion Percentages
- **Short pass (0-10 yards):** 70%
- **Medium pass (11-20 yards):** 60%
- **Long pass (21+ yards):** 45%

### Air Yards (distance before catch)
- **Short pass:** 7 yards (range: 5-10)
- **Medium pass:** 15 yards (range: 11-20)
- **Long pass:** 30 yards (range: 21-40)

### Interception Percentages
- **Short pass:** 2%
- **Medium pass:** 3%
- **Long pass:** 5%

**Note:** After completion, use run-after-catch algorithm (1-4 vs 1-5) for additional yards

---

## Fumbles

- **Fumble rate (runs, catches, returns):** 2% per play
- **Fumble recovery:** 50% offense, 50% defense

---

## Punts

- **Punt distance:** 45 yards average
- **Fair catch percentage:** 40%
- **Punt return yards (if not fair caught):** Use running algorithm (1-4 vs 1-5)

---

## Field Goals

### Success Rate by Distance
- **0-29 yards:** 95%
- **30-39 yards:** 85%
- **40-49 yards:** 70%
- **50+ yards:** 50%

---

## Kickoffs

- **Touchback percentage:** 60% (ball placed at 25-yard line)
- **Kickoff return starting position (if no touchback):** 5-yard line
- **Kickoff return yards:** Use running algorithm (1-4 vs 1-5)

---

## Extra Points & 2-Point Conversions

- **Extra point success rate:** 95%
- **2-point conversion success rate:** 47%
- **2-point conversion decision:** Currently always kick extra point (TODO: add strategy logic)

---

## Play Calling Tendencies

### First Down
- **1st & 10:** 55% run, 45% pass

### Second Down
- **2nd & short (1-3 yards):** 65% run, 35% pass
- **2nd & medium (4-7 yards):** 50% run, 50% pass
- **2nd & long (8+ yards):** 35% run, 65% pass

### Third Down
- **3rd & short (1-3 yards):** 60% run, 40% pass
- **3rd & medium (4-7 yards):** 30% run, 70% pass
- **3rd & long (8+ yards):** 15% run, 85% pass

### Fourth Down Decision Logic
- **Punt:** If not in FG range AND need >4 yards
- **Field goal attempt:** If within FG range (own 45+ yard line)
- **Go for it:** If need ≤2 yards AND past own 40-yard line

**FG range definition:**
- Can attempt from own 45 (62-yard FG)
- Practical range varies by distance success rates above

---

## Scoring

- **Touchdown:** 6 points
- **Field goal:** 3 points
- **Safety:** 2 points
- **Extra point:** 1 point
- **2-point conversion:** 2 points

---

## Clock Management

**Current approach:** Simplified - each play consumes time from normal distribution (mean 28.6s).

**TODO - Future enhancement:**
- Incomplete passes should consume less time (15-25s range)
- Complete passes that go out of bounds should stop clock
- Runs that go out of bounds should stop clock
- Clock stops after first downs (briefly) in final 2 minutes
- Timeouts and challenges

**Note:** The border between plays is intentionally ambiguous (a charm of the original 1979 game). We don't track exact snap times, just play duration.

---

## First Down Logic

- **Distance needed:** 10 yards OR reach end zone
- **Downs reset:** On successful first down
- **Turnover on downs:** If fail to convert on 4th down

---

## Field Position

- **Field dimensions:** 0-100 yards (0 = own goal line, 50 = midfield, 100 = opponent goal line)
- **Touchback (kickoff):** 25-yard line
- **Touchback (punt):** 20-yard line
- **Safety:** 2 points, opponent gets ball via free kick from own 20

---

## Not Implemented (Intentionally)

- **Penalties:** Ignored for simplicity
- **Weather conditions:** Not simulated
- **Player injuries:** Not simulated
- **Coach challenges:** Not simulated
- **Onside kicks:** Not implemented (all kickoffs are normal)

---

## Distribution Candidates (Future)

When converting constants to distributions, consider:
1. Play time (already using normal distribution ✓)
2. Running yards (already using 1-4 vs 1-5 algorithm ✓)
3. Air yards by pass type
4. Completion percentage by pass type
5. Fumble rate by play type
6. Punt distance
7. Field goal success by distance
8. Play calling by game situation (score differential, time remaining)

---

*Last updated: 2026-01-28*
