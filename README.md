# Groww App AI Discovery Engine

Research dashboard on public posts about first SIPs, with a Gemini-powered "Ask the corpus" Q&A.

- `public/` : the five pages (Dashboard, Opportunity areas, Ask the corpus, Search comments, How it works) and `sip_comments.json` (about 12,950 coded comments).
- `api/ask.js` : serverless function. Embeds the question, finds the closest comments, asks Gemini to answer only from them.
- `scripts/ingest.mjs` : builds the search index once (`data/embeddings.bin`).

## Deploy (about 10 minutes)

1. **Get a Gemini key** in Google AI Studio. Keep it out of the repo and out of chat messages.
2. **(Optional, better search) Build the index once, on your computer** (Node 18 or newer):

   ```bash
   export GEMINI_API_KEY=your_key_here     # Windows PowerShell: $env:GEMINI_API_KEY="your_key_here"
   npm run ingest
   ```

   It takes a few minutes and writes `data/embeddings.bin` (about 10 MB) and `data/meta.json`.
3. **Commit and push everything**, including the two files in `data/`.
4. **Import the repo in Vercel**: Add New, Project, pick this repo. Framework preset: Other. No build command, no output directory needed.
5. **Add the key in Vercel**: Project Settings, Environment Variables, add `GEMINI_API_KEY` for Production and Preview (and optionally `GEMINI_MODEL`, `GEMINI_EMBED_MODEL`). Redeploy.
6. Open the site, go to **Ask the corpus**, and type your own question. Starter chips stay pre-computed.

## Notes

- The key is read only inside `api/ask.js` on the server. Browsers never see it.
- Defaults: `gemini-2.5-flash` for answers and `gemini-embedding-001` (768 dims) for search. If Google retires a name, set the env vars to a current model. If you change the embedding model, run `npm run ingest` again.
- Abuse protection: the function limits questions to 300 characters and 8 per minute per IP (per server instance). For a public link, add a stronger limit (for example Upstash Ratelimit or Vercel's Firewall rate limiting) and set a spending cap on the Google key.
- If the API fails or the key is missing, the Ask page falls back to the closest pre-computed answer.
- Local test: `npm i -g vercel`, copy `.env.example` to `.env.local`, run `vercel dev`.


## Update: no index needed

`api/ask.js` now works without `npm run ingest`. If `data/embeddings.bin` is missing it finds posts by keywords and still asks Gemini to answer from them. Running ingest later upgrades the search to meaning-based. The only required setting is `GEMINI_API_KEY` in Vercel (Settings, Environment Variables), followed by a redeploy.
