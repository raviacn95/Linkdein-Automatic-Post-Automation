# LearnHub content pipeline

Auto-builds **original** LearnHub posts from allowlisted official docs (Playwright, TypeScript, MDN, Node.js).

Flow: **Playwright fetch → SQLite → original lesson (AI or template) → `website-posts-data.js`**

This does **not** republish GeeksforGeeks or other copyrighted pages. It stores teaching *signals* (title, outline, short code snippets) and writes a new lesson with source attribution.

## Run

```bash
npm run hub:pipeline          # fetch → publish → auto-push live site
npm run hub:pipeline -- --limit 2
npm run hub:pipeline -- --seed-only
npm run hub:pipeline -- --no-deploy   # skip GitHub Pages push
npm run hub:deploy            # deploy only
```

`hub:pipeline` auto-deploys to https://raviacn95.github.io/ when new posts are published (`autoDeploy: true` in `config.json`).

Optional AI (uses first available key):

- `GROQ_API_KEY`
- `OPENAI_API_KEY`

Without keys, a solid template lesson is still published.

## Edit seeds

`content-pipeline/seeds.json` — only add sites you may fetch under their terms / robots rules.

## Data

SQLite DB: `content-pipeline/data/pipeline.sqlite`

Tables: `sources`, `raw_pages`, `lessons`

## Apify later

Keep this local loop. When you want cloud scheduling, wrap the same modules with `apify-client` or a custom Actor (see Apify routing in the team docs).
