/**
 * cat-widget-card v2 — Reactive Rive cat for Home Assistant Lovelace.
 * Full feature parity with Zoidberg web app's RiveAvatar.
 *
 * Effects per mood:
 *   pumped:  bounce + 18 lightning bolts ⚡, 1.9× speed, saturated
 *   tired:   sag + 20 floating Z's + dark overlay, 0.22× speed
 *   sick:    wobble + 3 sweat drops + 16 tracinhos, 0.6× speed, hue shift
 *   zen:     float + 18 sparkles + 2 orbit rings, 0.28× speed, purple hue
 *   idle:    no overlay, 1.0× speed
 *
 * Reuses cat.riv from Zoidberg.
 */

const RIVE_CDN = "https://unpkg.com/@rive-app/canvas@2.32.0/rive.js";

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

const STYLES = `
  :host { display: block; width: 100%; height: 100%; }
  .stage {
    position: relative;
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    overflow: hidden;
    transition: filter 0.5s ease;
    background: transparent;
  }
  .wrap {
    position: relative;
    width: 100%; height: 100%;
    transition: filter 0.5s ease;
  }
  .wrap canvas {
    display: block;
    width: 100% !important;
    height: 100% !important;
    background: transparent !important;
  }
  .overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
  }
  .badge {
    position: absolute;
    bottom: 14px; right: 14px;
    font: 600 11px/1 'Inter', system-ui, sans-serif;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    padding: 6px 12px;
    border-radius: 999px;
    color: #fff;
    background: rgba(0,0,0,0.45);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    z-index: 10;
    transition: background 0.4s ease;
  }
  .badge[data-mood="pumped"] { background: rgba(166,243,106,0.55); color: #002; }
  .badge[data-mood="tired"]  { background: rgba(86,107,140,0.55); }
  .badge[data-mood="sick"]   { background: rgba(255,77,109,0.45); }
  .badge[data-mood="zen"]    { background: rgba(123,97,255,0.45); }

  /* Mood animations on wrap */
  .mood-pumped .wrap { animation: catBounce 0.45s ease-in-out infinite; }
  @keyframes catBounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)} }

  .mood-zen .wrap { animation: catFloat 5s ease-in-out infinite; }
  @keyframes catFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-9px)} }

  .mood-tired .wrap { animation: catSag 5s ease-in-out infinite; }
  @keyframes catSag { 0%,100%{transform:rotate(0)} 50%{transform:rotate(-1.5deg) translateY(3px)} }

  .mood-sick .wrap { animation: catWobble 1.3s ease-in-out infinite; }
  @keyframes catWobble { 0%,100%{transform:rotate(0)} 30%{transform:rotate(-3deg)} 70%{transform:rotate(3deg)} }

  /* Tired dark overlay */
  .mood-tired .wrap::after {
    content: '';
    position: absolute; inset: 0;
    background: rgba(60,40,90,0.18);
    pointer-events: none;
    border-radius: 4px;
  }

  /* SICK — sweat drops */
  .drop {
    position: absolute;
    width: 10px; height: 17px;
    background: #80cbc4;
    border-radius: 50% 50% 50% 50% / 40% 40% 60% 60%;
    opacity: 0;
    animation: catDrip 1.5s ease-in infinite;
  }
  .drop:nth-child(1) { left:68%; top:18%; animation-delay:0s; }
  .drop:nth-child(2) { left:74%; top:10%; animation-delay:.5s; width:7px; height:13px; }
  .drop:nth-child(3) { left:72%; top:24%; animation-delay:1s; width:6px; height:11px; }
  @keyframes catDrip { 0%{transform:translateY(0);opacity:.9} 100%{transform:translateY(34px);opacity:0} }

  /* SICK — tracinhos */
  .traco {
    position: absolute;
    font-size: 22px; font-weight: 700;
    color: #5a9a94;
    opacity: 0;
    letter-spacing: -2px;
    animation: catTraco 1.8s ease-in-out infinite;
  }
  .traco:nth-child(4)  { left:5%;  top:20%; font-size:24px; animation-delay:0s; }
  .traco:nth-child(5)  { right:5%; top:15%; font-size:20px; animation-delay:.28s; }
  .traco:nth-child(6)  { left:10%; top:40%; font-size:17px; animation-delay:.56s; }
  .traco:nth-child(7)  { right:9%; top:38%; font-size:19px; animation-delay:.84s; }
  .traco:nth-child(8)  { left:22%; top:5%;  font-size:16px; animation-delay:.14s; }
  .traco:nth-child(9)  { right:20%;top:7%;  font-size:18px; animation-delay:.42s; }
  .traco:nth-child(10) { left:3%;  top:60%; font-size:23px; animation-delay:.70s; }
  .traco:nth-child(11) { right:4%; top:58%; font-size:14px; animation-delay:.98s; }
  .traco:nth-child(12) { left:38%; top:2%;  font-size:13px; animation-delay:1.12s; }
  .traco:nth-child(13) { left:14%; top:75%; font-size:19px; animation-delay:.35s; }
  .traco:nth-child(14) { right:13%;top:72%; font-size:16px; animation-delay:.63s; }
  .traco:nth-child(15) { left:50%; top:68%; font-size:17px; animation-delay:.91s; }
  .traco:nth-child(16) { left:2%;  top:82%; font-size:22px; animation-delay:1.4s; }
  .traco:nth-child(17) { right:2%; top:80%; font-size:14px; animation-delay:.07s; }
  .traco:nth-child(18) { left:30%; top:88%; font-size:12px; animation-delay:1.68s; }
  .traco:nth-child(19) { right:30%;top:85%; font-size:13px; animation-delay:.49s; }
  @keyframes catTraco { 0%{opacity:0;transform:translate(0,0) rotate(-5deg)} 25%{opacity:.9} 100%{opacity:0;transform:translate(8px,22px) rotate(8deg)} }

  /* TIRED — Z's */
  .zz {
    position: absolute;
    font-size: 34px; font-weight: 900; color: #4a3870;
    opacity: 0; text-shadow: 0 2px 8px rgba(0,0,0,0.2);
    animation: catZzz 2.2s ease-in infinite;
  }
  .zz:nth-child(1)  { right:8%;  top:28%; animation-delay:0s;    font-size:41px; }
  .zz:nth-child(2)  { right:3%;  top:17%; animation-delay:.28s;  font-size:31px; }
  .zz:nth-child(3)  { right:0%;  top:7%;  animation-delay:.56s;  font-size:22px; }
  .zz:nth-child(4)  { left:6%;   top:28%; animation-delay:.14s;  font-size:36px; }
  .zz:nth-child(5)  { left:2%;   top:16%; animation-delay:.42s;  font-size:26px; }
  .zz:nth-child(6)  { left:5%;   top:6%;  animation-delay:.70s;  font-size:18px; }
  .zz:nth-child(7)  { right:20%; top:4%;  animation-delay:.84s;  font-size:23px; }
  .zz:nth-child(8)  { left:20%;  top:4%;  animation-delay:.98s;  font-size:19px; }
  .zz:nth-child(9)  { right:12%; top:55%; animation-delay:.35s;  font-size:29px; }
  .zz:nth-child(10) { left:12%;  top:55%; animation-delay:.63s;  font-size:25px; }
  .zz:nth-child(11) { right:30%; top:2%;  animation-delay:1.12s; font-size:16px; }
  .zz:nth-child(12) { left:35%;  top:2%;  animation-delay:.07s;  font-size:14px; }
  .zz:nth-child(13) { right:6%;  top:68%; animation-delay:1.40s; font-size:20px; }
  .zz:nth-child(14) { left:6%;   top:65%; animation-delay:1.68s; font-size:17px; }
  .zz:nth-child(15) { right:25%; top:62%; animation-delay:.21s;  font-size:24px; }
  .zz:nth-child(16) { left:25%;  top:60%; animation-delay:.49s;  font-size:19px; }
  .zz:nth-child(17) { right:15%; top:80%; animation-delay:.77s;  font-size:14px; }
  .zz:nth-child(18) { left:15%;  top:78%; animation-delay:1.05s; font-size:13px; }
  .zz:nth-child(19) { right:40%; top:72%; animation-delay:1.33s; font-size:12px; }
  .zz:nth-child(20) { left:42%;  top:70%; animation-delay:1.61s; font-size:11px; }
  @keyframes catZzz { 0%{opacity:0;transform:translate(0,0) scale(.8)} 18%{opacity:1} 100%{opacity:0;transform:translate(14px,-52px) scale(1.1)} }

  /* ZEN — sparkles */
  .spark {
    position: absolute;
    font-size: 22px;
    opacity: 0;
    animation: catSparkle 2.6s ease-in-out infinite;
  }
  .spark:nth-child(1)  { left:3%;   top:20%; animation-delay:0s;    font-size:29px; }
  .spark:nth-child(2)  { right:3%;  top:17%; animation-delay:.32s;  font-size:24px; }
  .spark:nth-child(3)  { left:8%;   top:55%; animation-delay:.64s;  font-size:19px; }
  .spark:nth-child(4)  { right:8%;  top:52%; animation-delay:.96s;  font-size:23px; }
  .spark:nth-child(5)  { left:46%;  top:3%;  animation-delay:.48s;  font-size:20px; }
  .spark:nth-child(6)  { left:16%;  top:33%; animation-delay:1.28s; font-size:16px; }
  .spark:nth-child(7)  { right:16%; top:36%; animation-delay:.80s;  font-size:18px; }
  .spark:nth-child(8)  { left:26%;  top:6%;  animation-delay:1.60s; font-size:14px; }
  .spark:nth-child(9)  { right:24%; top:7%;  animation-delay:.24s;  font-size:17px; }
  .spark:nth-child(10) { left:2%;   top:38%; animation-delay:1.92s; font-size:22px; }
  .spark:nth-child(11) { right:2%;  top:35%; animation-delay:1.44s; font-size:17px; }
  .spark:nth-child(12) { left:40%;  top:68%; animation-delay:.56s;  font-size:13px; }
  .spark:nth-child(13) { right:38%; top:65%; animation-delay:2.08s; font-size:16px; }
  .spark:nth-child(14) { left:18%;  top:72%; animation-delay:.16s;  font-size:19px; }
  .spark:nth-child(15) { right:18%; top:70%; animation-delay:1.76s; font-size:12px; }
  .spark:nth-child(16) { left:0%;   top:80%; animation-delay:2.40s; font-size:17px; }
  .spark:nth-child(17) { right:0%;  top:78%; animation-delay:.72s;  font-size:14px; }
  .spark:nth-child(18) { left:50%;  top:88%; animation-delay:1.12s; font-size:13px; }
  .spark:nth-child(19) { left:32%;  top:2%;  animation-delay:2.56s; font-size:11px; }
  .spark:nth-child(20) { right:32%; top:4%;  animation-delay:.40s;  font-size:18px; }
  @keyframes catSparkle { 0%,100%{opacity:0;transform:scale(.4) rotate(0deg)} 50%{opacity:1;transform:scale(1.1) rotate(20deg)} }

  /* ZEN — orbit rings */
  .zen-ring {
    position: absolute;
    border-radius: 50%;
    border: 2px dashed rgba(0,180,210,0.4);
    opacity: 1;
    animation: catOrbit 6s linear infinite;
  }
  .zen-ring:nth-child(1) {
    width: 60%; aspect-ratio: 4 / 1;
    top: 38%; left: 20%;
    animation-duration: 6s;
  }
  .zen-ring:nth-child(2) {
    width: 50%; aspect-ratio: 4 / 1;
    top: 41%; left: 25%;
    border-color: rgba(180,130,210,0.3);
    animation-direction: reverse;
    animation-duration: 9s;
  }
  @keyframes catOrbit { from{transform:rotate(0)} to{transform:rotate(360deg)} }

  /* PUMPED — lightning bolts */
  .bolt {
    position: absolute;
    font-size: 29px;
    opacity: 0;
    animation: catFlash 0.55s ease-in-out infinite;
  }
  .bolt:nth-child(1)  { left:2%;   top:30%; font-size:36px; animation-delay:0s; }
  .bolt:nth-child(2)  { right:2%;  top:24%; font-size:31px; animation-delay:.12s; }
  .bolt:nth-child(3)  { left:15%;  top:8%;  font-size:26px; animation-delay:.24s; }
  .bolt:nth-child(4)  { right:14%; top:10%; font-size:24px; animation-delay:.06s; }
  .bolt:nth-child(5)  { left:4%;   top:55%; font-size:29px; animation-delay:.18s; }
  .bolt:nth-child(6)  { right:4%;  top:50%; font-size:22px; animation-delay:.30s; }
  .bolt:nth-child(7)  { left:30%;  top:2%;  font-size:22px; animation-delay:.42s; }
  .bolt:nth-child(8)  { right:28%; top:3%;  font-size:19px; animation-delay:.48s; }
  .bolt:nth-child(9)  { left:8%;   top:72%; font-size:24px; animation-delay:.15s; }
  .bolt:nth-child(10) { right:8%;  top:70%; font-size:20px; animation-delay:.27s; }
  .bolt:nth-child(11) { left:2%;   top:82%; font-size:26px; animation-delay:.39s; }
  .bolt:nth-child(12) { right:2%;  top:80%; font-size:19px; animation-delay:.03s; }
  .bolt:nth-child(13) { left:45%;  top:0%;  font-size:22px; animation-delay:.33s; }
  .bolt:nth-child(14) { right:43%; top:2%;  font-size:17px; animation-delay:.45s; }
  .bolt:nth-child(15) { left:20%;  top:88%; font-size:19px; animation-delay:.21s; }
  .bolt:nth-child(16) { right:20%; top:86%; font-size:16px; animation-delay:.09s; }
  .bolt:nth-child(17) { left:2%;   top:10%; font-size:24px; animation-delay:.36s; }
  .bolt:nth-child(18) { right:2%;  top:8%;  font-size:20px; animation-delay:.51s; }
  @keyframes catFlash { 0%,100%{opacity:0} 45%{opacity:1} }
`;

