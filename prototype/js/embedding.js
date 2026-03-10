// ═══════════════════════════════════════════════════
//  嵌入模型引擎 — Web Worker 包装器
//  模型推理在后台 Worker 执行，主线程 UI 不阻塞。
//  公共 API 与旧版一致：init / precomputeAll / precomputeRooms / findMatch
// ═══════════════════════════════════════════════════

export class EmbeddingEngine {
  constructor() {
    this._worker = null;
    this._pending = new Map();
    this._msgId = 0;
    this._progressCb = null;
  }

  async init(progressCb) {
    const workerUrl = new URL("./embedding-worker.js", import.meta.url);
    this._worker = new Worker(workerUrl, { type: "module" });

    return new Promise((resolve, reject) => {
      this._worker.onmessage = (e) => {
        const { type } = e.data;
        if (type === "init-progress") {
          progressCb?.(e.data);
        } else if (type === "init-done") {
          this._worker.onmessage = (ev) => this._onMessage(ev);
          resolve();
        } else if (type === "error") {
          reject(new Error(e.data.message));
        }
      };
      this._worker.onerror = (err) => reject(err);
      this._worker.postMessage({ type: "init", id: 0 });
    });
  }

  _nextId() { return ++this._msgId; }

  _send(msg) {
    return new Promise((resolve) => {
      const id = this._nextId();
      this._pending.set(id, resolve);
      this._worker.postMessage({ ...msg, id });
    });
  }

  _onMessage(e) {
    const { type, id } = e.data;

    if (type === "precompute-progress") {
      if (this._progressCb) this._progressCb(e.data.done, e.data.total);
      return;
    }

    const resolve = this._pending.get(id);
    if (resolve) {
      this._pending.delete(id);
      resolve(e.data);
    }
  }

  async precomputeAll(rooms, progressCb) {
    return this.precomputeRooms(Object.values(rooms), progressCb);
  }

  async precomputeRooms(roomList, progressCb) {
    const texts = [];
    for (const room of roomList) {
      for (const ev of (room.events || [])) {
        for (const t of (ev.triggers || [])) texts.push(t);
      }
    }
    if (texts.length === 0) return;
    this._progressCb = progressCb;
    await this._send({ type: "precompute", texts });
    this._progressCb = null;
  }

  async findMatch(input, events) {
    const candidates = events.map((ev) => ({
      id: ev.id,
      triggers: ev.triggers || [],
    }));

    const result = await this._send({ type: "findMatch", input, candidates });

    const matchedEvent = result.bestId
      ? events.find((ev) => ev.id === result.bestId) || null
      : null;

    return {
      event: matchedEvent,
      score: result.bestScore,
      trigger: result.bestTrigger,
      topMatches: result.topMatches || [],
    };
  }

  terminate() {
    if (this._worker) {
      this._worker.terminate();
      this._worker = null;
    }
  }
}
