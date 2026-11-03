"use client"

import { mutateRequestContentMediaUpload } from "@/modules/api/graphql/mutations/mutation-request-content-media-upload"
import type { mutateRequestContentMediaUpload as MutateRequestContentMediaUploadOperation } from "@/modules/api/graphql/mutations/mutation-request-content-media-upload"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"
import type { SWRMutationResponse } from "swr/mutation"
import type { OperationData } from "@/hooks/workspaceread"

/** The SWR key of the requestContentMediaUpload mutation. */
export const MUTATE_REQUEST_CONTENT_MEDIA_UPLOAD_SWR_KEY = "MUTATE_REQUEST_CONTENT_MEDIA_UPLOAD_SWR"

/** SWR mutation for {@link mutateRequestContentMediaUpload}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateRequestContentMediaUploadSwr = (): SWRMutationResponse<
    OperationData<typeof mutateRequestContentMediaUpload>["requestContentMediaUpload"],
    Error,
    typeof MUTATE_REQUEST_CONTENT_MEDIA_UPLOAD_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_REQUEST_CONTENT_MEDIA_UPLOAD_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(
                await mutateRequestContentMediaUpload({ request: arg }),
                MUTATE_REQUEST_CONTENT_MEDIA_UPLOAD_SWR_KEY,
            ).requestContentMediaUpload,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateRequestContentMediaUploadOperation>[0]["request"]
}
