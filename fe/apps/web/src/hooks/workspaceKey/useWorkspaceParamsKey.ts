import { tenantParamsKey } from "@starci/next-data"
import type { KeyOrWait } from "@starci/next-data"
import { useAppSelector } from "@/redux"

/** Keys a workspace query by its ordered parameters, pausing absent parameters or an empty workspace. */
export const useWorkspaceParamsKey = <Params extends readonly unknown[]>(
    name: string,
    params: Params | null,
): KeyOrWait<readonly [string, string, ...Params]> =>
    tenantParamsKey(
        name,
        useAppSelector((state) => state.workspace.activeWorkspaceId),
        params,
    )
