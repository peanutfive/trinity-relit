// ═══════════════════════════════════════════════════
//  UI 渲染层
// ═══════════════════════════════════════════════════

const $ = (sel) => document.querySelector(sel);
const MAX_LOG_NODES = 500;

export const ui = {
  _append(html) {
    const el = document.createElement("div");
    el.innerHTML = html;
    const out = $("#output");
    out.appendChild(el);

    // 防止长时间游玩后日志 DOM 过大导致滚动和输入卡顿。
    while (out.childNodes.length > MAX_LOG_NODES) {
      out.removeChild(out.firstChild);
    }
    out.scrollTop = out.scrollHeight;
  },

  location(name, cn) {
    this._append(`<div class="location">${name}（${cn}）</div>`);
  },

  text(t) {
    this._append(`<div class="scene-text">${t}</div>`);
  },

  userInput(t) {
    this._append(`<div class="user-input">${t}</div>`);
  },

  system(t) {
    this._append(`<div class="system-msg">${t}</div>`);
  },

  inventory(t) {
    this._append(`<div class="inventory-display">${t}</div>`);
  },

  debug(topMatches) {
    if (!topMatches || topMatches.length === 0) return;
    const lines = topMatches
      .map(m => `${m.id}: ${m.score.toFixed(3)} (← "${m.trigger}")`)
      .join("<br>");
    const vis = ($("#debug-toggle")?.textContent || "").includes("开");
    this._append(`<div class="debug-info ${vis ? "visible" : ""}">${lines}</div>`);
  },

  setLoading(status, pct) {
    const s = $("#loading-status");
    const p = $("#loading-progress");
    if (s) s.textContent = status;
    if (p && pct != null) p.style.width = `${pct}%`;
  },

  hideLoading() {
    const el = $("#loading");
    if (el) el.style.display = "none";
  },

  enableInput(handler) {
    const inp = $("#input");
    inp.disabled = false;
    inp.focus();
    inp.addEventListener("keydown", async (e) => {
      if (e.key !== "Enter") return;
      const val = inp.value.trim();
      if (!val) return;
      inp.value = "";
      inp.disabled = true;
      await handler(val);
      inp.disabled = false;
      inp.focus();
    });
  },
};
