# ha-cat-widget

Reactive Rive cat for Home Assistant Lovelace dashboards. Reuses `cat.riv` from the [Zoidberg](https://github.com/Jooooov/Zoidberg) iOS/web app.

## What it does

A canvas-rendered cat that reacts to your Home Assistant entities — HRV, body battery, sleep efficiency, mood, shower active, VOC. Mood drives speed + filter + eyelid Rive state machine inputs.

| Mood | Triggered by | Effect |
|------|--------------|--------|
| `pumped` | HRV ≥ 50 AND body battery ≥ 70 | Fast playback, saturated colors |
| `idle` | Default | Normal |
| `tired` | body battery < 30 OR recovery < 30 | 0.22× speed, desaturated |
| `sick` | VOC > 1.0 mg/m³ OR mood entity = stressed | Hue shift green, 0.6× speed |
| `zen` | sleep eficiência ≥ 90 OR shower active | 0.28× speed, purple hue |

## Install (HA Lovelace)

Add as a resource in Settings → Dashboards → Resources:

```
URL: https://cdn.jsdelivr.net/gh/Jooooov/ha-cat-widget@main/cat-widget-card.js
Type: JavaScript Module
```

Then add to a dashboard:

```yaml
type: custom:cat-widget-card
riv_url: https://cdn.jsdelivr.net/gh/Jooooov/ha-cat-widget@main/cat.riv
hrv_entity: sensor.zoidberg_hrv
battery_entity: sensor.zoidberg_body_battery
recovery_entity: sensor.zoidberg_recovery_score
sleep_eff_entity: sensor.zoidberg_sono_eficiencia
mood_entity: sensor.zoidberg_mood
shower_entity: binary_sensor.chuveiro_activo
voc_entity: sensor.gas_sensor_compostos_organicos_volateis
```

All entities are optional and fall back to safe defaults.

## License

MIT
