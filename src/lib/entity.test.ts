import { beforeEach, expect, test, vi } from 'vitest';
import { getBoard, getLink, getPixel, getUser, getWebsite } from '@/queries/drizzle';
import { isEntityIdInUse } from './entity';

vi.mock('@/queries/drizzle', () => ({
  getBoard: vi.fn(),
  getLink: vi.fn(),
  getPixel: vi.fn(),
  getUser: vi.fn(),
  getWebsite: vi.fn(),
}));

const id = '9b27b8ed-d01f-4a51-acaf-7b68f333431e';

beforeEach(() => {
  vi.mocked(getBoard).mockResolvedValue(null);
  vi.mocked(getLink).mockResolvedValue(null);
  vi.mocked(getPixel).mockResolvedValue(null);
  vi.mocked(getUser).mockResolvedValue(null);
  vi.mocked(getWebsite).mockResolvedValue(null);
});

test('isEntityIdInUse is false when no entity or user has the id', async () => {
  expect(await isEntityIdInUse(id)).toBe(false);
});

test('isEntityIdInUse is true when another entity already has the id', async () => {
  vi.mocked(getLink).mockResolvedValue({ id } as any);

  expect(await isEntityIdInUse(id)).toBe(true);
});

test('isEntityIdInUse is true when the id belongs to a user, including deleted users', async () => {
  vi.mocked(getUser).mockResolvedValue({ id } as any);

  expect(await isEntityIdInUse(id)).toBe(true);
  expect(getUser).toHaveBeenCalledWith(id, { showDeleted: true });
});
