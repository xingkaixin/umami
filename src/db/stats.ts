export function rankedQuery(source: string, columns: string[], groups: string[] = []) {
  for (const column of [...columns, ...groups]) {
    if (!/^[a-zA-Z_]\w*$/.test(column)) throw new Error('Invalid statistics column.');
  }
  const partition = groups.length ? `partition by ${groups.join(', ')}` : '';
  const ranking = columns.flatMap(column => [
    `row_number() over (${partition} order by ${column} is null, cast(${column} as real)) as rank_${column}`,
    `count(${column}) over (${partition}) as count_${column}`,
  ]);
  return `with samples as (${source}), ranked as (select *, ${ranking.join(', ')} from samples)`;
}

export function percentileSQL(column: string, percentile: number) {
  if (
    !/^[a-zA-Z_]\w*$/.test(column) ||
    percentile < 0 ||
    percentile > 1 ||
    !Number.isFinite(percentile)
  ) {
    throw new Error('Invalid percentile.');
  }
  const position = `((count_${column} - 1) * ${percentile})`;
  const fraction = `(${position} - floor(${position}))`;
  return `sum(case
    when rank_${column} = floor(${position}) + 1 then cast(${column} as real) * (1 - ${fraction})
    when rank_${column} = ceil(${position}) + 1 then cast(${column} as real) * ${fraction}
  end)`;
}
