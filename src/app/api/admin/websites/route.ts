import { z } from 'zod';
import { ROLES } from '@/lib/constants';
import { parseRequest } from '@/lib/request';
import { json, unauthorized } from '@/lib/response';
import { pagingParams, searchParams, sortingParams } from '@/lib/schema';
import { canViewAllWebsites } from '@/permissions';
import { getWebsites } from '@/queries/drizzle/website';

export async function GET(request: Request) {
  const schema = z.object({
    ...pagingParams,
    ...searchParams,
    ...sortingParams,
  });

  const { auth, query, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  if (!(await canViewAllWebsites(auth))) {
    return unauthorized();
  }

  const websites = await getWebsites(query, { includeUser: true, includeTeam: true });

  return json(websites);
}
