import { tenantRequestKey } from "@starci/next-data"
import type { KeyOrWait } from "@starci/next-data"
import { useAppSelector } from "@/redux"

/** Keys a request by the known workspace and request object; a null request waits. */
export const useWorkspaceRequestKey = <Request>(
    name: string,
    request: Request | null,
): KeyOrWait<readonly [string, string, Request]> =>
    tenantRequestKey(
        name,
        useAppSelector((state) => state.workspace.activeWorkspaceId),
        request,
    )