function buildOverlay(mood) {
  const wrap = document.createElement("div");
  wrap.className = "overlay";
  if (mood === "sick") {
    // 3 drops + 16 tracinhos (children 4-19)
    for (let i = 0; i < 3; i++) wrap.appendChild(Object.assign(document.createElement("div"), { className: "drop" }));
    const chars = ["—","—","~","—","~","—","~","—","—","~","—","~","—","~","—","~"];
    chars.forEach(ch => {
      const t = document.createElement("div");
      t.className = "traco";
      t.textContent = ch;
      wrap.appendChild(t);
    });
  } else if (mood === "tired") {
    for (let i = 0; i < 20; i++) {
      const z = document.createElement("div");
      z.className = "zz";
      z.textContent = "Z";
      wrap.appendChild(z);
    }
  } else if (mood === "zen") {
    for (let i = 0; i < 2; i++) wrap.appendChild(Object.assign(document.createElement("div"), { className: "zen-ring" }));
    "✦✦✦✦★✧✦✦★✧✦✦✦★✧✦★✦✧".split("").forEach(ch => {
      const s = document.createElement("div");
      s.className = "spark";
      s.textContent = ch;
      wrap.appendChild(s);
    });
  } else if (mood === "pumped") {
    for (let i = 0; i < 18; i++) {
      const b = document.createElement("div");
      b.className = "bolt";
      b.textContent = "⚡";
      wrap.appendChild(b);
    }
  }
  return wrap;
}

class CatWidgetCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._rive = null;
    this._inputs = {};
    this._lastMood = null;
    this._mouseHandler = null;
  }

  setConfig(config) {
    this._config = {
      riv_url: config.riv_url || "https://cdn.jsdelivr.net/gh/Jooooov/ha-cat-widget@main/cat.riv",
      hrv_entity: config.hrv_entity || "sensor.zoidberg_hrv",
      battery_entity: config.battery_entity || "sensor.zoidberg_body_battery",
      recovery_entity: config.recovery_entity || "sensor.zoidberg_recovery_score",
      sleep_eff_entity: config.sleep_eff_entity || "sensor.zoidberg_sono_eficiencia",
      mood_entity: config.mood_entity || "sensor.zoidberg_mood",
      shower_entity: config.shower_entity || "binary_sensor.chuveiro_activo",
      voc_entity: config.voc_entity || "sensor.gas_sensor_compostos_organicos_volateis",
      mood_override: config.mood_override || null, // for testing
      show_badge: config.show_badge !== false,
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
    if (this.shadowRoot.querySelector(".stage")) return;
    const style = document.createElement("style");
    style.textContent = STYLES;

    const stage = document.createElement("div");
    stage.className = "stage mood-idle";

    const wrap = document.createElement("div");
    wrap.className = "wrap";

    const canvas = document.createElement("canvas");
    wrap.appendChild(canvas);
    stage.appendChild(wrap);

    if (this._config.show_badge) {
      const badge = document.createElement("div");
      badge.className = "badge";
      badge.dataset.mood = "idle";
      badge.textContent = "IDLE";
      stage.appendChild(badge);
      this._badge = badge;
    }

    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(stage);
    this._stage = stage;
    this._wrap = wrap;
    this._canvas = canvas;

    this._initRive();
    this._setupMouseTracking();
  }

  async _initRive() {
    try {
      const rive = await loadRive();
      const resize = () => {
        const dpr = window.devicePixelRatio || 1;
        const rect = this._wrap.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        this._canvas.width = rect.width * dpr;
        this._canvas.height = rect.height * dpr;
        if (this._rive) this._rive.resizeDrawingSurfaceToCanvas();
      };
      resize();
      window.addEventListener("resize", resize);
      // Re-resize when the card actually appears in DOM
      const ro = new ResizeObserver(resize);
      ro.observe(this._wrap);

      this._rive = new rive.Rive({
        src: this._config.riv_url,
        canvas: this._canvas,
        autoplay: true,
        layout: new rive.Layout({ fit: rive.Fit.Contain, alignment: rive.Alignment.Center }),
        onLoad: () => {
          this._rive.resizeDrawingSurfaceToCanvas();
          const smNames = this._rive.stateMachineNames || [];
          if (smNames.length) {
            this._rive.play(smNames[0]);
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
      this._stage.innerHTML = `<div style="color:#ff8;padding:20px;font-family:monospace">Cat failed to load: ${e.message}</div>`;
    }
  }

  _setupMouseTracking() {
    this._mouseHandler = (e) => {
      if (!this._wrap || !Object.keys(this._inputs).length) return;
      const rect = this._wrap.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (720 / rect.width);
      const y = (e.clientY - rect.top) * (720 / rect.height);
      ["Pupil1_TARGET_X", "Pupil2_TARGET_X"].forEach((n) => {
        if (this._inputs[n] && typeof this._inputs[n].value !== "undefined") this._inputs[n].value = x;
      });
      ["Pupil1_TARGET_Y", "Pupil2_TARGET_Y"].forEach((n) => {
        if (this._inputs[n] && typeof this._inputs[n].value !== "undefined") this._inputs[n].value = y;
      });
      if (this._inputs["HeadTurn_IK_X"] && typeof this._inputs["HeadTurn_IK_X"].value !== "undefined") {
        this._inputs["HeadTurn_IK_X"].value = x;
      }
      if (this._inputs["Face_CONTROL"] && typeof this._inputs["Face_CONTROL"].value !== "undefined") {
        this._inputs["Face_CONTROL"].value = (x / 720) * 100;
      }
    };
    document.addEventListener("mousemove", this._mouseHandler);
  }

  disconnectedCallback() {
    if (this._mouseHandler) {
      document.removeEventListener("mousemove", this._mouseHandler);
      this._mouseHandler = null;
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
    if (this._config.mood_override) return this._config.mood_override;
    if (!this._hass) return "idle";
    const c = this._config;
    const hrv = this._stateNum(c.hrv_entity);
    const battery = this._stateNum(c.battery_entity);
    const recovery = this._stateNum(c.recovery_entity);
    const sleep = this._stateNum(c.sleep_eff_entity);
    const moodStr = (this._stateStr(c.mood_entity) || "").toLowerCase();
    const showerOn = this._stateStr(c.shower_entity) === "on";
    const voc = this._stateNum(c.voc_entity);

    if ((voc !== null && voc > 1.0) || moodStr === "sick" || moodStr === "stressed") return "sick";
    if ((battery !== null && battery < 30) || (recovery !== null && recovery < 30)) return "tired";
    if ((hrv !== null && hrv >= 50) && (battery !== null && battery >= 70)) return "pumped";
    if ((sleep !== null && sleep >= 90) || moodStr === "calm" || moodStr === "zen" || showerOn) return "zen";
    return "idle";
  }

  _updateMood() {
    if (!this._stage) return;
    const mood = this._computeMood();
    if (mood === this._lastMood) return;
    this._lastMood = mood;

    // Stage class for mood animations
    this._stage.className = `stage mood-${mood}`;

    // Filter on the wrap (canvas + overlays)
    if (this._wrap) this._wrap.style.filter = MOOD_FILTER[mood] ?? "none";

    // Speed
    if (this._rive) this._rive.speedFactor = MOOD_SPEED[mood] ?? 1.0;

    // State machine inputs
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
    [mood, `mood_${mood}`].forEach((n) => {
      const inp = this._inputs[n];
      if (inp && typeof inp.fire === "function") inp.fire();
    });

    // Overlay
    const oldOverlay = this._stage.querySelector(".overlay");
    if (oldOverlay) oldOverlay.remove();
    if (mood !== "idle") {
      const ov = buildOverlay(mood);
      // Insert overlay inside wrap so it inherits filter
      this._wrap.appendChild(ov);
    }

    // Badge
    if (this._badge) {
      this._badge.dataset.mood = mood;
      this._badge.textContent = mood.toUpperCase();
    }
  }

  static getStubConfig() {
    return {
      riv_url: "https://cdn.jsdelivr.net/gh/Jooooov/ha-cat-widget@main/cat.riv",
      hrv_entity: "sensor.zoidberg_hrv",
      battery_entity: "sensor.zoidberg_body_battery",
    };
  }
}

customElements.define("cat-widget-card", CatWidgetCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "cat-widget-card",
  name: "Cat Widget",
  description: "Reactive Rive cat that mirrors your health state with full Zoidberg-app effects (mood overlays, mouse-tracked pupils, mood-driven animations).",
  preview: false,
});

console.info(
  "%c CAT-WIDGET-CARD %c v2.0.0 ",
  "color:#FFD23F;background:#0B1226;padding:2px 6px;border-radius:3px",
  "color:#fff;background:#1B2543;padding:2px 6px;border-radius:3px"
);
