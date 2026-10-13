"use client"

import { notFound } from "next/navigation"
import { useAdminDetailFacts, useAdminFormat, useAdminWorkspaceDetail } from "@/hooks/admin"
import { AdminWorkspaceOverviewBase } from "./component"

/** What the workspace page tells the overview: the workspace of the address. */
interface AdminWorkspaceOverviewProps {
    readonly workspaceId: string
}

/** The connected read-only overview of one workspace: its heading, billing and activity facts. */
export const AdminWorkspaceOverview = (props: AdminWorkspaceOverviewProps) => {
    const { text: t, format } = useAdminFormat()
    const { detail, isLoading, failure } = useAdminWorkspaceDetail(props.workspaceId)
    const facts = useAdminDetailFacts(detail)
    if (failure.isMissing) notFound()
    return (
        <AdminWorkspaceOverviewBase
            props={{
                load: { isLoading, error: failure.message, failedTitle: t("loadFailed") },
                view:
                    detail === undefined || facts === undefined
                        ? undefined
                        : {
                              eyebrow: t("workspaceEyebrow"),
                              title: detail.workspace.name,
                              description: t("workspaceDescription", {
                                  owner: detail.workspace.ownerEmail ?? t("empty"),
                                  created: format.date(detail.workspace.createdAt),
                                  id: detail.workspace.id,
                              }),
                              allWorkspacesLabel: t("allWorkspaces"),
                              overviewTitle: t("overviewTitle"),
                              billing: facts.billing,
                              activity: facts.activity,
                          },
            }}
        />
    )
}
