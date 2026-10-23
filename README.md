# BigQuery Tampermonkey

Plėtinys BigQuery konsolės SQL redaktoriui (Google Cloud Console).

## Mygtukai (tempiama panelė kairėje apačioje)

| Mygtukas | Veiksmas |
|----------|----------|
| **dbt ref → clipboard** | Aktyvios užklausos `FROM \`proj.dataset.lentele\`` → `{{ ref('lentele') }}`, suformatuota su `*`, nukopijuota į iškarpinę |
| **low + partition** | Pakeičia redaktoriuje: mažosios raidės, `select` / `*` / `from`, `where partition_date > '2020-01-01'`, pabaigoje `--limit 1000` |
| **scd active low** | Pakeičia redaktoriuje: mažosios raidės, `*`, `where scd_is_active = true` (pašalina SCD datos filtrą ir LIMIT) |

## Diegimas

1. [Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) + leidimas **file://** URL (jei naudojate lokalius `dist` failus).
2. Naujas userscript:

```
// ==UserScript==
// @name            BigQuery (Tampermonkey)
// @version         1.0.0
// @description     SQL transformacijos BigQuery redaktoriuje
// @author          Vladimir Talan
// @match           https://console.cloud.google.com/bigquery*
// @grant           none
// @resource        css file:///C:/Users/vladimir.talan/_Repos/big-query-tampermonkey/dist/main.css
// @require         file:///C:/Users/vladimir.talan/_Repos/big-query-tampermonkey/dist/main.js
// @run-at          document-end
// ==/UserScript==
```

Pakoreguokite `file://` kelius pagal savo mašiną.

## Build

```bash
npm install
npm start    # dev + dist į diską
npm run build
```

Generuojami `dist/main.js` ir `dist/main.css`.
