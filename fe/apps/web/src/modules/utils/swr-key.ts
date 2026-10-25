/**
 * The matcher of every SWR key of one operation (the plain key and the argument tuples that start with it), for `mutate`
 * revalidation after a write changed what the operation answers.
 */
export const matchesSwrKey =
    (operationKey: string) =>
    (key: unknown): boolean =>
        key === operationKey || (Array.isArray(key) && key[0] === operationKey)

/**
 * The matcher of the cached answers a workspace switch drops: every tuple key (workspace reads `[name, workspaceId, ...]` and
 * entity reads `[name, id]`) except the viewer's own reads `[name, viewerKeyId]`. Plain string keys name workspace-free reads
 * (catalogues, deployment flags). The kept reads stay mounted through the switch under the same key, and SWR does not refetch a
 * mounted read whose entry was dropped without revalidation.
 */
export const isWorkspaceSwitchSwrKey =
    (viewerKeyId: string | undefined) =>
    (key: unknown): boolean =>
        Array.isArray(key) && key[1] !== viewerKeyId
