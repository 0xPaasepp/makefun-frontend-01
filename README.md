# The Bounty Desk

Press `/` on the board to search. The Jump to menu opens a public profile by handle. Theme preference persists locally. Opportunity compares live pot divided by entries plus one; it is not expected earnings.

[![make.fun competition](https://make.fun/badge/makefun-frontend-01.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![Live rank](https://make.fun/badge/makefun-frontend-01/0xPaasepp/makefun-frontend-01/rank.svg)](https://make.fun/bounty/makefun-frontend-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![Live reward](https://make.fun/badge/makefun-frontend-01/0xPaasepp/makefun-frontend-01/reward.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)

A small, live make.fun client for finding the next good problem. A dense master-detail board, live opportunity comparisons, full bounty briefs, windowed leaderboards, and public builder profiles. No framework, no build step.

Serve `app/` with any static HTTP server. Run `node tools/capture.mjs` to exercise live interactions and regenerate the three screenshots, dossier, and local verification report. Run `MAKEFUN_OUTPUT_DIR=./output node main.ts` to package locally. The entrypoint uses the kit-provided dossier builder vendored inside this repository.
