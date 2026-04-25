# 4-Letter Wordle Discord Activity

This is a Discord Activity version of the 4-letter Wordle game.

It is a web app, not a Discord bot. Discord Activities run as embedded web apps inside Discord using the Embedded App SDK.

## What is included

```text
package.json
server.js
.env.example
client/
  index.html
  src/
    main.js
    style.css
```

## Features

- 4-letter Wordle board
- Daily shared word
- Everyone gets the same answer each UTC day
- On-screen keyboard
- Physical keyboard support
- Duplicate-letter scoring
- Local per-player progress saved in `localStorage`
- Result copying
- Discord Embedded App SDK initialization
- Local browser preview mode

## Discord credentials needed

You do **not** need `DISCORD_TOKEN` or `GUILD_ID`.

You need:

```text
VITE_DISCORD_CLIENT_ID
WORDLE_DAILY_SEED
```

`VITE_DISCORD_CLIENT_ID` is your Discord application Client ID.

`WORDLE_DAILY_SEED` is a private string you create yourself.

## Local setup

```bash
npm install
cp .env.example .env
```

Edit `.env` and set:

```text
VITE_DISCORD_CLIENT_ID=your_client_id
WORDLE_DAILY_SEED=some-long-private-random-string
```

Run local preview:

```bash
npm run build
npm start
```

Open:

```text
http://localhost:3000
```

## Railway deployment

1. Push this folder to GitHub.
2. Create a Railway project from the GitHub repo.
3. Add these variables:

```text
VITE_DISCORD_CLIENT_ID=your_discord_application_client_id
WORDLE_DAILY_SEED=some-long-private-random-string
```

4. Railway should run:

```bash
npm install
npm run build
npm start
```

If Railway asks for a start command, use:

```bash
npm start
```

## Discord Developer Portal setup

1. Open your Discord application.
2. Go to **OAuth2** and copy the **Client ID**.
3. Put that value into Railway as `VITE_DISCORD_CLIENT_ID`.
4. Go to the Activity/Embedded App settings in the Developer Portal.
5. Add your deployed HTTPS URL as the Activity URL mapping.
6. Enable Activities for the application.
7. Save changes.

## Daily word

The server chooses the daily word with:

```text
sha256(WORDLE_DAILY_SEED + UTC_DATE)
```

The answer is generated server-side. The browser asks the server to score guesses.

## Notes

This first version is per-player daily Wordle. Everyone has the same word, but each person has their own board. It does not yet include a shared leaderboard or multiplayer room state.
