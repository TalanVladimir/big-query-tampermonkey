export type ParsedFromQuery = {
  fromTarget: string;
  orderBy: string | null;
  otherWhere: string | null;
};

const FROM_REGEX =
  /\bfrom\s+((?:`[^`]+`|'[^']+'|\{\{\s*ref\s*\([^)]+\)\s*\}\}))\s*/i;

const LIMIT_REGEX = /\blimit\s+\d+\s*$/i;

const ORDER_BY_REGEX = /\border\s+by\b[\s\S]*$/i;

const WHERE_REGEX = /\bwhere\b([\s\S]*?)(?=\border\s+by\b|\blimit\b|$)/i;

/**
 * Pašalina SQL komentarus ir sutraukia tarpus vienoje eilutėje analizei.
 */
export function collapseSql(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Ištraukia FROM objektą (backtick lentelė arba ref) ir likusias WHERE / ORDER BY dalis.
 */
export function parseFromQuery(sql: string): ParsedFromQuery | null {
  const normalized = collapseSql(sql);
  const fromMatch = normalized.match(FROM_REGEX);

  if (!fromMatch || fromMatch.index === undefined) {
    return null;
  }

  const fromTarget = fromMatch[1];
  let tail = normalized.slice(fromMatch.index + fromMatch[0].length);

  tail = tail.replace(LIMIT_REGEX, '').trim();

  let orderBy: string | null = null;
  const orderMatch = tail.match(ORDER_BY_REGEX);
  if (orderMatch) {
    orderBy = orderMatch[0].trim();
    tail = tail.slice(0, orderMatch.index).trim();
  }

  let otherWhere: string | null = null;
  const whereMatch = tail.match(WHERE_REGEX);
  if (whereMatch) {
    const clause = whereMatch[1].trim();
    if (clause.length > 0) {
      otherWhere = clause;
    }
  }

  return { fromTarget, orderBy, otherWhere };
}

/**
 * Paima paskutinį segmentą iš pilnos lentelės kelio backtick'uose.
 */
export function tableNameFromBackticks(fromTarget: string): string | null {
  const match = fromTarget.match(/^`([^`]+)`$/);
  if (!match) {
    return null;
  }

  const parts = match[1].split('.');
  const name = parts[parts.length - 1]?.trim();

  return name && name.length > 0 ? name : null;
}

/**
 * FROM backtick lentelę pakeičia į dbt ref('...').
 */
export function toDbtRefFromTarget(fromTarget: string): string {
  const tableName = tableNameFromBackticks(fromTarget);
  if (!tableName) {
    return fromTarget;
  }

  return `{{ ref('${tableName}') }}`;
}
