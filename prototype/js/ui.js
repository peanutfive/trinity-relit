// ═══════════════════════════════════════════════════
//  UI 渲染层
// ═══════════════════════════════════════════════════

const $ = (sel) => document.querySelector(sel);
const MAX_LOG_NODES = 500;

// 场景文本里英文原文和中文译文是同一个字符串，以空行分段。站点上两者
// 用亮暗区分（原文亮，译文暗），这里按段落还原同一层次：含汉字的段落
// 视作译文。中文段里夹着 "BBC"、"Broad Walk" 这类拉丁词不影响判断，
// 英文段则不含汉字。
const HAS_CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;

function splitByLanguage(t) {
  return String(t)
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => {
      const lang = HAS_CJK.test(para) ? "zh" : "en";
      return `<div class="scene-text lang-${lang}">${para}</div>`;
    })
    .join("");
}

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
    this._append(splitByLanguage(t));
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
