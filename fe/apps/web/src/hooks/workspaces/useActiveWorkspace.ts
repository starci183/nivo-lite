"use client"

import { useCallback } from "react"
import { LocalStorage, StorageId, rememberWorkspaceCookie } from "@/modules/storage"
import { useAppDispatch, useAppSelector, setActiveWorkspaceId } from "@/redux"

type UseActiveWorkspaceResult = {
    activeWorkspaceId: string | undefined
    select: (workspaceId: string) => void
}

/** The workspace the person works in, and the way to change it (persisted, so the GraphQL client sends it on every operation). */
export const useActiveWorkspace = (): UseActiveWorkspaceResult => {
    const dispatch = useAppDispatch()
    const activeWorkspaceId = useAppSelector((state) => state.workspace.activeWorkspaceId)
    const select = useCallback(
        (workspaceId: string): void => {
            LocalStorage.set(StorageId.ActiveWorkspaceId, workspaceId)
            rememberWorkspaceCookie(workspaceId)
            dispatch(setActiveWorkspaceId(workspaceId))
        },
        [dispatch],
    )
    return { activeWorkspaceId, select }
}
