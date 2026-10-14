"use client"

import type { SWRConfiguration } from "swr"
import { useWorkspaceQuerySwr } from "./useWorkspaceQuerySwr"

/** The part of an Apollo query result the hook reads. */
interface JobAnswer<TData> {
    readonly data?: TData | null
}

/**
 * The status read of one queued back end job in the active workspace: runs the status query of `id` every two seconds until
 * the `field` of its answer is `succeeded` or `failed`. `id` undefined keeps it idle; `callbacks` hear each answer and a failed read.
 */
export const useWorkspaceJobSwr = <TField extends string, TData extends Record<TField, { readonly status: string }>>(
    key: string,
    id: string | undefined,
    run: (params: { readonly request: { readonly id: string } }) => Promise<JobAnswer<TData>>,
    field: TField,
    callbacks: Pick<SWRConfiguration<TData[TField], Error>, "onSuccess" | "onError">,
) =>
    useWorkspaceQuerySwr(
        key,
        id ? [id] : null,
        ([jobId]) => run({ request: { id: jobId } }),
        (data) => data[field],
        {
            refreshInterval: (status) => (status?.status === "succeeded" || status?.status === "failed" ? 0 : 2000),
            ...callbacks,
        },
    )
