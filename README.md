# 4-Letter Wordle Discord Activity - Inline JS Version

This version puts the game script directly inside `client/index.html` to avoid Discord Activity proxy/path issues.

## Railway settings

Build Command:

```text
npm install
```

Start Command:

```text
npm start
```

## Variables

```text
VITE_DISCORD_CLIENT_ID=your_discord_application_client_id
WORDLE_DAILY_SEED=some-long-private-random-string
```

## Activity URL Mapping

Prefix:

```text
/
```

Target:

```text
https://your-app.up.railway.app
```
