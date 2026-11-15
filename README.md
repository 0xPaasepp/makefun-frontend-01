# make.fun · The Bounty Desk

A fast, easy-to-use make.fun frontend built from static files on make.fun's public API. It shows the live bounty board with each bounty's reward and live pot, its entry fee and time left; a bounty's page with its rules and rewards; its leaderboard; and an account's public profile — each reachable by link and by its own URL.

## Run it

```sh
node serve.ts --port 8080
```

Then open http://127.0.0.1:8080/ — board, bounty pages, leaderboard, and profiles, all on live API data. No build step, no external scripts, styles, or fonts.

## Entry

Built for the [make.fun frontend bounty](https://make.fun/bounty/makefun-frontend-01): "Build the best make.fun frontend". First load is 6 files, 43,004 bytes raw (14,327 gzip).
