export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { POST } from '@/app/api/send/route';
import { notFound } from '@/lib/response';
import { getPixelBySlug } from '@/queries/drizzle';

const image = Buffer.from('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw', 'base64');

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const pixel = await getPixelBySlug(slug);

  if (!pixel) return notFound();

  const payload = {
    type: 'event',
    payload: {
      pixel: pixel.id,
      url: request.url,
      referrer: request.headers.get('referer') || undefined,
    },
  };

  const req = new Request(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify(payload),
  });

  await POST(req);

  return new NextResponse(image, {
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': image.length.toString(),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}
