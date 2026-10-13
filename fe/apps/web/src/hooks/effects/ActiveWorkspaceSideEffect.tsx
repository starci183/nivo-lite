"use client"

import { useEffect } from "react"
import { useAppDispatch } from "@/redux"
import { setActiveWorkspaceId } from "@/redux"
import { LocalStorage, StorageId } from "@/modules/storage"

/** On mount, restores the persisted active workspace into the store, so the first screen knows it. Renders nothing. */
export const ActiveWorkspaceSideEffect = () => {
    const dispatch = useAppDispatch()
    useEffect(() => {
        dispatch(setActiveWorkspaceId(LocalStorage.get<string>(StorageId.ActiveWorkspaceId)))
    }, [dispatch])
    return null
}
