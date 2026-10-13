/**
 * The matcher of every SWR key of one operation (the plain key and the argument tuples that start with it), for `mutate`
 * revalidation after a write changed what the operation answers.
 */
export const matchesSwrKey =
    (operationKey: string) =>
    (key: unknown): boolean =>
        key === operationKey || (Array.isArray(key) && key[0] === operationKey)
