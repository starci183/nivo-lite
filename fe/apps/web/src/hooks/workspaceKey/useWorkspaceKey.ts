import { tenantKey, type KeyOrWait } from "@starci/next-data"
import { useOpenWorkspaceId } from "./useOpenWorkspaceId"

/**
 * The SWR key of a read scoped to the active workspace: `[name, workspaceId, ...rest]`, so a switch of workspace reads
 * afresh. It is null (the read waits) until the store knows the workspace, or while `enabled` is false.
 */
export const useWorkspaceKey = <Rest extends ReadonlyArray<string | null>>(
    name: string,
    rest: Rest,
    enabled = true,
): KeyOrWait<readonly [string, string, ...Rest]> => tenantKey(name, useOpenWorkspaceId(), rest, enabled)
