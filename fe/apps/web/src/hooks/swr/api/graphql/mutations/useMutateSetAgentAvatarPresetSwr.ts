"use client"

import useSWRMutation from "swr/mutation"
import {
    mutateSetAgentAvatarPreset,
    type MutateSetAgentAvatarPresetRequest,
} from "@/modules/api/graphql/mutations/mutation-set-agent-avatar-preset"
import type { SWRMutationResponse } from "swr/mutation"
import type { SetAgentAvatarPresetMutation } from "@/modules/api"

/** What the SetAgentAvatarPreset mutation is triggered with. */
interface SetAgentAvatarPresetArg {
    readonly arg: MutateSetAgentAvatarPresetRequest
}

/** The SWR key of {@link useMutateSetAgentAvatarPresetSwr}. */
export const MUTATE_SET_AGENT_AVATAR_PRESET_SWR_KEY = "MUTATE_SET_AGENT_AVATAR_PRESET_SWR"

/** SWR mutation for {@link mutateSetAgentAvatarPreset}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateSetAgentAvatarPresetSwr = (): SWRMutationResponse<
    SetAgentAvatarPresetMutation["setAgentAvatarPreset"],
    Error,
    typeof MUTATE_SET_AGENT_AVATAR_PRESET_SWR_KEY,
    SetAgentAvatarPresetArg["arg"]
> =>
    useSWRMutation(MUTATE_SET_AGENT_AVATAR_PRESET_SWR_KEY, async (_key: string, { arg }: SetAgentAvatarPresetArg) => {
        const result = await mutateSetAgentAvatarPreset({ request: arg })
        if (!result.data) throw new Error("setAgentAvatarPreset answered no data")
        return result.data.setAgentAvatarPreset
    })
