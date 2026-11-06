"use client"

import useSWRMutation from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"
import {
    mutateRequestChatFileUpload,
    type mutateRequestChatFileUpload as RequestChatFileUploadOperation,
} from "@/modules/api/graphql/mutations/mutation-request-chat-file-upload"
import type { SWRMutationResponse } from "swr/mutation"
import type { RequestChatFileUploadMutation } from "@/modules/api"

/** What the RequestChatFileUpload mutation is triggered with. */
interface TriggerArg {
    readonly arg: RequestChatFileUploadArg
}

/** The request of the RequestChatFileUpload operation. */
type RequestChatFileUploadArg = Parameters<typeof RequestChatFileUploadOperation>[0]["request"]

/** The SWR identity of the RequestChatFileUpload mutation. */
export const MUTATE_REQUEST_CHAT_FILE_UPLOAD_SWR_KEY = "MUTATE_REQUEST_CHAT_FILE_UPLOAD_SWR"

/** Asks for the address a file of a room is uploaded to; the file key it answers goes in the next message. Null when the door answered nothing. */
export const useMutateRequestChatFileUploadSwr = (
    workspaceId: string,
): SWRMutationResponse<
    RequestChatFileUploadMutation["requestChatFileUpload"],
    Error,
    [string, string],
    RequestChatFileUploadArg
> =>
    useSWRMutation(
        [MUTATE_REQUEST_CHAT_FILE_UPLOAD_SWR_KEY, workspaceId],
        async ([, scope]: [string, string], { arg }: TriggerArg) =>
            answeredData(
                await mutateRequestChatFileUpload({ request: arg, headers: { "X-Workspace-Id": scope } }),
                "requestChatFileUpload",
            ).requestChatFileUpload,
    )
