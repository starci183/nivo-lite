"use client"

import { useAdminFormat, useAdminWorkspaceDetail } from "@/hooks/admin"
import { AdminWorkspaceSummaryBase } from "./component"

/** What the workspace page tells the block: the workspace of the address. */
interface AdminWorkspaceSummaryProps {
    readonly workspaceId: string
}

/** The connected line with its owner, creation date and id of the workspace page header. */
export const AdminWorkspaceSummary = (props: AdminWorkspaceSummaryProps) => {
    const { text: t, format } = useAdminFormat()
    const { detail } = useAdminWorkspaceDetail(props.workspaceId)
    return (
        <AdminWorkspaceSummaryBase
            props={{
                text:
                    detail === undefined
                        ? "…"
                        : t("workspaceDescription", {
                              owner: detail.workspace.ownerEmail ?? t("empty"),
                              created: format.date(detail.workspace.createdAt),
                              id: detail.workspace.id,
                          }),
            }}
        />
    )
}
