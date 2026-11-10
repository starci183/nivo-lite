"use client"

import { useLocale } from "next-intl"
import { useMemo, useState } from "react"
import { slotOfSwr } from "@/hooks/slot"
import { useQueryAgentRunWorkflowsSwr, useQueryAgentRunsSwr, useQueryAgentWorkflowsSwr } from "@/hooks/swr"
import { NO_FILTER, pinnedRunsOf, runsViewOf } from "@/modules/agentRuns"
import type { DataSlot, RunsFilter, RunsView } from "@/modules/types"
import { useRunContext } from "./useRunContext"

/** The runs are read again every 5 seconds while one runs or waits for its place, and every 30 seconds otherwise. */
const BUSY_MS = 5_000
const IDLE_MS = 30_000

/** The pin read takes at most this many runs. */
const PIN_LIMIT = 100

/** What the list of runs needs: the read, the filters over it and the moves that change them. */
export interface AgentRunsData {
    readonly slot: DataSlot<RunsView>
    readonly filter: RunsFilter
    readonly setFilter: (next: Partial<RunsFilter>) => void
    readonly reload: () => void
}

/** Whether the board has a run that is being driven or waits for a place. */
const isBusy = (latest: { readonly runningCount: number; readonly queuedCount: number } | undefined): boolean =>
    (latest?.runningCount ?? 0) + (latest?.queuedCount ?? 0) > 0

/** The runs of one agent instance, in words, with the filters of the page (workflow, status tab, source and text). */
export const useAgentRuns = (module: string, installationId: string): AgentRunsData => {
    const context = useRunContext(module, installationId)
    const [filter, setFilterState] = useState<RunsFilter>(NO_FILTER)
    const read = useQueryAgentRunsSwr(
        { installationId },
        { refreshInterval: (latest: Parameters<typeof isBusy>[0]) => (isBusy(latest) ? BUSY_MS : IDLE_MS) },
    )
    const locale = useLocale()
    const workflows = useQueryAgentWorkflowsSwr({ installationId, locale })
    const runIds = (read.data?.runs ?? []).slice(0, PIN_LIMIT).map((row) => row.id)
    const pins = useQueryAgentRunWorkflowsSwr(runIds.length === 0 ? null : { installationId, runIds })
    const isPinning = (runIds.length > 0 && pins.data === undefined && pins.error === undefined) || workflows.isLoading
    const view = useMemo(
        () =>
            read.data === undefined || isPinning
                ? undefined
                : runsViewOf(
                      pinnedRunsOf(
                          read.data,
                          pins.data ?? [],
                          (workflows.data ?? []).map((workflow) => ({ id: workflow.id, name: workflow.name })),
                      ),
                      filter,
                      context,
                  ),
        [read.data, pins.data, workflows.data, isPinning, filter, context],
    )
    return {
        slot: slotOfSwr<RunsView>({ data: view, error: read.error, isLoading: read.isLoading || isPinning }),
        filter,
        setFilter: (next) => setFilterState((current) => ({ ...current, ...next })),
        reload: () => void read.mutate(),
    }
}
