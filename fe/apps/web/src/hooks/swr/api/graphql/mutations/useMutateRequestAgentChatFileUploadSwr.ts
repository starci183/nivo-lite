"use client"

import useSWRMutation from "swr/mutation"
import { mutateRequestAgentChatFileUpload } from "@/modules/api/graphql/mutations/mutation-request-agent-chat-file-upload"
import type { MutateRequestAgentChatFileUploadRequest } from "@/modules/api/graphql/mutations/mutation-request-agent-chat-file-upload"
import type { SWRMutationResponse } from "swr/mutation"
import type { OperationData } from "@/hooks/workspaceread"

/** What the RequestAgentChatFileUpload mutation is triggered with. */
interface RequestAgentChatFileUploadArg {
    readonly arg: MutateRequestAgentChatFileUploadRequest
}

/** SWR identity of the upload address of a chat file. */
export const MUTATE_REQUEST_AGENT_CHAT_FILE_UPLOAD_SWR_KEY = "MUTATE_REQUEST_AGENT_CHAT_FILE_UPLOAD_SWR"

/** Asks for the address a file of a chat message is uploaded to. */
export const useMutateRequestAgentChatFileUploadSwr = (
    workspaceId: string,
): SWRMutationResponse<
    OperationData<typeof mutateRequestAgentChatFileUpload>["requestAgentChatFileUpload"],
    Error,
    [string, string],
    RequestAgentChatFileUploadArg["arg"]
> =>
    useSWRMutation(
        [MUTATE_REQUEST_AGENT_CHAT_FILE_UPLOAD_SWR_KEY, workspaceId],
        async ([, scope]: [string, string], { arg }: RequestAgentChatFileUploadArg) => {
            const result = await mutateRequestAgentChatFileUpload({
                request: arg,
                headers: { "X-Workspace-Id": scope },
            })
            if (!result.data) throw new Error("requestAgentChatFileUpload answered no data")
            return result.data.requestAgentChatFileUpload
        },
    )
