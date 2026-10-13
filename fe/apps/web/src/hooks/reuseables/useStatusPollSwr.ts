import useSWR from "swr"

/** What a caller may follow while a status is polled. */
export interface StatusPollOptions {
    readonly onSuccess?: (progress: { readonly status: string }) => void
    readonly onError?: (error: unknown) => void
}

/** The identity of one polled status: the query name, the workspace and the id of the queued work. */
export type StatusPollKey = readonly [string, string, string]

/**
 * The one polling shape of every queued back end job: reads the status through `read` until it is `succeeded` or `failed`, then
 * stops. The key is `null` (idle) until the workspace and the work item are known.
 */
export const useStatusPollSwr = <TStatus extends { readonly status: string }>(
    key: StatusPollKey | null,
    read: (key: StatusPollKey) => Promise<TStatus>,
    intervalMs: number,
    options: StatusPollOptions,
) =>
    useSWR(key, read, {
        ...options,
        refreshInterval: (progress) =>
            progress?.status === "succeeded" || progress?.status === "failed" ? 0 : intervalMs,
        revalidateOnFocus: false,
    })
