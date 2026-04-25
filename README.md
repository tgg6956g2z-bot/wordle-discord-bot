# 4-Letter Wordle Discord Activity - No Build Version

This version avoids Vite and has no build step.

## Files

```text
package.json
server.js
.env.example
client/
  index.html
  main.js
  style.css
```

## Railway settings

Use these commands:

```text
Build Command: npm install
Start Command: npm start
```

Do not use `npm run build`.

## Railway variables

```text
VITE_DISCORD_CLIENT_ID=your_discord_application_client_id
WORDLE_DAILY_SEED=some-long-private-random-string
```

## Local test

```bash
npm install
npm start
```

Open:

```text
http://localhost:3000
```

## Discord Activity

Use your Railway HTTPS domain as the Activity URL in the Discord Developer Portal.
