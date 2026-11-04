"use client"

import {
    mutateRequestChatAnswer,
    type mutateRequestChatAnswer as MutateRequestChatAnswerOperation,
} from "@/modules/api/graphql/mutations/mutation-request-chat-answer"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"
import type { SWRMutationResponse } from "swr/mutation"
import type { RequestChatAnswerMutation } from "@/modules/api"

/** The SWR key of the requestChatAnswer mutation. */
export const MUTATE_REQUEST_CHAT_ANSWER_SWR_KEY = "MUTATE_REQUEST_CHAT_ANSWER_SWR"

/** SWR mutation for {@link mutateRequestChatAnswer}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateRequestChatAnswerSwr = (): SWRMutationResponse<
    RequestChatAnswerMutation["requestChatAnswer"],
    Error,
    typeof MUTATE_REQUEST_CHAT_ANSWER_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_REQUEST_CHAT_ANSWER_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateRequestChatAnswer({ request: arg }), MUTATE_REQUEST_CHAT_ANSWER_SWR_KEY)
                .requestChatAnswer,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateRequestChatAnswerOperation>[0]["request"]
}
