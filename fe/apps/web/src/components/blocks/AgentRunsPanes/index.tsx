"use client"

import { useAgentRoute } from "@/hooks/installations"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { useOverviewPhone } from "@/hooks/overview"
import { useSlotLabels } from "@/hooks/slot"
import { ALL, agentRunsGridOf, useRunsTableCopy, tabOf, useAgentRuns } from "@/hooks/agentRuns"
import type { RunsTableCopy, RunsView } from "@/modules/types"
import { AgentRunsPanesBase, type AgentRunsPanesCopy } from "./component"

/** The instance whose runs the page shows. */
type AgentRunsPanesProps = {
    readonly module?: string | undefined
    readonly installationId?: string | undefined
}

/** What the page shows while its first read is under way: the shape of a page with no run in it. */
const PLACEHOLDER: RunsView = {
    workflows: [{ key: ALL, label: "", count: 0 }],
    rows: [],
    tabs: [],
    sources: [],
    headLine: "",
    title: "",
    isFiltered: false,
    total: 0,
}

type Words = ReturnType<typeof useTranslations<"agentRuns">>

/** The words of the runs page that do not come from the data. */
const copyOf = (t: Words, table: RunsTableCopy): AgentRunsPanesCopy => ({
    table,
    paneLabel: t("paneLabel"),
})

/** The connected runs page of one agent: reads the runs, keeps the filters and draws the workflows beside the table. */
export const AgentRunsPanes = (props: AgentRunsPanesProps) => {
    const route = useAgentRoute(props)
    const t = useTranslations("agentRuns")
    const table = useRunsTableCopy()
    const slotLabels = useSlotLabels()
    const runs = useAgentRuns(route.module, route.installationId)
    const [page, setPage] = useState(1)
    const isPhone = useOverviewPhone()
    return (
        <AgentRunsPanesBase
            props={{
                copy: copyOf(t, table),
                slot: runs.slot,
                placeholder: PLACEHOLDER,
                slotLabels: slotLabels(t("empty")),
                filter: runs.filter,
                grid: agentRunsGridOf(),
                page,
                isPhone,
            }}
            on={{
                filter: (next) => {
                    setPage(1)
                    runs.setFilter(next)
                },
                tab: (key) => {
                    setPage(1)
                    runs.setFilter({ tab: tabOf(key) })
                },
                page: setPage,
                retry: runs.reload,
            }}
        />
    )
}
