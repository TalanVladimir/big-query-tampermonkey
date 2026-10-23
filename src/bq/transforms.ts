import {
  EDITOR_TRAILING_NEWLINES,
  LIMIT_COMMENT,
  PARTITION_WHERE,
  SCD_ACTIVE_WHERE,
} from '../constants';
import {
  parseFromQuery,
  replaceQualifiedBackticksWithDbtRef,
} from './parse_sql';

function buildSelectBlockLower(
  fromLine: string,
  whereLine: string,
  orderBy: string | null,
): string {
  const lines = ['select', '  *', `from ${fromLine}`, whereLine.toLowerCase()];

  if (orderBy) {
    lines.push(orderBy.toLowerCase());
  }

  return lines.join('\n');
}

/**
 * Prideda dvi tuščias eilutes redaktoriaus pabaigoje.
 */
function withEditorTrailingNewlines(sql: string): string {
  return `${sql.replace(/\s+$/, '')}${EDITOR_TRAILING_NEWLINES}`;
}

/**
 * Kopijavimui: tik `` `...` `` → `` {{ ref('...') }} `` (visa kita lieka).
 */
export function transformToDbtRef(sql: string): string {
  const converted = replaceQualifiedBackticksWithDbtRef(sql);

  if (!converted.includes("{{ ref(")) {
    throw new Error(
      'Nerasta lentelių `proj.dataset.lentele` arba proj.dataset.lentele formatu.',
    );
  }

  return converted;
}

/**
 * Mažosiomis raidėmis, su *, partition_date filtru ir užkomentuotu limit.
 */
export function transformToLowerWithPartition(sql: string): string {
  const parsed = parseFromQuery(sql);
  if (!parsed) {
    throw new Error('Nepavyko rasti FROM dalies užklausoje.');
  }

  const fromLine = parsed.fromTarget.toLowerCase();
  const body = buildSelectBlockLower(fromLine, PARTITION_WHERE, parsed.orderBy);

  return withEditorTrailingNewlines(`${body}\n${LIMIT_COMMENT}`);
}

/**
 * Mažosiomis raidėmis, su * ir scd_is_active filtru (SCD užklausoms).
 */
export function transformToScdActiveLow(sql: string): string {
  const parsed = parseFromQuery(sql);
  if (!parsed) {
    throw new Error('Nepavyko rasti FROM dalies užklausoje.');
  }

  const fromLine = parsed.fromTarget.toLowerCase();

  return withEditorTrailingNewlines(
    buildSelectBlockLower(fromLine, SCD_ACTIVE_WHERE, null),
  );
}
