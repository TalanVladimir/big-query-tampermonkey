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
2. Chrome: **Tampermonkey → Settings → Security → Allow access to file URLs** (įjungta).
3. Nukopijuokite arba importuokite [`tampermonkey/bigquery.user.js`](tampermonkey/bigquery.user.js) ir pakoreguokite `@require` kelią į savo `dist/main.js`.

```text
// @include			*://console.cloud.google.com/bigquery*
```
4. Po kiekvieno `npm run build` — **perkraukite BigQuery puslapį** (F5).

> **Svarbu:** pakanka tik `main.js` — stiliai įdedami į JS bundle. `@resource main.css` nereikalingas (VIPA naudoja `GM_getResourceText`, čia naudojame `style-loader`).

### Patikra, ar scriptas veikia

DevTools Console (`F12`):

```js
document.getElementById('bq-tm-panel')
```

Jei `null` — Tampermonkey skiltyje patikrinkite, ar scriptas **Enabled** ir ar nėra klaidų (raudonas skaičius prie scripto).

## Build

```bash
npm install
npm start    # dev + dist į diską
npm run build
```

Generuojamas `dist/main.js` (su įdėtu CSS).
