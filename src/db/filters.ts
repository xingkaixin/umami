import { DATA_TYPE, FILTER_COLUMNS, OPERATORS, SESSION_COLUMNS } from '@/lib/constants';
import { filtersObjectToArray } from '@/lib/params';
import type { Operator, PropertyFilter, QueryFilters, QueryOptions } from '@/lib/types';
import { getLocalDayRange } from './dates';
import { getRegexValues } from './regex';

type Scope = QueryFilters & { websiteId: string; [key: string]: any };
const equality = [OPERATORS.equals, OPERATORS.notEquals];
const regexOperators = [OPERATORS.regex, OPERATORS.notRegex];
const numericOperators = {
  [OPERATORS.equals]: '=',
  [OPERATORS.notEquals]: '!=',
  [OPERATORS.greaterThan]: '>',
  [OPERATORS.lessThan]: '<',
  [OPERATORS.greaterThanEquals]: '>=',
  [OPERATORS.lessThanEquals]: '<=',
};

async function textCondition(
  column: string,
  operator: Operator,
  value: string | string[],
  key: string,
  params: Record<string, unknown>,
  table: string,
  scope: Scope,
  propertyName?: string,
) {
  if (regexOperators.includes(operator as (typeof regexOperators)[number])) {
    params[key] = await getRegexValues(
      table,
      column.split('.').at(-1),
      String(value),
      scope,
      propertyName,
    );
    const not = operator === OPERATORS.notRegex ? 'not ' : '';
    return `${column} is not null and ${column} ${not}in (select value from json_each({{${key}}}))`;
  }
  if (equality.includes(operator as (typeof equality)[number])) {
    params[key] = Array.isArray(value) ? value : [value];
    return `${column} ${operator === OPERATORS.notEquals ? 'not ' : ''}in (select value from json_each({{${key}}}))`;
  }
  params[key] = `%${value}%`;
  return `lower(${column}) ${operator === OPERATORS.doesNotContain ? 'not ' : ''}like lower({{${key}}})`;
}

export async function getColumnFilters(
  filters: Scope,
  options: QueryOptions & { table?: 'heatmap_event' } = {},
) {
  const all: string[] = [];
  const alternatives: string[] = [];
  const params: Record<string, unknown> = {};
  const cohort = options.isCohort;
  for (const filter of filtersObjectToArray(filters, options)) {
    const { name, operator, value, prefix = '', paramName } = filter;
    const baseName = cohort ? name.replace(/^cohort_/, '') : name;
    const column = cohort ? FILTER_COLUMNS[baseName] : filter.column;
    if (!column) continue;
    const table =
      options.table ?? (SESSION_COLUMNS.includes(baseName) ? 'session' : 'website_event');
    const alias = table === 'heatmap_event' ? 'h' : table;
    const key = paramName ?? name;
    const scope = cohort
      ? { ...filters, startDate: filters.cohort_startDate, endDate: filters.cohort_endDate }
      : filters;
    const condition = await textCondition(
      `${alias}.${prefix}${column}`,
      operator,
      value,
      key,
      params,
      table,
      scope,
    );
    const any = cohort ? options.cohortMatch === 'any' : filters.match === 'any';
    const required = baseName === 'eventType' || (cohort && name === options.cohortActionName);
    (any && !required ? alternatives : all).push(`(${condition})`);
    if (baseName === 'referrer') {
      all.push(
        `(website_event.referrer_domain != case when substr(website_event.hostname, 1, 4) = 'www.' then substr(website_event.hostname, 5) else website_event.hostname end or website_event.referrer_domain is null)`,
      );
    }
  }
  if (alternatives.length) all.push(`(${alternatives.join(' or ')})`);
  return { sql: all.map(clause => `and ${clause}`).join('\n'), params };
}

export function getSearchSQL(column: string, param = 'search') {
  return `and lower(${column}) like lower({{${param}}})`;
}

