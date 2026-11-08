"use client"

import {
    mutateCreateVideoMediaUpload,
    type mutateCreateVideoMediaUpload as MutateCreateVideoMediaUploadOperation,
} from "@/modules/api/graphql/mutations/mutation-create-video-media-upload"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import type { CreateVideoMediaUploadMutation } from "@/modules/api"

/** The SWR key of the createVideoMediaUpload mutation. */
export const MUTATE_CREATE_VIDEO_MEDIA_UPLOAD_SWR_KEY = "MUTATE_CREATE_VIDEO_MEDIA_UPLOAD_SWR"

/** SWR mutation for {@link mutateCreateVideoMediaUpload}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateCreateVideoMediaUploadSwr = (): SWRMutationResponse<
    CreateVideoMediaUploadMutation["createVideoMediaUpload"],
    Error,
    typeof MUTATE_CREATE_VIDEO_MEDIA_UPLOAD_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_CREATE_VIDEO_MEDIA_UPLOAD_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateCreateVideoMediaUpload({ request: arg }), MUTATE_CREATE_VIDEO_MEDIA_UPLOAD_SWR_KEY)
                .createVideoMediaUpload,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateCreateVideoMediaUploadOperation>[0]["request"]
}
