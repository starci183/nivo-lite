import type { SWRConfiguration } from "swr"

/** How often a queued job is asked for its status until it ends. */
const JOB_POLL_MS = 2000

/** What a queued job reports. */
interface JobStatus {
    readonly status: string
}

/** The failure of a read whose response carried no data. */
export const noData = (name: string): never => {
    throw new Error(`${name} answered no data`)
}

/** SWR options for the status of queued work: asked again every few seconds until the job succeeded or failed. */
export const jobPolling = (options?: SWRConfiguration): SWRConfiguration => ({
    refreshInterval: (data?: JobStatus) =>
        data?.status === "succeeded" || data?.status === "failed" ? 0 : JOB_POLL_MS,
    ...options,
})
