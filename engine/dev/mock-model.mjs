// A FAKE OpenAI-compatible model API for local runs (what DEEPSEEK_BASE_URL normally points at), so the direct-model fallback can be
// exercised with no external call. POST /chat/completions returns a customerChat JSON answer; everything else (embeddings) is a 404,
// which the app already treats as "no embeddings, use full-text search". Env: MOCK_MODEL_PORT (18890).
import { createServer } from "node:http";

const port = Number(process.env.MOCK_MODEL_PORT ?? 18890);
createServer((req, res) => {
  req.resume();
  req.on("end", () => {
    if (req.method === "POST" && req.url?.endsWith("/chat/completions")) {
      const content = JSON.stringify({ reply: "Direct model (stub): chào bạn, mình đang hỗ trợ bạn ạ.", lead: null, needs_human: false, reason: null, proposed_answer: null, order: null, payment_claim: false });
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ choices: [{ message: { content } }] }));
    }
    res.writeHead(404).end();
  });
}).listen(port, "127.0.0.1", () => console.log(`[mock-model] listening on http://127.0.0.1:${port}`));
