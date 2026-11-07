import { rawQuery } from '@/db/query';

interface ReplayDistinctId {
  visitId: string;
  distinctId: string;
  linked: number;
}

export async function getReplayDistinctIds(
  websiteId: string,
  visitIds: string[],
): Promise<Record<string, string[]>> {
  if (!visitIds.length) {
    return {};
  }

  const rows = await rawQuery<ReplayDistinctId[]>(
    `
    select distinct sr.visit_id as "visitId", session_link.distinct_id as "distinctId", 1 as "linked"
    from session_replay sr
    join session_link on session_link.website_id = sr.website_id
      and session_link.session_id = sr.session_id
    where sr.website_id = {{websiteId}}
      and sr.visit_id in (select value from json_each({{visitIds}}))
    union
    select distinct sr.visit_id, session.distinct_id, 0
    from session_replay sr
    join session on session.website_id = sr.website_id
      and session.session_id = sr.session_id
    where sr.website_id = {{websiteId}}
      and sr.visit_id in (select value from json_each({{visitIds}}))
      and session.distinct_id <> ''
    `,
    { websiteId, visitIds },
  );

  // Same rule as the session details: linked IDs take precedence over the session's own ID.
  const linked: Record<string, Set<string>> = {};
  const own: Record<string, Set<string>> = {};

  for (const { visitId, distinctId, linked: isLinked } of rows) {
    const target = isLinked ? linked : own;
    target[visitId] ??= new Set();
    target[visitId].add(distinctId);
  }

  return Object.fromEntries(
    visitIds.map(visitId => [visitId, [...(linked[visitId] ?? own[visitId] ?? [])].sort()]),
  );
}
