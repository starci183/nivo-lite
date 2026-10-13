import { useCallback } from "react"
import { LocalStorage, StorageId, rememberWorkspaceCookie } from "@/modules/storage"
import { useAppDispatch, useAppSelector } from "@/redux"
import { setActiveWorkspaceId } from "@/redux"

/** The workspace the person works in, and the way to change it (persisted, so the GraphQL client sends it on every operation). */
export const useActiveWorkspace = () => {
    const dispatch = useAppDispatch()
    const activeWorkspaceId = useAppSelector((state) => state.workspace.activeWorkspaceId)
    const select = useCallback(
        (workspaceId: string) => {
            LocalStorage.set(StorageId.ActiveWorkspaceId, workspaceId)
            rememberWorkspaceCookie(workspaceId)
            dispatch(setActiveWorkspaceId(workspaceId))
        },
        [dispatch],
    )
    return { activeWorkspaceId, select }
}