async function propertyFilters(
  filters: PropertyFilter[],
  propertyType: 'event' | 'session',
  timezone: string,
  scope: Scope,
  prefix: string,
) {
  const table = propertyType === 'event' ? 'event_data' : 'session_data';
  const id =
    propertyType === 'event'
      ? 'website_event_id = website_event.event_id'
      : 'session_id = website_event.session_id';
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};
  for (const [index, filter] of filters.entries()) {
    const { propertyName, dataType, operator, value } = filter;
    if (!value && dataType !== DATA_TYPE.number) continue;
    const key = `${prefix}_key_${index}`;
    const val = `${prefix}_val_${index}`;
    params[key] = propertyName;
    let condition: string;
    if (dataType === DATA_TYPE.number) {
      params[val] = Number.parseFloat(value) || 0;
      condition = `cast(number_value as real) ${numericOperators[operator] ?? '='} {{${val}}}`;
    } else if (dataType === DATA_TYPE.date) {
      const { start, end } = getLocalDayRange(value, timezone);
      params[val] = start;
      params[`${val}_end`] = end;
      condition =
        operator === OPERATORS.before
          ? `date_value < {{${val}}}`
          : operator === OPERATORS.after
            ? `date_value >= {{${val}_end}}`
            : `date_value >= {{${val}}} and date_value < {{${val}_end}}`;
    } else if (dataType === DATA_TYPE.array) {
      params[val] = value;
      condition = `${operator === OPERATORS.contains ? '' : 'not '}exists (
        select 1 from json_each(coalesce(string_value, '[]')) array_item
        where cast(array_item.value as text) = {{${val}}}
      )`;
    } else {
      const values = equality.includes(operator as (typeof equality)[number])
        ? value.split(',').filter(Boolean)
        : value;
      condition = await textCondition(
        'string_value',
        operator,
        values,
        val,
        params,
        table,
        scope,
        propertyName,
      );
    }
    clauses.push(`and exists (
      select 1 from ${table}
      where website_id = website_event.website_id and ${id}
        and data_key = {{${key}}} and data_type = ${Number(dataType)}
        and (${condition})
    )`);
  }
  return { sql: clauses.join('\n'), params };
}

export function getPropertyFilterQuery(
  filters: PropertyFilter[] = [],
  type: 'event' | 'session' = 'event',
  timezone = 'utc',
  scope: Scope,
) {
  return propertyFilters(filters, type, timezone, scope, 'pf');
}

export async function parseFilters(filters: Scope, options: QueryOptions = {}) {
  const normal = await getColumnFilters(filters, options);
  const event = await propertyFilters(
    filters.eventPropertyFilters ?? [],
    'event',
    filters.timezone ?? 'utc',
    filters,
    'epf',
  );
  const session = await propertyFilters(
    filters.sessionPropertyFilters ?? [],
    'session',
    filters.timezone ?? 'utc',
    filters,
    'spf',
  );
  const cohortKeys = Object.keys(filters).filter(key => key.startsWith('cohort_'));
  const cohort = cohortKeys.length
    ? await getColumnFilters(
        {
          ...Object.fromEntries(cohortKeys.map(key => [key, filters[key]])),
          websiteId: filters.websiteId,
        },
        {
          isCohort: true,
          cohortMatch: filters.cohort_match,
          cohortActionName: filters.cohort_actionName,
        },
      )
    : { sql: '', params: {} };
  const joinSession =
    options.joinSession ||
    filtersObjectToArray(filters).some(filter => SESSION_COLUMNS.includes(filter.name));
  return {
    joinSessionQuery: joinSession
      ? `inner join session on website_event.session_id = session.session_id and website_event.website_id = session.website_id`
      : '',
    dateQuery: filters.startDate
      ? filters.endDate
        ? `and website_event.created_at between {{startDate}} and {{endDate}}`
        : `and website_event.created_at >= {{startDate}}`
      : '',
    filterQuery: [normal.sql, event.sql, session.sql].filter(Boolean).join('\n'),
    queryParams: {
      ...filters,
      ...normal.params,
      ...event.params,
      ...session.params,
      ...cohort.params,
    },
    cohortQuery: cohortKeys.length
      ? `join (
      select distinct website_event.session_id from website_event
      join session on session.session_id = website_event.session_id and session.website_id = website_event.website_id
      where website_event.website_id = {{websiteId}}
        and website_event.created_at between {{cohort_startDate}} and {{cohort_endDate}}
        ${cohort.sql}
    ) cohort on cohort.session_id = website_event.session_id`
      : '',
    excludeBounceQuery: filters.excludeBounce
      ? `join (
      select session_id, visit_id from website_event
      where website_id = {{websiteId}} and created_at between {{startDate}} and {{endDate}} and event_type != 5
      group by session_id, visit_id
      having sum(case when event_type not in (2, 5) then 1 else 0 end) > 1
        or (sum(case when event_type not in (2, 5) then 1 else 0 end) = 1
          and sum(case when event_type = 2 then 1 else 0 end) > 0)
    ) excludeBounce on excludeBounce.session_id = website_event.session_id and excludeBounce.visit_id = website_event.visit_id`
      : '',
  };
}
