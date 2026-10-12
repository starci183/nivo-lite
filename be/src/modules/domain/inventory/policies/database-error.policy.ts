/** The PostgreSQL code of a unique-constraint violation. */
const UNIQUE_VIOLATION = "23505"

/** True when a failure thrown by the database driver is a unique-constraint violation. */
export const isUniqueViolation = (cause: unknown): boolean =>
    typeof cause === "object" && cause !== null && "code" in cause && cause.code === UNIQUE_VIOLATION
