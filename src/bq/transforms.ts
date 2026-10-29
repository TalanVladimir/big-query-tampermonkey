import {
  BQ_DBT_PROJECT,
  EDITOR_TRAILING_NEWLINES,
  LIMIT_COMMENT,
  PARTITION_WHERE,
  SCD_ACTIVE_WHERE,
} from '../constants';
import {
  assertSingleLineSql,
  BqLayerKind,
  classifyFromTargetKind,
  containsDbtRefMacro,
  lowercaseSqlKeywords,
  parseFromQuery,
  replaceDbtRefWithQualifiedBackticks,
  replaceQualifiedBackticksWithDbtRef,
  trimTrailingSpacesPerLine,
} from './parse_sql';

export type SmartTransformResult = {
  kind: BqLayerKind;
  sql: string;
};

/**
 * Normalizuoja BQ nukopijuotą tekstą prieš transformaciją.
 */
function normalizeInputSql(sql: string): string {
  return trimTrailingSpacesPerLine(sql);
}

/**
 * Prideda dvi tuščias eilutes redaktoriaus pabaigoje.
 */
function withEditorTrailingNewlines(sql: string): string {
  return `${sql.replace(/\s+$/, '')}${EDITOR_TRAILING_NEWLINES}`;
}

/**
 * Kopijavimui: ref → BQ keliai; BQ dbt lentelės → ref; kitaip tas pats SQL.
 */
export function transformSqlForClipboard(sql: string): string {
  const normalized = normalizeInputSql(sql);

  if (containsDbtRefMacro(normalized)) {
    return replaceDbtRefWithQualifiedBackticks(normalized, BQ_DBT_PROJECT);
  }

  const toRef = replaceQualifiedBackticksWithDbtRef(normalized);
  if (toRef.includes("{{ ref(")) {
    return toRef;
  }

  return normalized;
}

/**
 * Vienos eilutės užklausa → formatuotas SELECT * (raw: partition, stg: scd, kitaip be WHERE).
 */
export function transformSmartSingleLine(sql: string): SmartTransformResult {
  const normalized = normalizeInputSql(sql);
  assertSingleLineSql(normalized);

  const parsed = parseFromQuery(normalized);
  if (!parsed) {
    throw new Error('Nepavyko rasti FROM dalies užklausoje.');
  }

  const kind = classifyFromTargetKind(parsed.fromTarget);
  const fromLine = parsed.fromTarget;

  let whereLine: string | null = null;
  if (kind === 'raw') {
    whereLine = PARTITION_WHERE;
  } else if (kind === 'stg') {
    whereLine = SCD_ACTIVE_WHERE;
  }

  const lines = ['select', '  *', `from ${fromLine}`];

  if (whereLine) {
    lines.push(whereLine);
  }

  if (parsed.orderBy) {
    lines.push(lowercaseSqlKeywords(parsed.orderBy));
  }

  const body = lines.join('\n');
  const withLimit = `${body}\n${LIMIT_COMMENT}`;

  return {
    kind,
    sql: withEditorTrailingNewlines(withLimit),
  };
}
