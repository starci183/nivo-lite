"use client"

import { notFound } from "next/navigation"
import { useAdminDetailFacts, useAdminFormat, useAdminWorkspaceDetail } from "@/hooks/admin"
import { slotOfSwr, useSlotLabels } from "@/hooks/slot"
import type { DataSlot } from "@/modules/types"
import { AdminWorkspaceOverviewBase } from "./component"
import type { AdminWorkspaceOverviewData } from "./component"

/** What the workspace page tells the overview: the workspace of the address. */
interface AdminWorkspaceOverviewProps {
    readonly workspaceId: string
}

/** The connected read-only overview of one workspace: its heading, billing and activity facts. */
export const AdminWorkspaceOverview = (props: AdminWorkspaceOverviewProps) => {
    const { text: t, format } = useAdminFormat()
    const slotLabels = useSlotLabels()
    const { detail, read, failure, reload } = useAdminWorkspaceDetail(props.workspaceId)
    const facts = useAdminDetailFacts(detail)
    if (failure.isMissing) notFound()
    const data =
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
                  billing: facts.billing,
                  activity: facts.activity,
              }
    const slot: DataSlot<AdminWorkspaceOverviewData> = slotOfSwr({
        data,
        error: read.error,
        isLoading: read.isLoading,
        isValidating: read.isValidating,
    })
    return (
        <AdminWorkspaceOverviewBase
            props={{
                overviewTitle: t("overviewTitle"),
                slot,
                slotLabels: slotLabels(t("loadFailed")),
            }}
            on={{ retry: reload }}
        />
    )
}
