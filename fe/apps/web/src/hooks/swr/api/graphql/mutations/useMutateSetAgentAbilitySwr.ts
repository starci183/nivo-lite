"use client"

import { mutateSetAgentAbility, type MutateSetAgentAbilityRequest } from "@/modules/api/graphql/mutations/mutation-set-agent-ability"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"

/** The SWR key of the setAgentAbility mutation. */
export const MUTATE_SET_AGENT_ABILITY_SWR_KEY = "MUTATE_SET_AGENT_ABILITY_SWR"

/** SWR mutation for {@link mutateSetAgentAbility}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSetAgentAbilitySwr = (): SWRMutationResponse<boolean, Error, typeof MUTATE_SET_AGENT_ABILITY_SWR_KEY, MutateSetAgentAbilityRequest> =>
    useSWRMutation(
        MUTATE_SET_AGENT_ABILITY_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateSetAgentAbility({ request: arg }), MUTATE_SET_AGENT_ABILITY_SWR_KEY).setAgentAbility,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: MutateSetAgentAbilityRequest
}
