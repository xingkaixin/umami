import { beforeEach, expect, test, vi } from 'vitest';
import { parseRequest } from '@/lib/request';
import { canUpdateTeam } from '@/permissions';
import { getTeam } from '@/queries/drizzle';
import { GET } from './route';

vi.mock('@/lib/request', () => ({ parseRequest: vi.fn() }));
vi.mock('@/permissions', () => ({
  canDeleteTeam: vi.fn(),
  canUpdateTeam: vi.fn(),
  canViewTeam: vi.fn().mockResolvedValue(true),
}));
vi.mock('@/queries/drizzle', () => ({
  deleteTeam: vi.fn(),
  getTeam: vi.fn(),
  updateTeam: vi.fn(),
}));

const getAsMember = () =>
  GET(new Request('http://localhost/api/teams/team-1'), {
    params: Promise.resolve({ teamId: 'team-1' }),
  }).then(r => r.json());

beforeEach(() => {
  vi.mocked(parseRequest).mockResolvedValue({ auth: { user: { id: 'user-1' } } } as any);
  vi.mocked(getTeam).mockResolvedValue({ id: 'team-1', name: 'Team', accessCode: 'secret' } as any);
});

// A view-only member who reads the access code could leave and rejoin as a full member.
test('members who cannot edit the team do not receive the access code', async () => {
  vi.mocked(canUpdateTeam).mockResolvedValue(false);

  expect(await getAsMember()).toEqual({ id: 'team-1', name: 'Team' });
});

test('owners and managers still receive the access code', async () => {
  vi.mocked(canUpdateTeam).mockResolvedValue(true);

  expect((await getAsMember()).accessCode).toBe('secret');
});
