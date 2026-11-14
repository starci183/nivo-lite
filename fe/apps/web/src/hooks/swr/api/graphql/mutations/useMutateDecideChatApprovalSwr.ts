"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import { useSWRConfig } from "swr"
import { matchesSwrKey } from "@/modules/utils"
import { QUERY_CHAT_ROOMS_SWR_KEY } from "../queries/useQueryChatRoomsSwr"
import {
    mutateDecideChatApproval,
    type mutateDecideChatApproval as DecideChatApprovalOperation,
} from "@/modules/api/graphql/mutations/mutation-decide-chat-approval"
import type { DecideChatApprovalMutation } from "@/modules/api"

/** What the DecideChatApproval mutation is triggered with. */
interface TriggerArg {
    readonly arg: DecideChatApprovalArg
}

/** The request of the DecideChatApproval operation. */
type DecideChatApprovalArg = Parameters<typeof DecideChatApprovalOperation>[0]["request"]

/** The SWR identity of the DecideChatApproval mutation. */
export const MUTATE_DECIDE_CHAT_APPROVAL_SWR_KEY = "MUTATE_DECIDE_CHAT_APPROVAL_SWR"

/** Settles one decision from its card as the caller's seat; every card of that decision reads the outcome, so the rooms are read again. */
export const useMutateDecideChatApprovalSwr = (
    workspaceId: string,
): SWRMutationResponse<
    DecideChatApprovalMutation["decideChatApproval"] | undefined,
    Error,
    [string, string],
    DecideChatApprovalArg
> => {
    const { mutate } = useSWRConfig()
    return useSWRMutation(
        [MUTATE_DECIDE_CHAT_APPROVAL_SWR_KEY, workspaceId],
        ([, scope]: [string, string], { arg }: TriggerArg) =>
            mutateDecideChatApproval({ request: arg, headers: { "X-Workspace-Id": scope } }).then(
                (result) => result.data?.decideChatApproval,
            ),
        {
            onSuccess: () => {
                void mutate(matchesSwrKey(QUERY_CHAT_ROOMS_SWR_KEY))
            },
        },
    )
}
