import { and, asc, count, desc, eq, ne, or } from 'drizzle-orm';
import { getDatabase } from '@/db/client';
import { contains, paginate } from '@/db/pagination';
import { board, type NewBoard } from '@/db/schema';
import { BOARD_TYPES } from '@/lib/boards';
import { sanitizeSortFilters } from '@/lib/sort';
import type { QueryFilters } from '@/lib/types';

const SORT_FIELDS = ['name', 'description', 'type', 'createdAt'] as const;

export async function getBoard(id: string) {
  return (await getDatabase().select().from(board).where(eq(board.id, id)).get()) ?? null;
}

async function listBoards(owner: { userId?: string; teamId?: string }, filters: QueryFilters = {}) {
  const db = getDatabase();
  const options = sanitizeSortFilters(filters, SORT_FIELDS);
  const where = and(
    owner.userId ? eq(board.userId, owner.userId) : undefined,
    owner.teamId ? eq(board.teamId, owner.teamId) : undefined,
    ne(board.type, BOARD_TYPES.dashboard),
    options.search
      ? or(contains(board.name, options.search), contains(board.description, options.search))
      : undefined,
  );
  const sort = board[options.orderBy as (typeof SORT_FIELDS)[number]] ?? board.createdAt;
  return paginate(
    db
      .select()
      .from(board)
      .where(where)
      .orderBy(options.sortDescending ? desc(sort) : asc(sort), asc(board.id))
      .$dynamic(),
    db.select({ count: count() }).from(board).where(where),
    options,
  );
}

export function getUserBoards(userId: string, filters?: QueryFilters) {
  return listBoards({ userId }, filters);
}

export function getTeamBoards(teamId: string, filters?: QueryFilters) {
  return listBoards({ teamId }, filters);
}

export async function createBoard(data: NewBoard) {
  return getDatabase().insert(board).values(data).returning().get();
}

export async function updateBoard(id: string, data: Partial<NewBoard>) {
  return getDatabase().update(board).set(data).where(eq(board.id, id)).returning().get();
}

export async function deleteBoard(id: string) {
  return getDatabase().delete(board).where(eq(board.id, id)).returning().get();
}
