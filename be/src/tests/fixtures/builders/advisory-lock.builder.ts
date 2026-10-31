/** The statement `advisoryXactLock` sends first: the 64-bit hash of the lock key. */
export const HASH_STATEMENT = 'SELECT * FROM "pg_catalog"."hashtextextended"($1, $2)'

/** The statement `advisoryXactLock` sends second: the transaction-scoped lock on that hash. */
export const LOCK_STATEMENT = 'SELECT * FROM "pg_catalog"."pg_advisory_xact_lock"($1)'

/** The hash the hash statement answers (node-postgres returns a bigint as a string). */
export const LOCK_HASH = "-7449279462573581543"

/** The answers of a mocked entity manager to the two statements `advisoryXactLock` sends. */
export const advisoryLockAnswers: ReadonlyArray<readonly [string, unknown]> = [
    [HASH_STATEMENT, [{ hashtextextended: LOCK_HASH }]],
    [LOCK_STATEMENT, [{}]],
]
