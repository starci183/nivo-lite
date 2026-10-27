"use client"

import { notFound } from "next/navigation"
import { useAdminFormat, useAdminWorkspaceList, useAdminWorkspaceRows } from "@/hooks/admin"
import type { AdminWorkspaceFilter, AdminWorkspaceRowView } from "@/hooks/admin"
import { slotOfSwr, useSlotLabels } from "@/hooks/slot"
import { adminListPath } from "@/modules/routes"
import { AdminWorkspacesBase } from "./component"

/** The filters the list offers, in the order of its chips. */
const FILTER_IDS: ReadonlyArray<AdminWorkspaceFilter> = ["all", "attention", "unpaid", "idle"]

/** The table rows drawn while the read is on its way: three rows with every cell of a finished one. */
const PLACEHOLDER_ROWS: ReadonlyArray<AdminWorkspaceRowView> = ["first", "second", "third"].map((id) => ({
    id,
    name: id,
    href: "",
    needsAttention: false,
    ownerEmail: id,
    status: id,
    statusTone: "neutral",
    paidUntil: id,
    plan: id,
    created: id,
    members: 0,
    modules: [{ id, tone: "neutral", label: id }],
    connections: [{ id, tone: "neutral", label: id }],
    connectionWarnings: [],
    lastMessage: id,
    messages7d: 0,
    openDecisions: 0,
}))

/** What the workspaces page tells the list: the filter and the search of the address. */
interface AdminWorkspacesProps {
    readonly filter: AdminWorkspaceFilter
    readonly query: string
}

/** The connected workspace list: every customer workspace the filter and the search keep, read from the back end through SWR. */
export const AdminWorkspaces = (props: AdminWorkspacesProps) => {
    const { text: t } = useAdminFormat()
    const slotLabels = useSlotLabels()
    const { list: data, isLoading, failure, reload } = useAdminWorkspaceList(props.filter, props.query)
    const rows = useAdminWorkspaceRows(data?.items)
    if (failure.isMissing) notFound()
    const copy = {
        eyebrow: t("workspacesEyebrow"),
        description: t("workspacesDescription"),
        searchLabel: t("searchLabel"),
        searchField: t("searchField"),
        searchPlaceholder: t("searchPlaceholder"),
        searchSubmit: t("searchSubmit"),
        filtersLabel: t("filtersLabel"),
        tableLabel: t("tableLabel"),
        emptyTitle: t("emptyTitle"),
        emptyHint: t("emptyHint"),
        attentionLabel: t("badgeAttention"),
        noneLabel: t("none"),
        columns: {
            workspace: t("colWorkspace"),
            owner: t("colOwner"),
            billing: t("colBilling"),
            plan: t("colPlan"),
            created: t("colCreated"),
            members: t("colMembers"),
            agents: t("colAgents"),
            connections: t("colConnections"),
            lastMessage: t("colLastMessage"),
            messages: t("colMessages"),
            waiting: t("colWaiting"),
        },
        query: props.query,
        filter: props.filter,
    }
    const filterLabel = (id: AdminWorkspaceFilter, count: number) =>
        t("filterChoice", { label: t(`filter${id.charAt(0).toUpperCase()}${id.slice(1)}`), count })
    const view =
        data === undefined
            ? undefined
            : {
                  ...copy,
                  title: t("workspacesTitle", { count: data.total }),
                  shownTitle: t("shownTitle", { count: data.items.length }),
                  filters: FILTER_IDS.map((id) => ({
                      id,
                      href: adminListPath(id, props.query),
                      label: filterLabel(id, data.counts[id]),
                  })),
                  rows: rows ?? [],
              }
    const placeholder = {
        ...copy,
        title: t("workspacesTitle", { count: 0 }),
        shownTitle: t("shownTitle", { count: 0 }),
        filters: FILTER_IDS.map((id) => ({ id, href: adminListPath(id, props.query), label: filterLabel(id, 0) })),
        rows: PLACEHOLDER_ROWS,
    }
    return (
        <AdminWorkspacesBase
            props={{
                slot: slotOfSwr({ data: view, isLoading, error: failure.message }),
                placeholder,
                slotLabels: { ...slotLabels(t("empty")), error: failure.message ?? t("loadFailed") },
            }}
            on={{ retry: reload }}
        />
    )
}
