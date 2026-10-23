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

/** `proj`.`dataset`.`table` */
const CHAINED_BACKTICK_TABLE_REGEX = /`[^`]+`(?:\.`[^`]+`)+/g;

/** `project.dataset.table` */
const BACKTICK_IDENTIFIER_REGEX = /`([^`]+)`/g;

const LINE_LETTER_REGEX = /[A-Za-zĄČĘĖĮŠŲŪŽąčęėįšųūž]/;

const TRAILING_SPACES_REGEX = /[ \t\u00a0]+$/u;

const LEADING_SPACES_REGEX = /^[ \t\u00a0]+/u;

const SQL_KEYWORDS = [
  'select',
  'from',
  'where',
  'and',
  'or',
  'not',
  'in',
  'as',
  'on',
  'join',
  'inner',
  'left',
  'right',
  'full',
  'cross',
  'outer',
  'group',
  'by',
  'order',
  'limit',
  'offset',
  'having',
  'union',
  'all',
  'distinct',
  'case',
  'when',
  'then',
  'else',
  'end',
  'cast',
  'safe_cast',
  'coalesce',
  'nullif',
  'between',
  'like',
  'is',
  'null',
  'true',
  'false',
  'asc',
  'desc',
  'nulls',
  'first',
  'last',
  'over',
  'partition',
  'window',
  'qualify',
  'row_number',
  'unbounded',
  'preceding',
  'following',
  'current',
  'row',
  'with',
  'recursive',
  'except',
  'intersect',
  'using',
  'unnest',
  'datetime',
  'timestamp',
  'interval',
  'extract',
  'trim',
  'int',
  'int64',
  'float64',
  'numeric',
  'string',
  'bool',
  'ignore',
  'rows',
  'range',
  'day',
  'month',
  'year',
  'date',
];

const LITERAL_OR_COMMENT_REGEX =
  /(`[^`]*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|--[^\n]*|\/\*[\s\S]*?\*\/)/g;

/**
 * Mažosios raidės tik SQL raktažodžiams (ne lentelėms, stulpeliams, stringams).
 */
export function lowercaseSqlKeywords(sql: string): string {
  const preserved: string[] = [];
  const masked = sql.replace(LITERAL_OR_COMMENT_REGEX, match => {
    preserved.push(match);
    return `\x01${preserved.length - 1}\x01`;
  });

  const keywords = [...SQL_KEYWORDS].sort((a, b) => b.length - a.length);
  let result = masked;

  for (const keyword of keywords) {
    const pattern = new RegExp(
      `\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
      'gi',
    );
    result = result.replace(pattern, keyword);
  }

  return result.replace(/\x01(\d+)\x01/g, (_, index) => preserved[+index]);
}

/**
 * Pašalina tarpus eilutės gale; jei eilutėje nėra raidžių – ir pradžioje.
 */
export function trimTrailingSpacesPerLine(sql: string): string {
  return sql
    .split(/\r\n|\r|\n/)
    .map(line => {
      const withoutTrailing = line.replace(TRAILING_SPACES_REGEX, '');
      if (!LINE_LETTER_REGEX.test(withoutTrailing)) {
        return withoutTrailing.replace(LEADING_SPACES_REGEX, '');
      }

      return withoutTrailing;
    })
    .join('\n');
}

/**
 * `proj.dataset.table` be backtick (BigQuery explorer kartais taip įrašo).
 */
const UNQUOTED_QUALIFIED_TABLE_REGEX =
  /\b([A-Za-z_][\w-]*)\.([A-Za-z_][\w]*)\.([A-Za-z_][\w]*)\b/g;

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

  return toDbtRef(tableName);
}

/**
 * Suformuoja dbt ref('model') eilutę.
 */
function toDbtRef(tableName: string): string {
  const safeName = tableName.replace(/'/g, "\\'");
  return `{{ ref('${safeName}') }}`;
}

/**
 * Paskutinis segmentas iš `a`.`b`.`c` arba `a.b.c`.
 */
function tableNameFromQualifiedPath(path: string): string | null {
  const parts = path
    .split('.')
    .map(part => part.replace(/^`|`$/g, '').trim())
    .filter(part => part.length > 0);

  const name = parts[parts.length - 1];
  return name ?? null;
}

/**
 * Ar tekstas jau yra dbt ref.
 */
function isInsideDbtRef(sql: string, index: number): boolean {
  const before = sql.slice(Math.max(0, index - 80), index);
  return /\{\{\s*ref\s*\([^)]*$/i.test(before);
}

/**
 * Pakeičia kvalifikuotas BigQuery lentelės nuorodas į dbt ref('...').
 * Neanalizuoja užklausos — veikia FROM, JOIN, CTE ir kt.
 */
export function replaceQualifiedBackticksWithDbtRef(sql: string): string {
  let result = sql.replace(CHAINED_BACKTICK_TABLE_REGEX, segment => {
    const tableName = tableNameFromQualifiedPath(segment);
    return tableName ? toDbtRef(tableName) : segment;
  });

  result = result.replace(BACKTICK_IDENTIFIER_REGEX, (full, inner: string) => {
    if (!inner.includes('.')) {
      return full;
    }

    const tableName = tableNameFromQualifiedPath(inner);
    if (!tableName) {
      return full;
    }

    return toDbtRef(tableName);
  });

  result = result.replace(
    UNQUOTED_QUALIFIED_TABLE_REGEX,
    (full, _project, _dataset, table, offset) => {
      if (isInsideDbtRef(result, offset)) {
        return full;
      }

      return toDbtRef(table);
    },
  );

  return result;
}
