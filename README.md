# TI Football - 1979 Game Simulator

A web-based simulation of a football game originally created in 1979 on a TI-99/4a computer in BASIC.

## Project Structure

```
tifootball/
├── client/              # React frontend (Vite)
│   ├── public/
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── utils/       # Game logic utilities
│   │   ├── App.jsx      # Main app component
│   │   └── main.jsx     # React entry point
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── server/              # Express backend
│   ├── db/              # SQLite database
│   ├── routes/          # API routes
│   ├── models/          # Database models
│   ├── index.js         # Server entry point
│   └── package.json
├── CLAUDE.md            # Development notes
└── README.md
```

## Technology Stack

- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Database:** SQLite (better-sqlite3)

## Setup Instructions

### Prerequisites

- Node.js 18+ installed
- npm or yarn

### Installation

1. Install client dependencies:
```bash
cd client
npm install
```

2. Install server dependencies:
```bash
cd ../server
npm install
```

### Running the Application

1. Start the backend server (from `server/` directory):
```bash
npm run dev
```
Server runs on http://localhost:3001

2. Start the frontend (from `client/` directory):
```bash
npm run dev
```
Client runs on http://localhost:3000

## Game Features

- Automated play-by-play simulation
- Running plays with realistic probability distribution (3.7 yards avg)
- Pass plays (short, medium, long)
- Special teams (punts, field goals, kickoffs)
- Random events (fumbles, interceptions, blocked kicks)
- NFL-style game clock
- Persistent game statistics in SQLite database

## Development

See `CLAUDE.md` for detailed game mechanics and implementation notes.
