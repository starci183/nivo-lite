"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateRequestAgentAvatarUpload,
    type MutateRequestAgentAvatarUploadRequest,
} from "@/modules/api/graphql/mutations/mutation-request-agent-avatar-upload"
import type { RequestAgentAvatarUploadMutation } from "@/modules/api"

/** What the RequestAgentAvatarUpload mutation is triggered with. */
interface RequestAgentAvatarUploadArg {
    readonly arg: MutateRequestAgentAvatarUploadRequest
}

/** The SWR key of {@link useMutateRequestAgentAvatarUploadSwr}. */
export const MUTATE_REQUEST_AGENT_AVATAR_UPLOAD_SWR_KEY = "MUTATE_REQUEST_AGENT_AVATAR_UPLOAD_SWR"

/** SWR mutation for {@link mutateRequestAgentAvatarUpload}: `trigger(request)` answers the upload address. */
export const useMutateRequestAgentAvatarUploadSwr = (): SWRMutationResponse<
    RequestAgentAvatarUploadMutation["requestAgentAvatarUpload"],
    Error,
    typeof MUTATE_REQUEST_AGENT_AVATAR_UPLOAD_SWR_KEY,
    RequestAgentAvatarUploadArg["arg"]
> =>
    useSWRMutation(
        MUTATE_REQUEST_AGENT_AVATAR_UPLOAD_SWR_KEY,
        async (_key: string, { arg }: RequestAgentAvatarUploadArg) => {
            const result = await mutateRequestAgentAvatarUpload({ request: arg })
            if (!result.data) throw new Error("requestAgentAvatarUpload answered no data")
            return result.data.requestAgentAvatarUpload
        },
    )
