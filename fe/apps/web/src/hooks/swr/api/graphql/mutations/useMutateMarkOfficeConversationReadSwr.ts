"use client"

import useSWRMutation from "swr/mutation"
import {
    mutateMarkOfficeConversationRead,
    type MutateMarkOfficeConversationReadRequest,
} from "@/modules/api/graphql/mutations/mutation-mark-office-conversation-read"
import type { SWRMutationResponse } from "swr/mutation"
import type { MarkOfficeConversationReadMutation } from "@/modules/api"

/** What the MarkOfficeConversationRead mutation is triggered with. */
interface MarkOfficeConversationReadArg {
    readonly arg: MutateMarkOfficeConversationReadRequest
}

/** The SWR key of {@link useMutateMarkOfficeConversationReadSwr}. */
export const MUTATE_MARK_OFFICE_CONVERSATION_READ_SWR_KEY = "MUTATE_MARK_OFFICE_CONVERSATION_READ_SWR"

/** SWR mutation for {@link mutateMarkOfficeConversationRead}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateMarkOfficeConversationReadSwr = (): SWRMutationResponse<
    MarkOfficeConversationReadMutation["markOfficeConversationRead"],
    Error,
    typeof MUTATE_MARK_OFFICE_CONVERSATION_READ_SWR_KEY,
    MarkOfficeConversationReadArg["arg"]
> =>
    useSWRMutation(
        MUTATE_MARK_OFFICE_CONVERSATION_READ_SWR_KEY,
        async (_key: string, { arg }: MarkOfficeConversationReadArg) => {
            const result = await mutateMarkOfficeConversationRead({ request: arg })
            if (!result.data) throw new Error("markOfficeConversationRead answered no data")
            return result.data.markOfficeConversationRead
        },
    )
