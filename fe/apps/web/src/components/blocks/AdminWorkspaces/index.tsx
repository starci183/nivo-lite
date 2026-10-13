"use client"

import { notFound } from "next/navigation"
import { useAdminFormat, useAdminWorkspaceList, useAdminWorkspaceRows } from "@/hooks/admin"
import type { AdminWorkspaceFilter } from "@/hooks/admin"
import { adminListPath } from "@/modules/routes"
import { AdminWorkspacesBase } from "./component"

/** The filters the list offers, in the order of its chips. */
const FILTER_IDS: ReadonlyArray<AdminWorkspaceFilter> = ["all", "attention", "unpaid", "idle"]

/** What the workspaces page tells the list: the filter and the search of the address. */
interface AdminWorkspacesProps {
    readonly filter: AdminWorkspaceFilter
    readonly query: string
}

/** The connected workspace list: every customer workspace the filter and the search keep, read from the back end through SWR. */
export const AdminWorkspaces = (props: AdminWorkspacesProps) => {
    const { text: t } = useAdminFormat()
    const { list: data, isLoading, failure } = useAdminWorkspaceList(props.filter, props.query)
    const rows = useAdminWorkspaceRows(data?.items)
    if (failure.isMissing) notFound()
    return (
        <AdminWorkspacesBase
            props={{
                load: { isLoading, error: failure.message, failedTitle: t("loadFailed") },
                view:
                    data === undefined
                        ? undefined
                        : {
                              eyebrow: t("workspacesEyebrow"),
                              title: t("workspacesTitle", { count: data.total }),
                              description: t("workspacesDescription"),
                              searchLabel: t("searchLabel"),
                              searchField: t("searchField"),
                              searchPlaceholder: t("searchPlaceholder"),
                              searchSubmit: t("searchSubmit"),
                              filtersLabel: t("filtersLabel"),
                              shownTitle: t("shownTitle", { count: data.items.length }),
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
                              filters: FILTER_IDS.map((id) => ({
                                  id,
                                  href: adminListPath(id, props.query),
                                  label: t("filterChoice", {
                                      label: t(`filter${id.charAt(0).toUpperCase()}${id.slice(1)}`),
                                      count: data.counts[id],
                                  }),
                              })),
                              rows: rows ?? [],
                          },
            }}
        />
    )
}
