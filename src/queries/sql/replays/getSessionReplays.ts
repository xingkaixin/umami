import { parseFilters } from '@/db/filters';
import { pagedRawQuery } from '@/db/query';
import type { QueryFilters } from '@/lib/types';

export async function getSessionReplays(
  websiteId: string,
  filters: QueryFilters,
  sessionId?: string,
) {
  const { search, minDuration } = filters;
  const minDurationMs = minDuration && minDuration > 0 ? minDuration * 1000 : undefined;
  const { filterQuery, cohortQuery, queryParams, joinSessionQuery } = await parseFilters({
    ...filters,
    websiteId,
    search: search ? `%${search}%` : undefined,
  });

  const joinQuery =
    filterQuery || cohortQuery
      ? `join (select distinct website_event.website_id, website_event.session_id, website_event.visit_id
               from website_event
               ${joinSessionQuery}
               ${cohortQuery}
               where website_event.website_id = {{websiteId}}
                  and website_event.created_at between {{startDate}} and {{endDate}}
                  ${filterQuery}) website_event
        on website_event.website_id = sr.website_id
          and website_event.session_id = sr.session_id
          and website_event.visit_id = sr.visit_id`
      : '';

  const sessionFilter = sessionId ? 'and sr.session_id = {{sessionId}}' : '';

  const searchQuery = search
    ? `and (session.distinct_id like {{search}}
           or session.city like {{search}}
           or session.browser like {{search}}
           or session.os like {{search}}
           or session.device like {{search}})`
    : '';

  const havingQuery = minDurationMs
    ? `having sum(round((julianday(sr.ended_at) - julianday(sr.started_at)) * 86400000)) >= {{minDurationMs}}`
    : '';

  return pagedRawQuery(
    `
    select
      sr.visit_id as "id",
      sr.session_id as "sessionId",
      sr.website_id as "websiteId",
      session.browser,
      session.os,
      session.device,
      session.country,
      session.city,
      sum(sr.event_count) as "eventCount",
      count(sr.replay_id) as "chunkCount",
      min(sr.started_at) as "startedAt",
      max(sr.ended_at) as "endedAt",
      sum(round((julianday(sr.ended_at) - julianday(sr.started_at)) * 86400000)) as "duration",
      max(sr.created_at) as "createdAt"
    from session_replay sr
    join session on session.session_id = sr.session_id
      and session.website_id = sr.website_id
    ${joinQuery}
    where sr.website_id = {{websiteId}}
      and sr.created_at between {{startDate}} and {{endDate}}
    ${sessionFilter}
    ${searchQuery}
    group by sr.visit_id,
      sr.session_id,
      sr.website_id,
      session.browser,
      session.os,
      session.device,
      session.country,
      session.city
    ${havingQuery}
    order by max(sr.created_at) desc
    `,
    { ...queryParams, sessionId, minDurationMs },
    filters,
  );
}
