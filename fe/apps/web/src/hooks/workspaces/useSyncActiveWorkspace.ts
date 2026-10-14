"use client"

import { useEffect } from "react"
import { LocalStorage, StorageId, rememberWorkspaceCookie } from "@/modules/storage"
import { useAppDispatch, setActiveWorkspaceId } from "@/redux"

/**
 * Makes the workspace the server rendered the page for the one the GraphQL client sends, so a browser that never picked it
 * (a bookmark, a second tab, a cleared storage) still talks to the right workspace. The storage and the cookie are written while
 * rendering (before the children's first query, no React state involved) and only when the stored id differs; the store follows
 * in an effect.
 */
export const useSyncActiveWorkspace = (workspaceId: string | undefined): void => {
    const dispatch = useAppDispatch()
    if (
        typeof window !== "undefined" &&
        workspaceId !== undefined &&
        LocalStorage.get<string>(StorageId.ActiveWorkspaceId) !== workspaceId
    ) {
        LocalStorage.set(StorageId.ActiveWorkspaceId, workspaceId)
        rememberWorkspaceCookie(workspaceId)
    }
    useEffect(() => {
        if (workspaceId !== undefined) dispatch(setActiveWorkspaceId(workspaceId))
    }, [dispatch, workspaceId])
}
