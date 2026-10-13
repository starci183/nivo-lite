import useSWR from "swr"
import { queryDataSyncRun } from "@/modules/api/graphql/queries/query-data-sync-run"
import type { DataSyncRunType } from "@/modules/api"

/** The SWR key of the dataSyncRun query. */
export const QUERY_DATA_SYNC_RUN_SWR_KEY = "QUERY_DATA_SYNC_RUN_SWR"

/** How often a running sync is asked about again, in milliseconds. */
const POLL_MS = 2000

/** The callbacks of {@link useQueryDataSyncRunSwr}. */
interface DataSyncRunOptions {
    readonly onSuccess?: (run: DataSyncRunType) => void
}

/** One sync run of a data connection, asked about every two seconds until it is no longer running. `undefined` pauses it. */
export const useQueryDataSyncRunSwr = (runId: string | undefined, options?: DataSyncRunOptions) =>
    useSWR(
        runId === undefined ? null : ([QUERY_DATA_SYNC_RUN_SWR_KEY, runId] as const),
        async ([, id]) => {
            const result = await queryDataSyncRun({ request: { runId: id } })
            if (!result.data) throw new Error("dataSyncRun answered no data")
            return result.data.dataSyncRun
        },
        {
            refreshInterval: (latest) => (latest === undefined || latest.state === "running" ? POLL_MS : 0),
            onSuccess: options?.onSuccess,
        },
    )
