import { tenantParamsKey, type KeyOrWait } from "@starci/next-data"
import { useOpenWorkspaceId } from "./useOpenWorkspaceId"

/** Keys a workspace query by its ordered parameters, pausing absent parameters or an empty workspace. */
export const useWorkspaceParamsKey = <Params extends readonly unknown[]>(
    name: string,
    params: Params | null,
): KeyOrWait<readonly [string, string, ...Params]> => tenantParamsKey(name, useOpenWorkspaceId(), params)
