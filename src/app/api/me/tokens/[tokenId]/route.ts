import { parseRequest } from '@/lib/request';
import { forbidden, notFound, ok } from '@/lib/response';
import { deleteApiToken } from '@/queries/drizzle';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tokenId: string }> },
) {
  const { auth, error } = await parseRequest(request);

  if (error) {
    return error();
  }

  if (auth.apiToken) {
    return forbidden({ code: 'read-only-token', message: 'API tokens cannot manage API tokens' });
  }

  const { tokenId } = await params;
  const deleted = await deleteApiToken(tokenId, auth.user.id);

  if (!deleted) {
    return notFound();
  }

  return ok();
}
