"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import type { InstalledAgent } from "@/hooks/installations"
import { isManager, useMember } from "@/hooks/member"
import type { CatalogFilters } from "@/hooks/modules"
import { useQueryWorkspaceDashboardSwr } from "@/hooks/swr"
import { useWorkspaceId } from "@/hooks/workspaces"
import {
    FILTER_ALL,
    FILTER_MISSING,
    FILTER_WAITING,
    filterRows,
    groupRows,
    waitingFirst,
    type AgentCatalogGroup,
    type AgentCatalogRow,
    type CatalogFilterOption,
} from "@/modules/agentCatalog"
import { MODULE_REGISTRY } from "@/modules/catalog"
import { TEAM_FILTER_FROM, catalogRowOf, type AgentCounts } from "./agentCatalog.shared"

/** What the agents table draws and calls. */
export interface AgentTableView {
    /** The rows the chip and the search keep. */
    readonly rows: ReadonlyArray<AgentCatalogRow>
    /** More agents than a person scans by eye: the chips and the search show. */
    readonly hasFilters: boolean
    /** The same rows grouped by role, each under the head of its role. */
    readonly groups: ReadonlyArray<AgentCatalogGroup>
    /** The chips: every agent, the ones missing a connection, the ones with facts waiting. */
    readonly options: ReadonlyArray<CatalogFilterOption>
    readonly filter: string
    readonly setFilter: (id: string) => void
    readonly query: string
    readonly setQuery: (value: string) => void
    /** Drops the chip, the search and the group. */
    readonly clear: () => void
}

/** The agents of the workspace as table rows, narrowed by one chip and the search of the URL. */
export const useAgentTable = (agents: ReadonlyArray<InstalledAgent>, filters: CatalogFilters): AgentTableView => {
    const t = useTranslations("agentCatalog")
    const workspaceId = useWorkspaceId()
    const [filter, setFilter] = useState(FILTER_ALL)
    const canAdd = isManager(useMember())
    const dashboard = useQueryWorkspaceDashboardSwr(workspaceId, "last_7_days").data
    const countsOf = (agentId: string | null): AgentCounts | undefined => {
        const found = agentId === null ? undefined : dashboard?.agents.find((entry) => entry.agentId === agentId)
        return found === undefined ? undefined : { tasks: found.tasksDone, waiting: found.waiting }
    }
    const all = agents.map((agent) => catalogRowOf(agent, workspaceId, t, countsOf(agent.agentId), canAdd))
    const hasFilters = all.length > TEAM_FILTER_FROM
    const rows = waitingFirst(hasFilters ? filterRows(all, filter, filters.query) : all)
    return {
        rows,
        hasFilters,
        groups: groupRows(rows, (roleKey) => {
            const role = agents.find((agent) => agent.moduleKey === roleKey)?.roleName ?? roleKey
            const count = agents.filter((agent) => agent.moduleKey === roleKey).length
            return {
                title: t("groupTitle", { role, count }),
                addLabel: canAdd && MODULE_REGISTRY[roleKey].multiInstance ? t("groupAdd", { role }) : "",
            }
        }),
        options: [
            { id: FILTER_ALL, label: t("filterAll"), count: all.length },
            {
                id: FILTER_MISSING,
                label: t("filterMissing"),
                count: all.filter((row) => row.isMissingConnection).length,
            },
            {
                id: FILTER_WAITING,
                label: t("filterWaiting"),
                count: all.filter((row) => row.hasWaitingFacts).length,
            },
        ],
        filter,
        setFilter,
        query: filters.query,
        setQuery: filters.setQuery,
        clear: () => {
            setFilter(FILTER_ALL)
            filters.clear()
        },
    }
}
