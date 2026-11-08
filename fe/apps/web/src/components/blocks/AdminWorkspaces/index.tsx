"use client"

import { notFound } from "next/navigation"
import {
    isAdminWorkspaceFilter,
    useAdminFormat,
    useAdminWorkspaceList,
    useAdminWorkspaceRows,
    type AdminWorkspaceFilter,
    type AdminWorkspaceRowView,
} from "@/hooks/admin"
import { slotOfSwr, useSlotLabels } from "@/hooks/slot"
import { navigation } from "@/modules/i18n"
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
    const router = navigation.useRouter()
    const { list: data, isLoading, failure, reload } = useAdminWorkspaceList(props.filter, props.query)
    const rows = useAdminWorkspaceRows(data?.items)
    if (failure.isMissing) notFound()
    const copy = {
        description: t("workspacesDescription"),
        searchLabel: t("searchLabel"),
        searchPlaceholder: t("searchPlaceholder"),
        clearLabel: t("clearFilters"),
        filtersLabel: t("filtersLabel"),
        moreLabel: (count: number) => t("moreFilters", { count }),
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
            agents: t("colAgents"),
            connections: t("colConnections"),
            lastMessage: t("colLastMessage"),
            messages: t("colMessages"),
            waiting: t("colWaiting"),
        },
        query: props.query,
        filter: props.filter,
    }
    const filterOf = (id: AdminWorkspaceFilter, count: number) => ({
        id,
        label: t(`filter${id.charAt(0).toUpperCase()}${id.slice(1)}`),
        count,
    })
    const view =
        data === undefined
            ? undefined
            : {
                  ...copy,
                  title: t("workspacesTitle", { count: data.total }),
                  footer: t("shownFooter", { shown: data.items.length, total: data.total }),
                  filters: FILTER_IDS.map((id) => filterOf(id, data.counts[id])),
                  rows: rows ?? [],
              }
    const placeholder = {
        ...copy,
        title: t("workspacesTitle", { count: 0 }),
        footer: t("shownFooter", { shown: 0, total: 0 }),
        filters: FILTER_IDS.map((id) => filterOf(id, 0)),
        rows: PLACEHOLDER_ROWS,
    }
    return (
        <AdminWorkspacesBase
            props={{
                slot: slotOfSwr({ data: view, isLoading, error: failure.message }),
                placeholder,
                title: view === undefined ? placeholder.title : view.title,
                labels: { ...slotLabels(t("empty")), error: failure.message ?? t("loadFailedTitle") },
                errorHint: t("loadFailedHint"),
            }}
            on={{
                retry: reload,
                search: (query) => router.push(adminListPath(props.filter, query.trim())),
                filter: (id) => router.push(adminListPath(isAdminWorkspaceFilter(id) ? id : "all", props.query)),
                clear: () => router.push(adminListPath("all", "")),
            }}
        />
    )
}
