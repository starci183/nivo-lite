import { tenantRequestKey, type KeyOrWait } from "@starci/next-data"
import { useOpenWorkspaceId } from "./useOpenWorkspaceId"

/** Keys a request by the workspace of the open address and request object; a null request waits. */
export const useWorkspaceRequestKey = <Request>(
    name: string,
    request: Request | null,
): KeyOrWait<readonly [string, string, Request]> => tenantRequestKey(name, useOpenWorkspaceId(), request)
