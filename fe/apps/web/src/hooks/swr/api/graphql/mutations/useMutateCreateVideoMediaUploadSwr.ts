"use client"

import { mutateCreateVideoMediaUpload } from "@/modules/api/graphql/mutations/mutation-create-video-media-upload"
import type { mutateCreateVideoMediaUpload as MutateCreateVideoMediaUploadOperation } from "@/modules/api/graphql/mutations/mutation-create-video-media-upload"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"
import type { SWRMutationResponse } from "swr/mutation"
import type { OperationData } from "@/hooks/workspaceread"

/** The SWR key of the createVideoMediaUpload mutation. */
export const MUTATE_CREATE_VIDEO_MEDIA_UPLOAD_SWR_KEY = "MUTATE_CREATE_VIDEO_MEDIA_UPLOAD_SWR"

/** SWR mutation for {@link mutateCreateVideoMediaUpload}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateCreateVideoMediaUploadSwr = (): SWRMutationResponse<
    OperationData<typeof mutateCreateVideoMediaUpload>["createVideoMediaUpload"],
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
