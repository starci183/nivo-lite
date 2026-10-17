import { useAppSelector } from "@/redux"

/** Keys a request by the known workspace and request object; a null request waits. */
export const useWorkspaceRequestKey = <Request>(
    name: string,
    request: Request | null,
): readonly [string, string, Request] | null => {
    const workspaceId = useAppSelector((state) => state.workspace.activeWorkspaceId)
    return request === null || workspaceId === undefined ? null : [name, workspaceId, request]
}
