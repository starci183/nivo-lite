"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateSetAgentAvatar,
    type MutateSetAgentAvatarRequest,
} from "@/modules/api/graphql/mutations/mutation-set-agent-avatar"
import type { SetAgentAvatarMutation } from "@/modules/api"

/** What the SetAgentAvatar mutation is triggered with. */
interface SetAgentAvatarArg {
    readonly arg: MutateSetAgentAvatarRequest
}

/** The SWR key of {@link useMutateSetAgentAvatarSwr}. */
export const MUTATE_SET_AGENT_AVATAR_SWR_KEY = "MUTATE_SET_AGENT_AVATAR_SWR"

/** SWR mutation for {@link mutateSetAgentAvatar}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateSetAgentAvatarSwr = (): SWRMutationResponse<
    SetAgentAvatarMutation["setAgentAvatar"],
    Error,
    typeof MUTATE_SET_AGENT_AVATAR_SWR_KEY,
    SetAgentAvatarArg["arg"]
> =>
    useSWRMutation(MUTATE_SET_AGENT_AVATAR_SWR_KEY, async (_key: string, { arg }: SetAgentAvatarArg) => {
        const result = await mutateSetAgentAvatar({ request: arg })
        if (!result.data) throw new Error("setAgentAvatar answered no data")
        return result.data.setAgentAvatar
    })
