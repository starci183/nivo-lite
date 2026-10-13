"use client"

import { useSyncActiveWorkspace } from "@/hooks/workspaces"

/** The workspace the server rendered the page for. */
type ActiveWorkspaceSyncProps = { readonly workspaceId: string }

/** Makes the workspace the server rendered the page for the one the GraphQL client sends, before the page below reads. Renders nothing. */
export const ActiveWorkspaceSync = (props: ActiveWorkspaceSyncProps) => {
    useSyncActiveWorkspace(props.workspaceId)
    return null
}
