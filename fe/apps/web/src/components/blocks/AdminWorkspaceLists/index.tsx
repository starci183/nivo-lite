"use client"

import { useAdminDetailCards, useAdminWorkspaceDetail } from "@/hooks/admin"
import { AdminWorkspaceListsBase } from "./component"

/** What the workspace page tells the lists: the workspace of the address. */
interface AdminWorkspaceListsProps {
    readonly workspaceId: string
}

/** The connected lists of one workspace: members, agents, connections, knowledge, orders, transfers and errors. */
export const AdminWorkspaceLists = (props: AdminWorkspaceListsProps) => {
    const { detail, failure } = useAdminWorkspaceDetail(props.workspaceId)
    const cards = useAdminDetailCards(detail)
    // The overview block above draws the loading state and the failure of the same read.
    if (cards === undefined || failure.error !== undefined) return null
    return <AdminWorkspaceListsBase props={{ cards }} />
}
