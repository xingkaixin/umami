import { z } from 'zod';
import { parseRequest } from '@/lib/request';
import { json, unauthorized } from '@/lib/response';
import { pagingParams, searchParams, sortingParams } from '@/lib/schema';
import { canViewAllTeams } from '@/permissions';
import { getTeams } from '@/queries/drizzle/team';

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

  if (!(await canViewAllTeams(auth))) {
    return unauthorized();
  }

  const teams = await getTeams(query);

  return json(teams);
}
