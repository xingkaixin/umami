import { expect, test, vi } from 'vitest';
import { getBoardEntityIds } from '@/lib/boards';
import { ENTITY_TYPE } from '@/lib/constants';
import { createToken } from '@/lib/jwt';
import { getBoard, getLink, getPixel, getShareByCode, getWebsite } from '@/queries/drizzle';
import { GET } from './route';

vi.mock('@/lib/boards', () => ({ getBoardEntityIds: vi.fn() }));
vi.mock('@/lib/crypto', () => ({ secret: () => 'app-secret' }));
vi.mock('@/lib/jwt', () => ({ createToken: vi.fn(() => 'share-token') }));
vi.mock('@/permissions', () => ({
  canViewWebsite: vi.fn(),
  canViewPixel: vi.fn(),
  canViewLink: vi.fn(),
}));
vi.mock('@/queries/drizzle', () => ({
  getBoard: vi.fn(),
  getLink: vi.fn(),
  getPixel: vi.fn(),
  getShareByCode: vi.fn(),
  getUser: vi.fn(),
  getWebsite: vi.fn(),
}));

const entities: Record<string, { userId: string | null; teamId: string | null }> = {
  'team-site': { teamId: 'team-1', userId: null },
  'member-site': { teamId: null, userId: 'member-1' },
  'other-team-site': { teamId: 'team-2', userId: null },
  'team-pixel': { teamId: 'team-1', userId: null },
  'member-pixel': { teamId: null, userId: 'member-1' },
  'team-link': { teamId: 'team-1', userId: null },
  'member-link': { teamId: null, userId: 'member-1' },
};

test("a team board share excludes members' personal entities", async () => {
  const lookup = async (id: string) => entities[id] ?? null;
  vi.mocked(getWebsite).mockImplementation(lookup as any);
  vi.mocked(getPixel).mockImplementation(lookup as any);
  vi.mocked(getLink).mockImplementation(lookup as any);
  vi.mocked(getBoardEntityIds).mockReturnValue({
    websiteIds: ['team-site', 'member-site', 'other-team-site'],
    pixelIds: ['team-pixel', 'member-pixel'],
    linkIds: ['team-link', 'member-link'],
  });
  vi.mocked(getShareByCode).mockResolvedValue({
    id: 'share-1',
    shareType: ENTITY_TYPE.board,
    entityId: 'board-1',
    parameters: {},
  } as any);
  vi.mocked(getBoard).mockResolvedValue({
    id: 'board-1',
    type: 'dashboard',
    parameters: {},
    teamId: 'team-1',
    userId: null,
  } as any);

  await GET(new Request('http://localhost/api/share/slug'), {
    params: Promise.resolve({ slug: 'slug' }),
  });

  expect(vi.mocked(createToken).mock.calls[0][0]).toMatchObject({
    websiteIds: ['team-site'],
    pixelIds: ['team-pixel'],
    linkIds: ['team-link'],
  });
});
