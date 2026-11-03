"use client"

import { mutateRequestChatReply } from "@/modules/api/graphql/mutations/mutation-request-chat-reply"
import type { mutateRequestChatReply as MutateRequestChatReplyOperation } from "@/modules/api/graphql/mutations/mutation-request-chat-reply"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"
import type { SWRMutationResponse } from "swr/mutation"
import type { OperationData } from "@/hooks/workspaceread"

/** The SWR key of the requestChatReply mutation. */
export const MUTATE_REQUEST_CHAT_REPLY_SWR_KEY = "MUTATE_REQUEST_CHAT_REPLY_SWR"

/** SWR mutation for {@link mutateRequestChatReply}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateRequestChatReplySwr = (): SWRMutationResponse<
    OperationData<typeof mutateRequestChatReply>["requestChatReply"],
    Error,
    typeof MUTATE_REQUEST_CHAT_REPLY_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_REQUEST_CHAT_REPLY_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateRequestChatReply({ request: arg }), MUTATE_REQUEST_CHAT_REPLY_SWR_KEY)
                .requestChatReply,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateRequestChatReplyOperation>[0]["request"]
}
