# BigQuery Tampermonkey

Plėtinys BigQuery konsolės SQL redaktoriui (Google Cloud Console).

## Mygtukai (tempiama panelė kairėje apačioje)

| Mygtukas | Veiksmas |
|----------|----------|
| **ref → BQ / kopijuoti** | SQL į iškarpinę. **ref → BQ:** `{{ ref('stg_…') }}` → `` `ilte-analytics.dbt_staging.stg_…` `` (ir analogiškai `int_`, `mart…`, `raw_…__…`). **BQ → ref:** `` `ilte-analytics.dbt_*.modelis` `` → `{{ ref('modelis') }}`. Jei nei ref, nei dbt BQ keliai — kopijuojama kaip yra. |
| **1 eil. → format + filtras** | Tik **vienos eilutės** užklausa. Formatavimas: `select` / `*` / `from` (kiekviena dalis naujoje eilutėje), pabaigoje `--limit 1000`. Pagal FROM kelią: `raw_` → `where partition_date > '2020-01-01'`; `stg_` → `where scd_is_active = true`; kitaip be WHERE. Veikia ir su `select from ...` (tuščias SELECT sąrašas), ir su `select \`stulpelis\` from ...`. |

## Diegimas

1. [Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo).
2. Nukopijuokite arba importuokite [`tampermonkey/bigquery.user.js`](tampermonkey/bigquery.user.js).

```text
// @include			*://console.cloud.google.com/bigquery*
// @require         https://raw.githubusercontent.com/TalanVladimir/big-query-tampermonkey/refs/heads/master/dist/main.js
```

3. Po lokalaus `npm run build` — **commit + push** `dist/main.js` į `master`, tada BigQuery puslapyje F5 (Tampermonkey cache kartais reikia scripto per-save).

> Stiliai įdėti į `main.js` bundle (`style-loader`); atskiro CSS failo nereikia.

### Patikra

DevTools Console (`F12`):

```js
document.getElementById('bq-tm-panel')
```

## Build

```bash
npm install
npm start    # dev + dist į diską
npm run build
```

Generuojamas `dist/main.js` (su įdėtu CSS) — jį reikia turėti GitHub `master` šakoje, kad `@require` veiktų.
