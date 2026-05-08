/**
 * cat-widget-card — Reactive Rive cat for Home Assistant Lovelace.
 * Reuses cat.riv from Zoidberg web app.
 *
 * Mood mapping based on HA entities → Rive state machine inputs:
 *   pumped:  HRV ≥ 50 AND body_battery ≥ 70
 *   tired:   body_battery < 30 OR recovery < 30
 *   sick:    high VOC at WC OR shower-related stress
 *   zen:     sono_eficiencia ≥ 90 (calm)
 *   idle:    default
 *
 * Install:
 *   1. Upload this file + cat.riv to /config/www/community/cat-widget/
 *   2. Add resource: /local/community/cat-widget/cat-widget-card.js (JS module)
 *   3. Add card type: custom:cat-widget-card with optional entity overrides
 */

const RIVE_CDN = "https://unpkg.com/@rive-app/canvas@2.32.0/rive.js";

// --- Module-level Rive loader (singleton) ---
let _riveLoadPromise = null;
function loadRive() {
  if (_riveLoadPromise) return _riveLoadPromise;
  _riveLoadPromise = new Promise((resolve, reject) => {
    if (window.rive) return resolve(window.rive);
    const s = document.createElement("script");
    s.src = RIVE_CDN;
    s.onload = () => resolve(window.rive);
    s.onerror = () => reject(new Error("Failed to load Rive runtime"));
    document.head.appendChild(s);
  });
  return _riveLoadPromise;
}

const MOOD_INDEX = { idle: 0, pumped: 1, tired: 2, sick: 3, zen: 4 };
const MOOD_SPEED = { idle: 1.0, pumped: 1.9, tired: 0.22, sick: 0.6, zen: 0.28 };
const MOOD_EYELID = { idle: 0, pumped: 0, tired: 0.88, sick: 0.45, zen: 0.9 };
const MOOD_FILTER = {
  idle: "none",
  pumped: "saturate(1.4) brightness(1.1)",
  tired: "saturate(0.2) brightness(0.75) contrast(0.9)",
  sick: "saturate(0.7) hue-rotate(60deg) brightness(0.95)",
  zen: "saturate(0.8) hue-rotate(-20deg) brightness(1.05)",
};

class CatWidgetCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._rive = null;
    this._mood = "idle";
    this._inputs = {};
    this._lastMood = null;
  }

  setConfig(config) {
    this._config = {
      riv_url: config.riv_url || "/local/community/cat-widget/cat.riv",
      hrv_entity: config.hrv_entity || "sensor.zoidberg_hrv",
      battery_entity: config.battery_entity || "sensor.zoidberg_body_battery",
      recovery_entity: config.recovery_entity || "sensor.zoidberg_recovery_score",
      sleep_eff_entity: config.sleep_eff_entity || "sensor.zoidberg_sono_eficiencia",
      mood_entity: config.mood_entity || "sensor.zoidberg_mood",
      shower_entity: config.shower_entity || "binary_sensor.chuveiro_activo",
      voc_entity: config.voc_entity || "sensor.gas_sensor_compostos_organicos_volateis",
      bg: config.bg || "transparent",
      ...config,
    };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._updateMood();
  }

  getCardSize() {
    return 6;
  }

  _render() {
    if (this.shadowRoot.querySelector("canvas")) return;
    const style = document.createElement("style");
    style.textContent = `
      :host { display: block; width: 100%; height: 100%; }
      .stage {
        position: relative;
        width: 100%;
        height: 100%;
        background: ${this._config.bg};
        transition: filter 0.6s ease;
        overflow: hidden;
      }
      canvas {
        display: block;
        width: 100%;
        height: 100%;
      }
      .badge {
        position: absolute;
        bottom: 12px;
        right: 12px;
        font: 600 11px/1 'Inter', system-ui, sans-serif;
        letter-spacing: 1px;
        text-transform: uppercase;
        padding: 6px 10px;
        border-radius: 999px;
        color: #fff;
        background: rgba(0,0,0,0.45);
        backdrop-filter: blur(6px);
        opacity: 0.9;
      }
      .badge[data-mood="pumped"]  { background: rgba(166,243,106,0.55); color: #002; }
      .badge[data-mood="tired"]   { background: rgba(86,107,140,0.55); }
      .badge[data-mood="sick"]    { background: rgba(255,77,109,0.45); }
      .badge[data-mood="zen"]     { background: rgba(123,97,255,0.45); }
    `;
    const stage = document.createElement("div");
    stage.className = "stage";
    const canvas = document.createElement("canvas");
    const badge = document.createElement("div");
    badge.className = "badge";
    badge.dataset.mood = "idle";
    badge.textContent = "IDLE";
    stage.appendChild(canvas);
    stage.appendChild(badge);
    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(stage);
    this._canvas = canvas;
    this._stage = stage;
    this._badge = badge;
    this._initRive();
  }

  async _initRive() {
    try {
      const rive = await loadRive();
      // Resize canvas to its container
      const resize = () => {
        const dpr = window.devicePixelRatio || 1;
        const rect = this._stage.getBoundingClientRect();
        this._canvas.width = rect.width * dpr;
        this._canvas.height = rect.height * dpr;
        if (this._rive) this._rive.resizeDrawingSurfaceToCanvas();
      };
      resize();
      window.addEventListener("resize", resize);

      this._rive = new rive.Rive({
        src: this._config.riv_url,
        canvas: this._canvas,
        autoplay: true,
        layout: new rive.Layout({ fit: rive.Fit.Contain, alignment: rive.Alignment.Center }),
        onLoad: () => {
          this._rive.resizeDrawingSurfaceToCanvas();
          // Auto-play first state machine
          const smNames = this._rive.stateMachineNames || [];
          if (smNames.length) {
            this._rive.play(smNames[0]);
            // Collect inputs across all SMs
            smNames.forEach((sm) => {
              try {
                (this._rive.stateMachineInputs(sm) || []).forEach((inp) => {
                  this._inputs[inp.name] = inp;
                });
              } catch (_) {}
            });
          }
          this._updateMood();
        },
      });
    } catch (e) {
      console.error("[cat-widget-card] Rive load error:", e);
      this._stage.innerHTML = `<div style="color:#ff8;padding:20px;font-family:monospace">Cat failed to load: ${e.message}<br>Check that ${this._config.riv_url} exists.</div>`;
    }
  }

  _stateNum(eid) {
    const s = this._hass?.states?.[eid];
    if (!s) return null;
    const v = parseFloat(s.state);
    return isFinite(v) ? v : null;
  }

  _stateStr(eid) {
    return this._hass?.states?.[eid]?.state || null;
  }

  _computeMood() {
    if (!this._hass) return "idle";
    const c = this._config;
    const hrv = this._stateNum(c.hrv_entity);
    const battery = this._stateNum(c.battery_entity);
    const recovery = this._stateNum(c.recovery_entity);
    const sleep = this._stateNum(c.sleep_eff_entity);
    const moodStr = (this._stateStr(c.mood_entity) || "").toLowerCase();
    const showerOn = this._stateStr(c.shower_entity) === "on";
    const voc = this._stateNum(c.voc_entity);

    // Priority: sick > tired > pumped > zen > idle
    if ((voc !== null && voc > 1.0) || moodStr === "sick" || moodStr === "stressed") return "sick";
    if ((battery !== null && battery < 30) || (recovery !== null && recovery < 30)) return "tired";
    if ((hrv !== null && hrv >= 50) && (battery !== null && battery >= 70)) return "pumped";
    if ((sleep !== null && sleep >= 90) || moodStr === "calm" || moodStr === "zen") return "zen";
    if (showerOn) return "zen"; // shower = relaxation
    return "idle";
  }

  _updateMood() {
    if (!this._rive || !this._stage) return;
    const mood = this._computeMood();
    if (mood === this._lastMood) return;
    this._lastMood = mood;
    this._mood = mood;

    // Speed
    if (this._rive) this._rive.speedFactor = MOOD_SPEED[mood] ?? 1.0;

    // Filter
    this._stage.style.filter = MOOD_FILTER[mood] ?? "none";

    // Inputs
    const lidVal = MOOD_EYELID[mood] ?? 0;
    ["Eyelid1_DOWN", "Eyelid2_DOWN", "eyelid_down", "eyelid"].forEach((n) => {
      if (this._inputs[n] && typeof this._inputs[n].value !== "undefined") this._inputs[n].value = lidVal;
    });
    ["Eyelid1_UP", "Eyelid2_UP"].forEach((n) => {
      if (this._inputs[n] && typeof this._inputs[n].value !== "undefined") this._inputs[n].value = 0;
    });
    if (this._inputs.mood && typeof this._inputs.mood.value !== "undefined") {
      this._inputs.mood.value = MOOD_INDEX[mood] ?? 0;
    }
    // Trigger inputs (mood / mood_<name>)
    [mood, `mood_${mood}`].forEach((n) => {
      const inp = this._inputs[n];
      if (inp && typeof inp.fire === "function") inp.fire();
    });

    // Badge
    if (this._badge) {
      this._badge.dataset.mood = mood;
      this._badge.textContent = mood.toUpperCase();
    }
  }

  static getStubConfig() {
    return {
      riv_url: "/local/community/cat-widget/cat.riv",
      hrv_entity: "sensor.zoidberg_hrv",
      battery_entity: "sensor.zoidberg_body_battery",
    };
  }
}

customElements.define("cat-widget-card", CatWidgetCard);

// Register with Lovelace card picker
window.customCards = window.customCards || [];
window.customCards.push({
  type: "cat-widget-card",
  name: "Cat Widget",
  description: "Reactive Rive cat that mirrors your health state (HRV, body battery, sleep, mood).",
  preview: false,
});

console.info("%c CAT-WIDGET-CARD %c v1.0.0 ", "color:#FFD23F;background:#0B1226;padding:2px 6px;border-radius:3px", "color:#fff;background:#1B2543;padding:2px 6px;border-radius:3px");
