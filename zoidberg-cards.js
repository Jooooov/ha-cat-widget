/**
 * zoidberg-cards.js — Lovelace cards replicating the Zoidberg web app design.
 *
 * Custom elements registered:
 *   <recovery-score-card>      — circular progress ring with score + label + subtitle
 *   <sleep-breakdown-card>     — sleep ring + total + bedtime + Core/Deep/REM bars
 *   <zoidberg-metric-card>     — icon + label + value + unit + progress + delta + streak
 *   <zoidberg-state-tag-card>  — small mood pill (orange/red/purple/teal/cyan)
 *   <zoidberg-title-card>      — gradient "ZOIDBERG HEALTH" Bangers title + date
 *   <zoidberg-weekly-card>     — weekly pills (workouts / steps / hrv / sleep)
 *
 * All cards are pure HTMLElements (no LitElement dep), small footprint,
 * designed to match Zoidberg web app on a #ffb920 background.
 */

const COMMON = `
  :host { display: block; }
  *, *::before, *::after { box-sizing: border-box; }
  .card {
    background: #ffffff;
    border-radius: 16px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.07);
    border: 2px solid #f0ece8;
    font-family: 'Inter','Segoe UI',system-ui,-apple-system,sans-serif;
    color: #1a1a2e;
    position: relative;
  }
  .label-tiny {
    font-size: 11px;
    font-weight: 700;
    color: #9ca3af;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .muted { color: #6b7280; }
  .streak-badge {
    position: absolute;
    top: -8px;
    right: -8px;
    background: #c084fc;
    color: white;
    border-radius: 10px;
    padding: 2px 7px;
    font-size: 11px;
    font-weight: 700;
    border: 2px solid white;
  }
`;

