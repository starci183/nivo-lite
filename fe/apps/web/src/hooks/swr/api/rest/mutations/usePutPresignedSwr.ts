"use client"

import useSWRMutation from "swr/mutation"
import { putPresigned } from "@/modules/api"
import type { putPresigned as PutPresignedOperation } from "@/modules/api"

/** The transport's upload contract, including progress and cancellation. */
type PutPresignedRequest = Parameters<typeof PutPresignedOperation>[0]

/** The isolated mutation key for direct storage uploads. */
export const MUTATE_PUT_PRESIGNED_SWR_KEY = "MUTATE_PUT_PRESIGNED_SWR"

/** One upload's completion remains independent of overlapping SWR mutations. */
interface UploadInvocation {
    readonly request: PutPresignedRequest
    readonly resolve: () => void
    readonly reject: (error: unknown) => void
}

/** SWR passes the complete invocation to the transport fetcher. */
interface TriggerArg {
    readonly arg: UploadInvocation
}

/** Uploads bytes through SWR while retaining each concurrent caller's original completion and error. */
export const usePutPresignedSwr = () => {
    const { trigger } = useSWRMutation(
        MUTATE_PUT_PRESIGNED_SWR_KEY,
        (_key: string, { arg }: TriggerArg) => putPresigned(arg.request).then(arg.resolve, arg.reject),
        { revalidate: false, populateCache: false },
    )
    return {
        trigger: (request: PutPresignedRequest): Promise<void> =>
            new Promise((resolve, reject) => {
                void trigger({ request, resolve, reject })
            }),
    }
}
