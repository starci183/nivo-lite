"use client"

import { notFound } from "next/navigation"
import {
    billingTone,
    billingWord,
    useAdminDetailCards,
    useAdminDetailFacts,
    useAdminFormat,
    useAdminSupportDrawer,
    useAdminWorkspaceDetail,
} from "@/hooks/admin"
import { slotOfSwr, useSlotLabels } from "@/hooks/slot"
import { ADMIN_ROUTES } from "@/modules/routes"
import type { ReactNode } from "react"
import { AdminWorkspaceScreenBase } from "./component"
import type { AdminWorkspaceScreenData, AdminWorkspaceScreenHead } from "./component"

/** What the workspace page tells the block: the workspace of the address. */
interface AdminWorkspaceScreenProps {
    readonly workspaceId: string
    /** The support actions drawer, composed by the page. */
    readonly children: ReactNode
}

/** The connected workspace screen: one read of the workspace draws its header, overview and lists, and one drawer holds the support actions. */
export const AdminWorkspaceScreen = (props: AdminWorkspaceScreenProps) => {
    const { text: t, format } = useAdminFormat()
    const slotLabels = useSlotLabels()
    const drawer = useAdminSupportDrawer()
    const { detail, read, failure, reload } = useAdminWorkspaceDetail(props.workspaceId)
    const facts = useAdminDetailFacts(detail)
    const cards = useAdminDetailCards(detail)
    if (failure.isMissing) notFound()
    const figures = [...facts.billing, ...facts.activity].map((fact) => ({
        id: fact.id,
        term: fact.term,
        value: fact.value,
    }))
    const placeholder: AdminWorkspaceScreenData = { figures, cards }
    const head: AdminWorkspaceScreenHead =
        detail === undefined
            ? { name: "...", description: "...", status: null }
            : {
                  name: detail.workspace.name,
                  description: t("workspaceDescription", {
                      owner: detail.workspace.ownerEmail ?? t("empty"),
                      created: format.date(detail.workspace.createdAt),
                      id: detail.workspace.id,
                  }),
                  status: {
                      label: billingWord(t, detail.workspace.status),
                      tone: billingTone(detail.workspace.status),
                  },
              }
    const data: AdminWorkspaceScreenData | undefined = detail === undefined ? undefined : { figures, cards }
    return (
        <AdminWorkspaceScreenBase
            props={{
                trailLabel: t("trailLabel"),
                workspacesLabel: t("navWorkspaces"),
                workspacesHref: ADMIN_ROUTES.workspaces,
                overviewTitle: t("overviewTitle"),
                supportLabel: t("actionsTitle"),
                head,
                isHeadLoading: detail === undefined && read.isLoading,
                slot: slotOfSwr({
                    data,
                    error: read.error,
                    isLoading: read.isLoading,
                    isValidating: read.isValidating,
                }),
                placeholder,
                labels: slotLabels(t("loadFailed")),
            }}
            on={{ retry: reload, openSupport: () => drawer.setOpen(true) }}
            children={props.children}
        />
    )
}
