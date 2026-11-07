// SQLite LIKE has no default escape character; pair escaped values with `escape '\'`.
export function escapeLikeValue(value: string) {
  return value.replace(/[\\%_]/g, '\\$&');
}

export function getWildcardMatch(column: string, param: string, value: string) {
  if (!value.includes('*')) {
    return { sql: `${column} = {{${param}}}`, value };
  }

  return {
    sql: `${column} like {{${param}}} escape '\\'`,
    value: escapeLikeValue(value).replaceAll('*', '%'),
  };
}
