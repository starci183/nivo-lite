"use client"

import { useAdminWorkspaceDetail } from "@/hooks/admin"
import { AdminWorkspaceNameBase } from "./component"

/** What the workspace page tells the block: the workspace of the address. */
interface AdminWorkspaceNameProps {
    readonly workspaceId: string
}

/** The connected the workspace name of the workspace page header. */
export const AdminWorkspaceName = (props: AdminWorkspaceNameProps) => {
    const { detail } = useAdminWorkspaceDetail(props.workspaceId)
    return <AdminWorkspaceNameBase props={{ text: detail === undefined ? "…" : detail.workspace.name }} />
}
