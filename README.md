# 4-Letter Wordle Discord Activity - Webhook Results

This version posts result messages and a daily recap to a Discord channel webhook.

Railway settings:

```text
Build Command: npm install
Start Command: npm start
```

Railway variables:

```text
VITE_DISCORD_CLIENT_ID=your_discord_application_client_id
WORDLE_DAILY_SEED=some-long-private-random-string
DISCORD_WEBHOOK_URL=your_discord_channel_webhook_url
RECAP_UTC_HOUR=23
RECAP_UTC_MINUTE=55
```

To get a webhook:

```text
Discord channel settings → Integrations → Webhooks → New Webhook → Copy Webhook URL
```

Activity URL mapping:

```text
Prefix: /
Target: https://your-app.up.railway.app
```

Results post automatically when a user wins, loses, or reveals. Use `Post Recap` to test the daily recap manually.
