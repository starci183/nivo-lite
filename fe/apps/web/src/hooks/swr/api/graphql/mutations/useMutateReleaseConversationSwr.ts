"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateReleaseConversation,
    type MutateReleaseConversationRequest,
} from "@/modules/api/graphql/mutations/mutation-release-conversation"
import type { ReleaseConversationMutation } from "@/modules/api"

/** What the ReleaseConversation mutation is triggered with. */
interface ReleaseConversationArg {
    readonly arg: MutateReleaseConversationRequest
}

/** The SWR identity of {@link useMutateReleaseConversationSwr}. */
export const MUTATE_RELEASE_CONVERSATION_SWR_KEY = "MUTATE_RELEASE_CONVERSATION_SWR"

/**
 * SWR mutation for {@link mutateReleaseConversation}: hands a customer's route back to the agent and answers `{ outcome, answered }`
 * (`released`, `nothing_held`, `not_found`); the caller reads its thread again.
 */
export const useMutateReleaseConversationSwr = (
    workspaceId: string,
): SWRMutationResponse<ReleaseConversationMutation["releaseConversation"], Error, [string, string], ReleaseConversationArg["arg"]> =>
    useSWRMutation(
        [MUTATE_RELEASE_CONVERSATION_SWR_KEY, workspaceId],
        async ([, scope]: [string, string], { arg }: ReleaseConversationArg) => {
            const result = await mutateReleaseConversation({ request: arg, headers: { "X-Workspace-Id": scope } })
            if (!result.data) throw new Error("releaseConversation answered no data")
            return result.data.releaseConversation
        },
    )
