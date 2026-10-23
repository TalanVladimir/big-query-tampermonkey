# BigQuery Tampermonkey

Plėtinys BigQuery konsolės SQL redaktoriui (Google Cloud Console).

## Mygtukai (tempiama panelė kairėje apačioje)

| Mygtukas | Veiksmas |
|----------|----------|
| **dbt ref → clipboard** | Aktyvios užklausos `FROM \`proj.dataset.lentele\`` → `{{ ref('lentele') }}`, suformatuota su `*`, nukopijuota į iškarpinę |
| **low + partition** | Pakeičia redaktoriuje: mažosios raidės, `select` / `*` / `from`, `where partition_date > '2020-01-01'`, pabaigoje `--limit 1000` |
| **scd active low** | Pakeičia redaktoriuje: mažosios raidės, `*`, `where scd_is_active = true` (pašalina SCD datos filtrą ir LIMIT) |

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
