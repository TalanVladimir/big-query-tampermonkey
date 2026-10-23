import {
  LIMIT_COMMENT,
  PARTITION_WHERE,
  SCD_ACTIVE_WHERE,
} from '../constants';
import {
  parseFromQuery,
  toDbtRefFromTarget,
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

function buildSelectBlockDbtRef(
  fromLine: string,
  whereLine: string,
  orderBy: string | null,
): string {
  const lines = ['SELECT', '  *', `FROM ${fromLine}`, whereLine.toLowerCase()];

  if (orderBy) {
    lines.push(orderBy.toLowerCase());
  }

  return lines.join('\n');
}

/**
 * Konvertuoja užklausą į dbt ref formatą (kopijavimui).
 */
export function transformToDbtRef(sql: string): string {
  const parsed = parseFromQuery(sql);
  if (!parsed) {
    throw new Error('Nepavyko rasti FROM dalies užklausoje.');
  }

  const fromLine = toDbtRefFromTarget(parsed.fromTarget);
  const whereLine = parsed.otherWhere
    ? `where ${parsed.otherWhere}`
    : PARTITION_WHERE;

  return buildSelectBlockDbtRef(fromLine, whereLine, parsed.orderBy);
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

  return `${body}\n${LIMIT_COMMENT}`;
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

  return buildSelectBlockLower(fromLine, SCD_ACTIVE_WHERE, null);
}