function fmtSleep(min) {
  if (!min || min <= 0) return "–";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h ${m}m`;
}

function fmtBedtime(hour) {
  if (hour == null || isNaN(hour)) return "–";
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parseSleepHM(value) {
  if (!value) return 0;
  // Accept formats: "7h30", "7h 30m", "8h00", or a raw number of minutes
  const num = parseFloat(value);
  if (!isNaN(num) && String(value).trim() === String(num)) return num; // raw minutes
  const m = String(value).match(/(\d+)\s*h\s*(\d+)?/i);
  if (m) return parseInt(m[1]) * 60 + parseInt(m[2] || 0);
  return num || 0;
}

function num(state) {
  if (state == null) return null;
  const v = parseFloat(state);
  return isFinite(v) ? v : null;
}

// =========================================================================
// 1) RECOVERY SCORE CARD
// =========================================================================
class RecoveryScoreCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }
  setConfig(config) {
    this._config = {
      entity: "sensor.zoidberg_recovery_score",
      ...config,
    };
    this._render();
  }
  set hass(h) { this._hass = h; if (this._config) this._update(); }
  getCardSize() { return 2; }

  _render() {
    if (this.shadowRoot.querySelector(".wrap")) return;
    const style = document.createElement("style");
    style.textContent = COMMON + `
      .wrap { display:flex; align-items:center; gap:20px; padding:20px 24px; min-width:220px; }
      .ring { position:relative; width:80px; height:80px; flex-shrink:0; }
      .score-text {
        position:absolute; top:50%; left:50%;
        transform: translate(-50%,-50%);
        font-size:24px; font-weight:800;
        font-family: 'Bangers', system-ui, sans-serif;
        letter-spacing: 0.5px;
      }
      .meta-label { font-size:11px; font-weight:700; color:#9ca3af; letter-spacing:1px; text-transform:uppercase; }
      .meta-status { font-size:18px; font-weight:700; color:#1a1a2e; margin-top:4px; }
      .meta-sub { font-size:12px; color:#6b7280; margin-top:4px; }
    `;
    const wrap = document.createElement("div");
    wrap.className = "card wrap";
    wrap.innerHTML = `
      <div class="ring">
        <svg width="80" height="80">
          <circle cx="40" cy="40" r="34" fill="none" stroke="#f0ece8" stroke-width="7"/>
          <circle class="ring-fg" cx="40" cy="40" r="34" fill="none" stroke="#22c55e" stroke-width="7"
            stroke-dasharray="213.6" stroke-dashoffset="213.6"
            stroke-linecap="round" transform="rotate(-90 40 40)"
            style="transition: stroke-dashoffset 1s ease, stroke 0.4s ease;"/>
        </svg>
        <div class="score-text">–</div>
      </div>
      <div>
        <div class="meta-label">Recovery Score</div>
        <div class="meta-status">–</div>
        <div class="meta-sub">HRV · Freq. Card. · Sono</div>
      </div>
    `;
    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(wrap);
  }

  _update() {
    if (!this._hass || !this.shadowRoot.querySelector(".wrap")) return;
    const score = num(this._hass.states[this._config.entity]?.state) ?? 0;
    const color = score >= 75 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";
    const label = score >= 75 ? "Pronto para treinar" : score >= 50 ? "Dia de recuperação" : "Descansa hoje";
    const dashOffset = 213.6 * (1 - score / 100);
    this.shadowRoot.querySelector(".ring-fg").style.stroke = color;
    this.shadowRoot.querySelector(".ring-fg").setAttribute("stroke-dashoffset", dashOffset);
    this.shadowRoot.querySelector(".score-text").textContent = Math.round(score);
    this.shadowRoot.querySelector(".score-text").style.color = color;
    this.shadowRoot.querySelector(".meta-status").textContent = label;
    const wrap = this.shadowRoot.querySelector(".wrap");
    wrap.style.borderColor = color + "30";
    wrap.style.borderWidth = "2px";
  }
}
customElements.define("recovery-score-card", RecoveryScoreCard);

// =========================================================================
// 2) SLEEP BREAKDOWN CARD
// =========================================================================
class SleepBreakdownCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }
  setConfig(config) {
    this._config = {
      total_entity: "sensor.zoidberg_sono_total",
      core_entity: "sensor.zoidberg_sono_core",
      deep_entity: "sensor.zoidberg_sono_deep",
      rem_entity: "sensor.zoidberg_sono_rem",
      bedtime_entity: "sensor.zoidberg_hora_deitar",
      sleep_target: 390,
      ...config,
    };
    this._render();
  }
  set hass(h) { this._hass = h; if (this._config) this._update(); }
  getCardSize() { return 3; }

  _render() {
    if (this.shadowRoot.querySelector(".wrap")) return;
    const style = document.createElement("style");
    style.textContent = COMMON + `
      .wrap {
        padding: 16px 18px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-width: 210px;
      }
      .head { display: flex; align-items: center; gap: 12px; }
      .ring { position: relative; width: 56px; height: 56px; flex-shrink: 0; }
      .ring-emoji {
        position: absolute; top: 50%; left: 50%;
        transform: translate(-50%,-50%);
        font-size: 22px;
      }
      .total-text { font-size: 20px; font-weight: 700; color: #1a1a2e; }
      .total-sub { font-size: 12px; color: #6b7280; font-weight: 500; }
      .bedtime { font-size: 11px; color: #9ca3af; margin-top: 2px; }
      .stages { display: flex; flex-direction: column; gap: 5px; }
      .stage-row { display: flex; align-items: center; gap: 8px; }
      .stage-label { font-size: 11px; color: #6b7280; width: 30px; font-weight: 600; }
      .stage-bar { flex: 1; height: 6px; background: #f0ece8; border-radius: 3px; overflow: hidden; position: relative; }
      .stage-fill { height: 100%; border-radius: 3px; transition: width 0.8s ease; }
      .stage-marker { position: absolute; top: 0; bottom: 0; width: 2px; background: #d1d5db; }
      .stage-val { font-size: 11px; width: 38px; text-align: right; }
      .stage-val.met { color: #16a34a; font-weight: 700; }
      .nodata { font-size: 11px; color: #9ca3af; display: flex; align-items: center; gap: 4px; }
    `;
    const wrap = document.createElement("div");
    wrap.className = "card wrap";
    wrap.innerHTML = `
      <div class="head">
        <div class="ring">
          <svg width="56" height="56">
            <circle cx="28" cy="28" r="22" fill="none" stroke="#f0ece8" stroke-width="5"/>
            <circle class="ring-fg" cx="28" cy="28" r="22" fill="none" stroke="#c084fc" stroke-width="5"
              stroke-dasharray="138.2" stroke-dashoffset="138.2"
              stroke-linecap="round" transform="rotate(-90 28 28)"
              style="transition: stroke-dashoffset 0.8s ease;"/>
          </svg>
          <span class="ring-emoji">😴</span>
        </div>
        <div>
          <div class="total-text">–</div>
          <div class="total-sub">Sono Total</div>
          <div class="bedtime"></div>
        </div>
      </div>
      <div class="body"></div>
    `;
    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(wrap);
  }

  _update() {
    if (!this._hass || !this.shadowRoot.querySelector(".wrap")) return;
    const c = this._config;
    const totalMin = parseSleepHM(this._hass.states[c.total_entity]?.state);
    const coreMin = num(this._hass.states[c.core_entity]?.state) || 0;
    const deepMin = num(this._hass.states[c.deep_entity]?.state) || 0;
    const remMin = num(this._hass.states[c.rem_entity]?.state) || 0;
    const bedtimeRaw = this._hass.states[c.bedtime_entity]?.state;
    const bedtimeHour = num(bedtimeRaw);

    const pct = Math.min(1, totalMin / (c.sleep_target || 390));
    const dashOffset = 138.2 * (1 - pct);
    this.shadowRoot.querySelector(".ring-fg").setAttribute("stroke-dashoffset", dashOffset);
    this.shadowRoot.querySelector(".total-text").textContent = fmtSleep(totalMin);
    const bedEl = this.shadowRoot.querySelector(".bedtime");
    if (bedtimeHour != null) {
      bedEl.textContent = `🛏 ${fmtBedtime(bedtimeHour)}`;
    } else if (bedtimeRaw && bedtimeRaw !== "—" && bedtimeRaw !== "unknown") {
      bedEl.textContent = `🛏 ${bedtimeRaw}`;
    } else {
      bedEl.textContent = "";
    }

    // Stages
    const body = this.shadowRoot.querySelector(".body");
    const hasStages = deepMin > 0 || remMin > 0;
    if (hasStages) {
      const stages = [
        { label: "Core", min: coreMin, color: "#a78bfa", target: null },
        { label: "Deep", min: deepMin, color: "#7c3aed", target: 90 },
        { label: "REM", min: remMin, color: "#5b8dee", target: 90 },
      ];
      body.innerHTML = `<div class="stages">${stages.map(s => {
        const pct = Math.min(100, totalMin > 0 ? (s.min / totalMin) * 100 : 0);
        const markerPct = s.target && totalMin > 0 ? Math.min(99, (s.target / totalMin) * 100) : null;
        const met = s.target && s.min >= s.target;
        return `
          <div class="stage-row">
            <div class="stage-label">${s.label}</div>
            <div class="stage-bar">
              <div class="stage-fill" style="width:${pct}%; background:${s.color};"></div>
              ${markerPct != null ? `<div class="stage-marker" style="left:${markerPct}%;"></div>` : ""}
            </div>
            <div class="stage-val ${met ? "met" : ""}">${s.min > 0 ? fmtSleep(s.min) : "–"}</div>
          </div>
        `;
      }).join("")}</div>`;
    } else {
      body.innerHTML = `<div class="nodata"><span>⚠️</span><span>Fases sem dados · Shortcut não envia breakdown</span></div>`;
    }
  }
}
customElements.define("sleep-breakdown-card", SleepBreakdownCard);

// =========================================================================
// 3) ZOIDBERG METRIC CARD (icon + value + progress + delta + streak)
// =========================================================================
class ZoidbergMetricCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }
  setConfig(config) {
    this._config = {
      entity: "",
      label: "",
      icon: "❤️",
      color: "#5b8dee",
      unit: "",
      target: null,
      delta_entity: null,
      delta_label: "vs 7d",
      delta_unit: "",
      streak: 0,
      ...config,
    };
    this._render();
  }
  set hass(h) { this._hass = h; if (this._config) this._update(); }
  getCardSize() { return 1; }

  _render() {
    if (this.shadowRoot.querySelector(".wrap")) return;
    const style = document.createElement("style");
    style.textContent = COMMON + `
      .wrap {
        padding: 14px 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 130px;
      }
      .head { display: flex; align-items: center; gap: 8px; }
      .icon { font-size: 22px; }
      .label { font-size: 11px; font-weight: 700; color: #9ca3af; letter-spacing: 1px; text-transform: uppercase; }
      .value-row { display: flex; align-items: baseline; gap: 4px; }
      .value { font-size: 26px; font-weight: 800; color: #1a1a2e; line-height: 1; }
      .unit { font-size: 13px; color: #6b7280; font-weight: 600; }
      .delta { font-size: 11px; color: #6b7280; }
      .delta.up { color: #16a34a; }
      .delta.down { color: #ef4444; }
      .progress-bar { height: 4px; background: #f0ece8; border-radius: 2px; overflow: hidden; }
      .progress-fill { height: 100%; border-radius: 2px; transition: width 0.8s ease; }
    `;
    const wrap = document.createElement("div");
    wrap.className = "card wrap";
    wrap.innerHTML = `
      <div class="head">
        <span class="icon"></span>
        <span class="label"></span>
        <span class="streak-badge" hidden></span>
      </div>
      <div class="value-row">
        <span class="value">–</span>
        <span class="unit"></span>
      </div>
      <div class="delta"></div>
      <div class="progress-bar"><div class="progress-fill"></div></div>
    `;
    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(wrap);
  }

  _update() {
    if (!this._hass || !this.shadowRoot.querySelector(".wrap")) return;
    const c = this._config;
    const raw = this._hass.states[c.entity]?.state;
    const v = num(raw);
    const unit = c.unit || (this._hass.states[c.entity]?.attributes?.unit_of_measurement || "");

    this.shadowRoot.querySelector(".icon").textContent = c.icon;
    this.shadowRoot.querySelector(".label").textContent = c.label;
    this.shadowRoot.querySelector(".value").textContent = v != null ? Math.round(v).toLocaleString("pt-PT") : (raw || "–");
    this.shadowRoot.querySelector(".unit").textContent = unit;

    // Delta
    let deltaText = "";
    let deltaClass = "";
    if (c.delta_entity && v != null) {
      const baseline = num(this._hass.states[c.delta_entity]?.state);
      if (baseline != null && baseline > 0) {
        const d = Math.round(v - baseline);
        deltaText = `${d >= 0 ? "+" : ""}${d}${c.delta_unit || unit} ${c.delta_label}`;
        deltaClass = d >= 0 ? "up" : "down";
      }
    }
    const deltaEl = this.shadowRoot.querySelector(".delta");
    deltaEl.textContent = deltaText;
    deltaEl.className = "delta " + deltaClass;

    // Progress
    const pf = this.shadowRoot.querySelector(".progress-fill");
    if (c.target && v != null && c.target > 0) {
      const pct = Math.min(100, (v / c.target) * 100);
      pf.style.width = pct + "%";
      pf.style.background = c.color;
    } else {
      pf.style.width = "100%";
      pf.style.background = c.color;
      pf.style.opacity = "0.3";
    }

    // Streak
    const sb = this.shadowRoot.querySelector(".streak-badge");
    if (c.streak > 0) {
      sb.textContent = `🔥${c.streak}`;
      sb.hidden = false;
    } else {
      sb.hidden = true;
    }
  }
}
customElements.define("zoidberg-metric-card", ZoidbergMetricCard);

// =========================================================================
// 4) ZOIDBERG STATE TAG
// =========================================================================
const STATE_COLORS = {
  idle: "#cc8800", happy: "#cc8800", neutral: "#cc8800",
  pumped: "#cc3800",
  tired: "#5a4880",
  sick: "#4a8070",
  zen: "#3a9ab0",
};

// Shared cache — only fetch Zoidberg API once across all instances
let _zoidbergStatePromise = null;
let _zoidbergStateData = null;
let _zoidbergStateFetchedAt = 0;

async function fetchZoidbergState(apiUrl) {
  const now = Date.now();
  // Cache for 60s
  if (_zoidbergStateData && (now - _zoidbergStateFetchedAt) < 60000) {
    return _zoidbergStateData;
  }
  if (_zoidbergStatePromise) return _zoidbergStatePromise;
  _zoidbergStatePromise = fetch(apiUrl, { mode: "cors" })
    .then(r => r.ok ? r.json() : null)
    .then(d => {
      _zoidbergStateData = d?.state || null;
      _zoidbergStateFetchedAt = Date.now();
      _zoidbergStatePromise = null;
      return _zoidbergStateData;
    })
    .catch(e => { _zoidbergStatePromise = null; console.warn("[zoidberg] fetch failed:", e); return null; });
  return _zoidbergStatePromise;
}

class ZoidbergStateTag extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }
  setConfig(config) {
    this._config = {
      mood_entity: "sensor.zoidberg_mood",
      label_entity: null,
      api_url: config.api_url || "http://76.13.66.197:8787/api/today",
      ...config,
    };
    this._render();
    // Fetch state from API
    this._fetchAndUpdate();
    // Refresh every 5 min
    if (this._refreshInterval) clearInterval(this._refreshInterval);
    this._refreshInterval = setInterval(() => this._fetchAndUpdate(), 5 * 60 * 1000);
  }
  set hass(h) { this._hass = h; if (this._config) this._update(); }
  getCardSize() { return 1; }

  async _fetchAndUpdate() {
    if (!this._config?.api_url) return;
    const state = await fetchZoidbergState(this._config.api_url);
    if (state) {
      this._apiState = state;
      this._update();
    }
  }

  disconnectedCallback() {
    if (this._refreshInterval) clearInterval(this._refreshInterval);
  }

  _render() {
    if (this.shadowRoot.querySelector(".tag")) return;
    const style = document.createElement("style");
    style.textContent = `
      :host { display:inline-block; }
      .tag {
        background: #5b8dee;
        color: white;
        padding: 6px 16px;
        border-radius: 999px;
        font: 700 13px/1.2 'Inter','Segoe UI',sans-serif;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        display: inline-block;
        transition: background 0.4s ease;
      }
    `;
    const tag = document.createElement("div");
    tag.className = "tag";
    tag.textContent = "–";
    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(tag);
  }

  _computeState() {
    // PREFER API state if available (has true state.label like "Sedentário")
    if (this._apiState && this._apiState.label) {
      return {
        label: this._apiState.label.toUpperCase(),
        mood: (this._apiState.mood || "neutral").toLowerCase(),
      };
    }
    if (!this._hass) return { label: "—", mood: "neutral" };
    const s = (e) => parseFloat(this._hass.states[e]?.state);
    const recovery = s("sensor.zoidberg_recovery_score");
    const battery = s("sensor.zoidberg_body_battery");
    const hrv = s("sensor.zoidberg_hrv");
    const rhr = s("sensor.zoidberg_rhr");
    const sleep = s("sensor.zoidberg_sono_eficiencia");
    const passos = s("sensor.zoidberg_passos");
    const calorias = s("sensor.zoidberg_calorias");
    const mental = s("sensor.zoidberg_mental");
    const stress = (this._hass.states["sensor.zoidberg_stress"]?.state || "").toLowerCase();
    const moodRaw = (this._hass.states["sensor.zoidberg_mood"]?.state || "").toLowerCase();

    // Mirror Zoidberg backend state logic (priority order)
    if (rhr > 75 && rhr - 65 > 10) return { label: "RESSACA", mood: "sick" };
    if (stress === "high" || stress === "alto") return { label: "STRESSADO", mood: "sick" };
    if (recovery < 30) return { label: "EXAUSTO", mood: "tired" };
    if (battery < 30) return { label: "SEM ENERGIA", mood: "tired" };
    if (sleep > 0 && sleep < 70) return { label: "MAL DORMIDO", mood: "tired" };
    if (hrv >= 55 && battery >= 75 && recovery >= 75) return { label: "PUMPED", mood: "pumped" };
    if (passos > 0 && passos < 3000 && calorias < 200) return { label: "SEDENTÁRIO", mood: "tired" };
    if (mental >= 85 && battery >= 60) return { label: "EM FOCO", mood: "pumped" };
    if (sleep >= 90 || moodRaw === "calm" || moodRaw === "zen") return { label: "ZEN", mood: "zen" };
    if (recovery >= 75) return { label: "RECUPERADO", mood: "pumped" };
    return { label: "NEUTRAL", mood: "neutral" };
  }

  _update() {
    if (!this._hass) return;
    const { label, mood } = this._computeState();
    const color = STATE_COLORS[mood] || "#5b8dee";
    const tag = this.shadowRoot.querySelector(".tag");
    if (tag) {
      tag.style.background = color;
      tag.textContent = label;
    }
  }
}
customElements.define("zoidberg-state-tag-card", ZoidbergStateTag);

// =========================================================================
// 5) ZOIDBERG TITLE — "ZOIDBERG HEALTH" gradient + date
// =========================================================================
class ZoidbergTitleCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }
  setConfig(config) {
    this._config = { title: "ZOIDBERG HEALTH", ...config };
    this._render();
  }
  set hass(h) { this._hass = h; if (this._config) this._updateDate(); }
  getCardSize() { return 2; }

  _render() {
    if (this.shadowRoot.querySelector(".title")) return;
    const style = document.createElement("style");
    style.textContent = `
      :host { display: block; text-align: center; }
      .title-wrap { display: inline-block; }
      .title {
        font: 400 64px/0.95 'Bangers','Bungee','Comic Sans MS',cursive;
        letter-spacing: 3px;
        margin: 0;
        background: linear-gradient(160deg, #fff700 0%, #ff3cac 50%, #00d4ff 100%);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        -webkit-text-stroke: 2.5px #1a0030;
        filter: drop-shadow(3px 4px 0px #1a0030) drop-shadow(0 0 18px rgba(255,60,172,0.6));
        transform: rotate(-1.5deg);
        display: inline-block;
        transition: filter 0.3s ease;
      }
      .date {
        color: #6b7280;
        font: 500 13px 'Inter','Segoe UI',sans-serif;
        margin-top: 6px;
      }
      @import url('https://fonts.googleapis.com/css2?family=Bangers&display=swap');
    `;
    // Need to actually load the font in the document head, not just inside shadow root
    if (!document.head.querySelector('link[data-zoidberg-font]')) {
      const fontLink = document.createElement('link');
      fontLink.rel = 'stylesheet';
      fontLink.href = 'https://fonts.googleapis.com/css2?family=Bangers&display=swap';
      fontLink.dataset.zoidbergFont = '1';
      document.head.appendChild(fontLink);
    }
    const wrap = document.createElement("div");
    wrap.className = "title-wrap";
    wrap.innerHTML = `<h1 class="title">${this._config.title}</h1><div class="date"></div>`;
    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(wrap);
    this._updateDate();
  }

  _updateDate() {
    const dateEl = this.shadowRoot.querySelector(".date");
    if (!dateEl) return;
    const now = new Date();
    dateEl.textContent = now.toLocaleDateString("pt-PT", {
      weekday: "long", day: "numeric", month: "long",
    });
  }
}
customElements.define("zoidberg-title-card", ZoidbergTitleCard);

// =========================================================================
// 6) ZOIDBERG WEEKLY SUMMARY
// =========================================================================
class ZoidbergWeeklyCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }
  setConfig(config) {
    this._config = {
      workouts_entity: "sensor.zoidberg_treinos_semana",
      steps_week_entity: "sensor.zoidberg_passos_semana",
      hrv_week_entity: "sensor.zoidberg_hrv_semana",
      sleep_week_entity: "sensor.zoidberg_sono_semana",
      ...config,
    };
    this._render();
  }
  set hass(h) { this._hass = h; if (this._config) this._update(); }
  getCardSize() { return 2; }

  _render() {
    if (this.shadowRoot.querySelector(".wrap")) return;
    const style = document.createElement("style");
    style.textContent = COMMON + `
      .wrap { padding: 16px 24px; max-width: 720px; margin: 0 auto; }
      .head-label { font-size: 13px; font-weight: 700; color: #6b7280; margin-bottom: 12px; }
      .pills { display: flex; gap: 10px; flex-wrap: wrap; }
      .pill {
        display: flex; align-items: center; gap: 6px;
        background: #f5f0eb;
        border-radius: 10px;
        padding: 6px 12px;
        font-size: 14px;
      }
      .pill .ico { font-size: 16px; }
      .pill .txt { font-weight: 600; color: #1a1a2e; }
    `;
    const wrap = document.createElement("div");
    wrap.className = "card wrap";
    wrap.innerHTML = `
      <div class="head-label">ESTA SEMANA</div>
      <div class="pills"></div>
    `;
    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(wrap);
  }

  _update() {
    if (!this._hass) return;
    const c = this._config;
    const workouts = num(this._hass.states[c.workouts_entity]?.state);
    const stepsW = num(this._hass.states[c.steps_week_entity]?.state);
    const hrvW = num(this._hass.states[c.hrv_week_entity]?.state);
    const sleepW = parseSleepHM(this._hass.states[c.sleep_week_entity]?.state);

    const pills = [];
    if (workouts != null) pills.push({ icon: "🏋️", txt: `${workouts} treino${workouts !== 1 ? "s" : ""}` });
    if (stepsW != null && stepsW > 0) pills.push({ icon: "👟", txt: `${(stepsW / 1000).toFixed(1)}k passos` });
    if (hrvW != null && hrvW > 0) pills.push({ icon: "💚", txt: `HRV ${Math.round(hrvW)}ms` });
    if (sleepW > 0) pills.push({ icon: "😴", txt: fmtSleep(sleepW) });

    const pillsEl = this.shadowRoot.querySelector(".pills");
    pillsEl.innerHTML = pills.map(p => `
      <div class="pill"><span class="ico">${p.icon}</span><span class="txt">${p.txt}</span></div>
    `).join("");
  }
}
customElements.define("zoidberg-weekly-card", ZoidbergWeeklyCard);

// =========================================================================
// 7) ZOIDBERG SPEECH BUBBLE — comic-book style with typewriter
// =========================================================================
class ZoidbergSpeechBubble extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._lastText = "";
    this._typingTimer = null;
  }
  setConfig(config) {
    this._config = {
      entity: "sensor.zoidberg_commentary",
      label: "ZOIDBERG DIZ",
      tail: "left", // left = pointing to cat on the right
      typewriter: true,
      ...config,
    };
    this._render();
  }
  set hass(h) { this._hass = h; if (this._config) this._update(); }
  getCardSize() { return 2; }

  _render() {
    if (this.shadowRoot.querySelector(".bubble")) return;
    const tailLeft = this._config.tail === "left";
    const style = document.createElement("style");
    style.textContent = `
      :host { display: block; }
      .bubble {
        position: relative;
        background: #ffffff;
        border: 3px solid #1a1a2e;
        border-radius: 18px;
        padding: 14px 18px;
        font: 500 14px/1.5 'Inter','Segoe UI',sans-serif;
        color: #1a1a2e;
        box-shadow: 3px 3px 0 #1a1a2e;
        max-width: 320px;
      }
      .label {
        font-size: 10px; font-weight: 800; color: #9ca3af;
        letter-spacing: 1.2px; text-transform: uppercase;
        margin-bottom: 6px;
      }
      .text { min-height: 1.5em; }
      .text::after {
        content: '|';
        opacity: 0;
        animation: blink 1s steps(1) infinite;
        color: #6b7280;
      }
      .text.done::after { display: none; }
      @keyframes blink { 50% { opacity: 1; } }

      /* Comic-style tail */
      .bubble::before, .bubble::after {
        content: '';
        position: absolute;
        top: 60%;
        ${tailLeft ? 'left: -18px;' : 'right: -18px;'}
        border-style: solid;
      }
      .bubble::before {
        border-width: 12px 18px 12px 0;
        ${tailLeft
          ? 'border-color: transparent #1a1a2e transparent transparent;'
          : 'border-width: 12px 0 12px 18px; border-color: transparent transparent transparent #1a1a2e;'}
      }
      .bubble::after {
        ${tailLeft ? 'left: -13px;' : 'right: -13px;'}
        border-width: 9px 14px 9px 0;
        ${tailLeft
          ? 'border-color: transparent #ffffff transparent transparent;'
          : 'border-width: 9px 0 9px 14px; border-color: transparent transparent transparent #ffffff;'}
      }
    `;
    const wrap = document.createElement("div");
    wrap.className = "bubble";
    wrap.innerHTML = `
      <div class="label">${this._config.label}</div>
      <div class="text"></div>
    `;
    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(wrap);
  }

  _update() {
    if (!this._hass) return;
    const text = this._hass.states[this._config.entity]?.state || "—";
    if (text === this._lastText) return;
    this._lastText = text;
    const textEl = this.shadowRoot.querySelector(".text");
    if (!textEl) return;
    if (!this._config.typewriter) {
      textEl.textContent = text;
      textEl.classList.add("done");
      return;
    }
    if (this._typingTimer) clearInterval(this._typingTimer);
    textEl.textContent = "";
    textEl.classList.remove("done");
    let i = 0;
    this._typingTimer = setInterval(() => {
      if (i >= text.length) {
        clearInterval(this._typingTimer);
        textEl.classList.add("done");
        return;
      }
      textEl.textContent = text.slice(0, ++i);
    }, 28);
  }
}
customElements.define("zoidberg-speech-bubble-card", ZoidbergSpeechBubble);

// =========================================================================
// 8) ZOIDBERG MINI METRIC — compact card for body-part anchoring
// =========================================================================
class ZoidbergMiniMetric extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }
  setConfig(config) {
    this._config = {
      entity: "",
      label: "",
      icon: "•",
      color: "#5b8dee",
      unit: "",
      compact: true,
      ...config,
    };
    this._render();
  }
  set hass(h) { this._hass = h; if (this._config) this._update(); }
  getCardSize() { return 1; }

  _render() {
    if (this.shadowRoot.querySelector(".mini")) return;
    const style = document.createElement("style");
    style.textContent = `
      :host { display: block; }
      .mini {
        background: #ffffff;
        border-radius: 14px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.10);
        padding: 10px 14px;
        font-family: 'Inter','Segoe UI',sans-serif;
        color: #1a1a2e;
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
        border: 2px solid #f0ece8;
      }
      .icon {
        font-size: 22px;
        flex-shrink: 0;
      }
      .col { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
      .label {
        font-size: 9px;
        font-weight: 800;
        color: #9ca3af;
        letter-spacing: 1.2px;
        text-transform: uppercase;
      }
      .value-row { display: flex; align-items: baseline; gap: 3px; }
      .value {
        font-size: 18px;
        font-weight: 800;
        color: #1a1a2e;
        line-height: 1;
      }
      .unit {
        font-size: 11px;
        color: #6b7280;
        font-weight: 600;
      }
    `;
    const wrap = document.createElement("div");
    wrap.className = "mini";
    wrap.innerHTML = `
      <span class="icon"></span>
      <div class="col">
        <span class="label"></span>
        <div class="value-row">
          <span class="value">–</span>
          <span class="unit"></span>
        </div>
      </div>
    `;
    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(wrap);
  }

  _update() {
    if (!this._hass) return;
    const c = this._config;
    const raw = this._hass.states[c.entity]?.state;
    const v = num(raw);
    const unit = c.unit || (this._hass.states[c.entity]?.attributes?.unit_of_measurement || "");
    this.shadowRoot.querySelector(".icon").textContent = c.icon;
    this.shadowRoot.querySelector(".label").textContent = c.label;
    this.shadowRoot.querySelector(".value").textContent = v != null ? Math.round(v).toLocaleString("pt-PT") : (raw || "–");
    this.shadowRoot.querySelector(".unit").textContent = unit;
    this.shadowRoot.querySelector(".icon").style.color = c.color;
    // Subtle accent border bottom
    const wrap = this.shadowRoot.querySelector(".mini");
    wrap.style.borderColor = c.color + "30";
  }
}
customElements.define("zoidberg-mini-metric", ZoidbergMiniMetric);

// =========================================================================
// 9) ZOIDBERG RING — Apple Activity-style ring with icon + value
// =========================================================================
class ZoidbergRing extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }
  setConfig(config) {
    this._config = {
      entity: "",
      label: "",
      icon: "•",
      color: "#5b8dee",
      track_color: "#1a0030",
      unit: "",
      target: 100,
      size: 120,
      stroke: 14,
      ...config,
    };
    this._render();
    // Defensive: in case hass was set BEFORE setConfig
    if (this._hass) this._update();
  }
  set hass(h) {
    this._hass = h;
    if (this._config) this._update();
  }
  getCardSize() { return 1; }

  _render() {
    if (this.shadowRoot.querySelector(".ring-wrap")) return;
    const c = this._config;
    const r = (c.size - c.stroke) / 2;
    const circ = 2 * Math.PI * r;
    const cx = c.size / 2;
    const cy = c.size / 2;
    const style = document.createElement("style");
    style.textContent = `
      :host { display: block; }
      .ring-wrap {
        position: relative;
        width: ${c.size}px;
        height: ${c.size}px;
        font-family: 'Inter','Segoe UI',sans-serif;
        filter: drop-shadow(0 4px 10px rgba(0,0,0,0.15));
      }
      .ring-svg { position: absolute; inset: 0; }
      .ring-icon {
        position: absolute; top: 26%; left: 50%;
        transform: translate(-50%, 0);
        font-size: ${Math.round(c.size * 0.28)}px;
        line-height: 1;
      }
      .ring-value {
        position: absolute; top: 51%; left: 50%;
        transform: translate(-50%, 0);
        font-size: ${Math.round(c.size * 0.18)}px;
        font-weight: 800;
        color: #1a0030;
        letter-spacing: -0.5px;
      }
      .ring-unit {
        position: absolute; top: 73%; left: 50%;
        transform: translate(-50%, 0);
        font-size: ${Math.round(c.size * 0.085)}px;
        font-weight: 700;
        color: ${c.color};
        text-transform: uppercase;
        letter-spacing: 1px;
      }
    `;
    const wrap = document.createElement("div");
    wrap.className = "ring-wrap";
    wrap.innerHTML = `
      <svg class="ring-svg" width="${c.size}" height="${c.size}" viewBox="0 0 ${c.size} ${c.size}">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
          stroke="${c.color}" stroke-width="${c.stroke}" stroke-linecap="round"
          opacity="0.18"/>
        <circle class="ring-fg" cx="${cx}" cy="${cy}" r="${r}" fill="none"
          stroke="${c.color}" stroke-width="${c.stroke}" stroke-linecap="round"
          stroke-dasharray="${circ}" stroke-dashoffset="${circ}"
          transform="rotate(-90 ${cx} ${cy})"
          style="transition: stroke-dashoffset 1s ease;"/>
      </svg>
      <div class="ring-icon">${c.icon}</div>
      <div class="ring-value">–</div>
      <div class="ring-unit">${c.label}</div>
    `;
    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(wrap);
    this._circ = circ;
  }

  _update() {
    const c = this._config;
    if (!this._hass) {
      console.log(`[zoidberg-ring:${c.entity}] no hass yet`);
      return;
    }
    const ent = this._hass.states[c.entity];
    const raw = ent?.state;
    const v = num(raw);
    console.log(`[zoidberg-ring:${c.entity}] raw=${raw} parsed=${v} target=${c.target}`);

    const target = c.target || 100;
    const pct = v != null ? Math.max(0, Math.min(1.05, v / target)) : 0;
    const offset = this._circ * (1 - Math.min(1, pct));
    const fg = this.shadowRoot.querySelector(".ring-fg");
    if (fg) fg.setAttribute("stroke-dashoffset", offset);

    const valEl = this.shadowRoot.querySelector(".ring-value");
    if (valEl) {
      const display = v != null
        ? Math.round(v).toLocaleString("pt-PT")
        : (raw && raw !== "unavailable" && raw !== "unknown" ? raw : "–");
      valEl.textContent = display;
    } else {
      console.warn(`[zoidberg-ring] .ring-value not found for ${c.entity}`);
    }
  }
}
customElements.define("zoidberg-ring", ZoidbergRing);

// =========================================================================
// 10) ZOIDBERG ANATOMY — single card combining cat + rings + connector lines
// =========================================================================
class ZoidbergAnatomy extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }
  setConfig(config) {
    this._config = {
      bg: "#ffb920",
      riv_url: "https://cdn.jsdelivr.net/gh/Jooooov/ha-cat-widget@main/cat.riv",
      // Each ring: { id, side: 'left'|'right', y_pct, anchor_x, anchor_y, ...ring config }
      rings: [
        { id: "sleep",  side: "left",  y: 16, anchor_x: 50, anchor_y: 22, entity: "sensor.zoidberg_sono_eficiencia", label: "Sleep", icon: "😴", color: "#7c3aed", target: 100, unit: "%" },
        { id: "hrv",    side: "left",  y: 40, anchor_x: 50, anchor_y: 50, entity: "sensor.zoidberg_hrv", label: "HRV", icon: "❤️", color: "#5b8dee", target: 60, unit: "ms" },
        { id: "rhr",    side: "left",  y: 60, anchor_x: 50, anchor_y: 56, entity: "sensor.zoidberg_rhr", label: "RHR", icon: "💗", color: "#ff6b6b", target: 80, unit: "bpm" },
        { id: "battery",side: "left",  y: 80, anchor_x: 50, anchor_y: 65, entity: "sensor.zoidberg_body_battery", label: "Battery", icon: "🔋", color: "#fb923c", target: 100, unit: "%" },

        { id: "mental",   side: "right", y: 16, anchor_x: 50, anchor_y: 18, entity: "sensor.zoidberg_mental", label: "Mental", icon: "🧠", color: "#42a5f5", target: 100, unit: "%" },
        { id: "alertness",side: "right", y: 36, anchor_x: 56, anchor_y: 26, entity: "sensor.zoidberg_alertness_score", label: "Alert", icon: "👁️", color: "#a78bfa", target: 100, unit: "%" },
        { id: "calorias", side: "right", y: 60, anchor_x: 50, anchor_y: 65, entity: "sensor.zoidberg_calorias", label: "Cal", icon: "🔥", color: "#fb923c", target: 600, unit: "kcal" },
        { id: "passos",   side: "right", y: 80, anchor_x: 50, anchor_y: 88, entity: "sensor.zoidberg_passos", label: "Steps", icon: "👟", color: "#6bcb77", target: 8000, unit: "" },
      ],
      // Cat cx/cy in % (anchor reference)
      cat_x: 50, cat_y: 55,
      cat_w: 36,  // % of width
      cat_h: 75,  // % of height
      ring_size: 96,
      ...config,
    };
    this._render();
  }
  set hass(h) { this._hass = h; if (this._config) this._propagate(); }
  getCardSize() { return 8; }

  _render() {
    if (this.shadowRoot.querySelector(".anatomy")) return;
    const c = this._config;
    const style = document.createElement("style");
    style.textContent = `
      :host { display: block; }
      .anatomy {
        position: relative;
        width: 100%;
        height: 720px;
        background: ${c.bg};
        border-radius: 28px;
        border: none;
        box-shadow: 0 6px 24px rgba(0,0,0,0.10);
        overflow: hidden;
        font-family: 'Inter','Segoe UI',sans-serif;
      }
      .connectors {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }
      .connectors line {
        stroke: rgba(26, 0, 48, 0.35);
        stroke-width: 2;
        stroke-dasharray: 4 5;
      }
      .connectors circle.endpoint {
        fill: #1a0030;
      }
      .ring-slot {
        position: absolute;
      }
      .ring-slot.left  { left:  3%; }
      .ring-slot.right { right: 3%; }
      .ring-slot.left[data-id]  { transform: translateY(-50%); }
      .ring-slot.right[data-id] { transform: translateY(-50%); }
      .cat-host {
        position: absolute;
        top: ${c.cat_y}%; left: ${c.cat_x}%;
        width: ${c.cat_w}%; height: ${c.cat_h}%;
        transform: translate(-50%, -50%);
      }
      .top-extras {
        position: absolute;
        top: 16px; left: 50%;
        transform: translate(-50%, 0);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        z-index: 5;
      }
      .bottom-extras {
        position: absolute;
        bottom: 14px; left: 50%;
        transform: translate(-50%, 0);
      }
      .speech-host {
        position: absolute;
        bottom: 14px; right: 3%;
        max-width: 260px;
      }
    `;
    const wrap = document.createElement("div");
    wrap.className = "anatomy";

    // Build connectors SVG
    const connSvg = `<svg class="connectors" viewBox="0 0 100 100" preserveAspectRatio="none"
      style="width:100%; height:100%;">
      ${c.rings.map(r => {
        const ringCx = r.side === "left" ? 12 : 88;
        const ringCy = r.y;
        return `
          <line x1="${ringCx}" y1="${ringCy}" x2="${r.anchor_x}" y2="${r.anchor_y}"
                vector-effect="non-scaling-stroke"/>
          <circle class="endpoint" cx="${r.anchor_x}" cy="${r.anchor_y}" r="0.6" vector-effect="non-scaling-stroke"/>
        `;
      }).join("")}
    </svg>`;

    // Cat host
    const catHost = `
      <div class="cat-host">
        <cat-widget-card id="cat-inner"></cat-widget-card>
      </div>
    `;

    // Ring slots
    const ringSlots = c.rings.map(r => {
      const sideClass = r.side;
      return `<div class="ring-slot ${sideClass}" style="top:${r.y}%;" data-id="${r.id}"></div>`;
    }).join("");

    // Top extras: state tag + recovery
    const topExtras = `
      <div class="top-extras">
        <zoidberg-state-tag-card id="state-tag"></zoidberg-state-tag-card>
      </div>
    `;

    // Speech bubble bottom-right
    const speech = `
      <div class="speech-host">
        <zoidberg-speech-bubble-card id="bubble"></zoidberg-speech-bubble-card>
      </div>
    `;

    wrap.innerHTML = connSvg + catHost + ringSlots + topExtras + speech;
    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(wrap);

    // Configure subcomponents
    const cat = this.shadowRoot.getElementById("cat-inner");
    if (cat) {
      cat.setConfig({
        riv_url: c.riv_url,
        bg_color: "transparent",
        show_badge: false,
        debug: false,
      });
    }
    const stateTag = this.shadowRoot.getElementById("state-tag");
    if (stateTag) stateTag.setConfig({});
    const bubble = this.shadowRoot.getElementById("bubble");
    if (bubble) bubble.setConfig({ tail: "right" });

    // Mount rings into slots
    c.rings.forEach(r => {
      const slot = this.shadowRoot.querySelector(`[data-id="${r.id}"]`);
      if (!slot) return;
      const ring = document.createElement("zoidberg-ring");
      ring.setConfig({
        entity: r.entity,
        label: r.label,
        icon: r.icon,
        color: r.color,
        target: r.target,
        unit: r.unit,
        size: c.ring_size,
        stroke: 12,
      });
      slot.appendChild(ring);
    });

    this._propagate();
  }

  _propagate() {
    if (!this._hass) return;
    const all = [
      this.shadowRoot.getElementById("cat-inner"),
      this.shadowRoot.getElementById("state-tag"),
      this.shadowRoot.getElementById("bubble"),
      ...this.shadowRoot.querySelectorAll("zoidberg-ring"),
    ].filter(Boolean);
    for (const el of all) el.hass = this._hass;
  }
}
customElements.define("zoidberg-anatomy-card", ZoidbergAnatomy);

// =========================================================================
// Lovelace card-picker registration
// =========================================================================
window.customCards = window.customCards || [];
[
  { type: "recovery-score-card", name: "Zoidberg · Recovery Score", description: "Circular ring with recovery score + status label." },
  { type: "sleep-breakdown-card", name: "Zoidberg · Sleep Breakdown", description: "Sleep ring + bedtime + Core/Deep/REM bars." },
  { type: "zoidberg-metric-card", name: "Zoidberg · Metric", description: "Generic metric with progress bar, delta vs baseline, streak." },
  { type: "zoidberg-state-tag-card", name: "Zoidberg · State Tag", description: "Mood-colored pill tag." },
  { type: "zoidberg-title-card", name: "Zoidberg · Title", description: "Bangers gradient title + date." },
  { type: "zoidberg-weekly-card", name: "Zoidberg · Weekly Summary", description: "Weekly pills (workouts, steps, HRV, sleep)." },
  { type: "zoidberg-speech-bubble-card", name: "Zoidberg · Speech Bubble", description: "Comic-style bubble with typewriter effect." },
  { type: "zoidberg-mini-metric", name: "Zoidberg · Mini Metric", description: "Compact metric for body-part anchoring." },
  { type: "zoidberg-ring", name: "Zoidberg · Activity Ring", description: "Apple-style activity ring." },
  { type: "zoidberg-anatomy-card", name: "Zoidberg · Anatomy", description: "Cat in center + activity rings + connector lines pointing at body parts." },
].forEach(c => window.customCards.push({ ...c, preview: false }));

console.info(
  "%c ZOIDBERG-CARDS %c v1.0.0 ",
  "color:#FFD23F;background:#0B1226;padding:2px 6px;border-radius:3px",
  "color:#fff;background:#1B2543;padding:2px 6px;border-radius:3px"
);
