"use client"

import useSWRMutation from "swr/mutation"
import { mutateRemoveAgent } from "@/modules/api/graphql/mutations/mutation-remove-agent"
import type { MutateRemoveAgentRequest } from "@/modules/api/graphql/mutations/mutation-remove-agent"

/** What the RemoveAgent mutation is triggered with. */
interface RemoveAgentArg {
    readonly arg: MutateRemoveAgentRequest
}

/** The SWR key of {@link useMutateRemoveAgentSwr}. */
export const MUTATE_REMOVE_AGENT_SWR_KEY = "MUTATE_REMOVE_AGENT_SWR"

/** SWR mutation for {@link mutateRemoveAgent}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateRemoveAgentSwr = () =>
    useSWRMutation(MUTATE_REMOVE_AGENT_SWR_KEY, async (_key: string, { arg }: RemoveAgentArg) => {
        const result = await mutateRemoveAgent({ request: arg })
        if (!result.data) throw new Error("removeAgent answered no data")
        return result.data.removeAgent
    })
