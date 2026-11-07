// Drizzle wraps D1 failures in an error whose own message is the failed SQL.
export function isUniqueConstraintError(error: unknown, column: string) {
  const { cause, message } = (error ?? {}) as { cause?: { message?: string }; message?: string };

  return `${cause?.message ?? ''} ${message ?? ''}`.includes(`UNIQUE constraint failed: ${column}`);
}
