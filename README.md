# 4-Letter Discord Wordle Bot

This is a Discord GUI Wordle bot using slash commands, embeds, buttons, and modals.

## Files

- `bot.py` — the bot
- `requirements.txt` — Python dependency
- `Procfile` — worker command for Railway-style hosting
- `.gitignore` — prevents secrets/local files from being committed

## Discord setup

Create a bot in the Discord Developer Portal.

Invite it with these scopes:

```text
bot
applications.commands
```

Recommended permissions:

```text
Send Messages
Embed Links
Read Message/View Channels
```

## Environment variables

Set these in your cloud host:

```text
DISCORD_TOKEN=your_discord_bot_token
GUILD_ID=your_discord_server_id
WORDLE_DAILY_SEED=some-long-private-random-string
```

`GUILD_ID` is optional, but useful for testing because commands appear faster in one server.

## Railway deployment

1. Upload this folder to GitHub.
2. Create a new Railway project.
3. Deploy from the GitHub repo.
4. Add the environment variables above.
5. Set the start command to:

```bash
python bot.py
```

The `Procfile` also declares:

```text
worker: python bot.py
```

## Discord usage

```text
/wordle start
/wordle stats
/wordle help
```

Everyone receives the same word each UTC day, based on `WORDLE_DAILY_SEED` and the current date.

## Notes

Stats are stored in `wordle_gui_stats.json`. On cloud hosts without persistent storage, stats may reset after redeploys or restarts. The daily word will still remain consistent because it is date-based.
