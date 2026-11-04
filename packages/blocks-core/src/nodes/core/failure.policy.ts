/** The kind of a failure a node survives, for the person who decides afterwards: the name of the error, never its text. */
export const failureKindOf = (error: unknown): string => (error instanceof Error ? error.name : typeof error)
