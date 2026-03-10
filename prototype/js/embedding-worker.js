// ═══════════════════════════════════════════════════
//  嵌入模型 Web Worker
//  模型加载、向量计算、余弦匹配全部在此线程执行，
//  主线程通过 postMessage 通信，UI 不会被阻塞。
// ═══════════════════════════════════════════════════

import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2";

env.allowLocalModels = false;

let extractor = null;
const cache = new Map();

function cosine(a, b) {
  let dot = 0, nA = 0, nB = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; nA += a[i] * a[i]; nB += b[i] * b[i]; }
  return dot / (Math.sqrt(nA) * Math.sqrt(nB));
}

async function embed(text) {
  const key = `query: ${text}`;
  if (cache.has(key)) return cache.get(key);
  const out = await extractor(key, { pooling: "mean", normalize: true });
  const vec = Array.from(out.data);
  cache.set(key, vec);
  return vec;
}

self.onmessage = async (e) => {
  const { type, id } = e.data;

  if (type === "init") {
    try {
      extractor = await pipeline("feature-extraction", "Xenova/multilingual-e5-small", {
        progress_callback: (p) => self.postMessage({ type: "init-progress", ...p }),
      });
      self.postMessage({ type: "init-done", id });
    } catch (err) {
      self.postMessage({ type: "error", id, message: err.message });
    }
  }

  else if (type === "precompute") {
    const { texts } = e.data;
    for (let i = 0; i < texts.length; i++) {
      await embed(texts[i]);
      self.postMessage({ type: "precompute-progress", done: i + 1, total: texts.length });
    }
    self.postMessage({ type: "precompute-done", id });
  }

  else if (type === "findMatch") {
    const { input, candidates } = e.data;
    const inputVec = await embed(input);
    let bestId = null, bestScore = -1, bestTrigger = "";
    const scores = [];

    for (const { id: evId, triggers } of candidates) {
      let evBest = -1, evTrig = "";
      for (const t of (triggers || [])) {
        const tVec = await embed(t);
        const s = cosine(inputVec, tVec);
        if (s > evBest) { evBest = s; evTrig = t; }
      }
      scores.push({ id: evId, score: evBest, trigger: evTrig });
      if (evBest > bestScore) { bestId = evId; bestScore = evBest; bestTrigger = evTrig; }
    }

    scores.sort((a, b) => b.score - a.score);
    self.postMessage({
      type: "match-result",
      id,
      bestId,
      bestScore,
      bestTrigger,
      topMatches: scores.slice(0, 5),
    });
  }
};
