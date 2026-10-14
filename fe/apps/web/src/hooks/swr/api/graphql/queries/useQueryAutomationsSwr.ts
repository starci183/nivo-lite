"use client"

import useSWR from "swr"
import { queryAutomations } from "@/modules/api/graphql/queries/query-automations"
import { automationsOverviewOf } from "@/modules/automations"

/** The SWR key of the automations overview; pipeline mutations call `mutate(QUERY_AUTOMATIONS_SWR_KEY)`. */
export const QUERY_AUTOMATIONS_SWR_KEY = "QUERY_AUTOMATIONS_SWR"

const REFRESH_MS = 3_000
const ACTIVE_RUNS: ReadonlySet<string> = new Set(["queued", "running"])

/**
 * The automations gallery of the active workspace (the back end `automations` query): one card per template, the latest
 * runs, the shop and the preview sample, already mapped to the view model. While a run is queued or running the answer
 * refreshes until the run settles.
 */
export const useQueryAutomationsSwr = () =>
    useSWR(
        QUERY_AUTOMATIONS_SWR_KEY,
        async ({ signal }: { signal?: AbortSignal } = {}) => {
            const result = await queryAutomations({ signal })
            if (!result.data) throw new Error("automations answered no data")
            return automationsOverviewOf(result.data.automations)
        },
        { refreshInterval: (data) => (data?.runs.some((run) => ACTIVE_RUNS.has(run.status)) ? REFRESH_MS : 0) },
    )
