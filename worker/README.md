Cloudflare Worker for L'Oréal Routine Builder

What this worker does

- Accepts POST requests with JSON { selected: [...] } where each item is a product object.
- Calls the OpenAI Chat Completions API using the worker's OPENAI_API_KEY environment secret.
- Returns JSON { content: "...", raw: <full-openai-json> }.
- Responds to OPTIONS for CORS so the frontend can call it directly.

Setup & deploy (wrangler v2)

1. Install Wrangler: https://developers.cloudflare.com/workers/cli-wrangler/install

2. Edit `worker/wrangler.toml` and set your `account_id`.

3. Set your OpenAI API key as a secret (do NOT put it in code):

```bash
wrangler secret put OPENAI_API_KEY
# then paste your key when prompted
```

4. Publish:

```bash
wrangler publish --env production
```

5. After publishing, set `WORKER_URL` in your project's `secrets.js` to the published URL, e.g.

```js
const WORKER_URL =
  "https://new-loreal.harma2lj.workers.dev/";
```

Testing locally (quick curl)

```bash
curl -X POST "https://<your-worker>.workers.dev/" \
  -H "Content-Type: application/json" \
  -d '{"selected":[{"name":"Foaming Cleanser","brand":"L\'Oréal","category":"cleanser","description":"Gentle foaming cleanser."}]}'
```

Notes & troubleshooting

- If you see CORS errors in the browser, confirm the worker response includes `Access-Control-Allow-Origin` and other CORS headers (this worker returns `*`).
- Use `wrangler tail` to view worker logs while testing.
- Keep your OPENAI_API_KEY secret and never commit it to the repo.
