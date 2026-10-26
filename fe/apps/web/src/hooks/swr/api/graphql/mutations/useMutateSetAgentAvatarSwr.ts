"use client"

import useSWRMutation from "swr/mutation"
import { mutateSetAgentAvatar } from "@/modules/api/graphql/mutations/mutation-set-agent-avatar"
import type { MutateSetAgentAvatarRequest } from "@/modules/api/graphql/mutations/mutation-set-agent-avatar"

/** What the SetAgentAvatar mutation is triggered with. */
interface SetAgentAvatarArg {
    readonly arg: MutateSetAgentAvatarRequest
}

/** The SWR key of {@link useMutateSetAgentAvatarSwr}. */
export const MUTATE_SET_AGENT_AVATAR_SWR_KEY = "MUTATE_SET_AGENT_AVATAR_SWR"

/** SWR mutation for {@link mutateSetAgentAvatar}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateSetAgentAvatarSwr = () =>
    useSWRMutation(MUTATE_SET_AGENT_AVATAR_SWR_KEY, async (_key: string, { arg }: SetAgentAvatarArg) => {
        const result = await mutateSetAgentAvatar({ request: arg })
        if (!result.data) throw new Error("setAgentAvatar answered no data")
        return result.data.setAgentAvatar
    })
