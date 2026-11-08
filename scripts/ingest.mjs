// Build the vector index once, on your own computer:
//   GEMINI_API_KEY=...  npm run ingest
// Reads public/sip_comments.json, embeds every comment with Gemini and writes
//   data/embeddings.bin  (int8, L2-normalised, rows x dim)
//   data/meta.json
// Commit both files, then deploy. The key is only used here and is never stored.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error('Set GEMINI_API_KEY first.'); process.exit(1); }
const MODEL = process.env.GEMINI_EMBED_MODEL || 'gemini-embedding-001';
const DIM = 768;
const BATCH = 100;
const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:batchEmbedContents`;

const corpus = JSON.parse(readFileSync('public/sip_comments.json', 'utf8'));
const rows = corpus.rows;
const out = new Int8Array(rows.length * DIM);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function embedBatch(texts) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const r = await fetch(URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': KEY },
      body: JSON.stringify({
        requests: texts.map((t) => ({
          model: `models/${MODEL}`,
          content: { parts: [{ text: t }] },
          taskType: 'RETRIEVAL_DOCUMENT',
          outputDimensionality: DIM
        }))
      })
    });
    if (r.ok) return (await r.json()).embeddings.map((e) => e.values);
    if (r.status === 429 || r.status >= 500) {
      const wait = Math.min(60000, 2000 * 2 ** attempt);
      console.log(`  ${r.status}, waiting ${Math.round(wait / 1000)}s...`);
      await sleep(wait);
      continue;
    }
    throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 300)}`);
  }
  throw new Error('Too many retries');
}

console.log(`Embedding ${rows.length} comments with ${MODEL} (${DIM} dims)...`);
for (let i = 0; i < rows.length; i += BATCH) {
  const slice = rows.slice(i, i + BATCH);
  const vecs = await embedBatch(slice.map((r) => r[4]));
  vecs.forEach((v, k) => {
    let n = 0;
    for (const x of v) n += x * x;
    n = Math.sqrt(n) || 1;
    const o = (i + k) * DIM;
    for (let d = 0; d < DIM; d++) out[o + d] = Math.max(-127, Math.min(127, Math.round((v[d] / n) * 127)));
  });
  if ((i / BATCH) % 10 === 0) console.log(`  ${Math.min(i + BATCH, rows.length)} / ${rows.length}`);
  await sleep(250);
}

if (!existsSync('data')) mkdirSync('data');
writeFileSync('data/embeddings.bin', Buffer.from(out.buffer));
writeFileSync('data/meta.json', JSON.stringify({ dim: DIM, count: rows.length, model: MODEL, built: new Date().toISOString() }));
console.log('Done. Commit data/embeddings.bin and data/meta.json.');
