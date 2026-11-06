"use client"

import { useOpenWorkspaceId } from "@/hooks/workspaceKey"

/**
 * The workspace the person works in: the first segment of the address of a console page (or the `ws` of a step of creating a workspace),
 * the one source of truth for every console read and link. An address that names no workspace is a bug of the caller.
 */
export const useWorkspaceId = (): string => {
    const workspaceId = useOpenWorkspaceId()
    if (workspaceId === undefined) throw new Error("useWorkspaceId was called on an address that names no workspace")
    return workspaceId
}
