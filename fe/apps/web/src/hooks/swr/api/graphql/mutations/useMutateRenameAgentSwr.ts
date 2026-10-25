"use client"

import useSWRMutation from "swr/mutation"
import { mutateRenameAgent } from "@/modules/api/graphql/mutations/mutation-rename-agent"
import type { MutateRenameAgentRequest } from "@/modules/api/graphql/mutations/mutation-rename-agent"

/** What the RenameAgent mutation is triggered with. */
interface RenameAgentArg {
    readonly arg: MutateRenameAgentRequest
}

/** The SWR key of {@link useMutateRenameAgentSwr}. */
export const MUTATE_RENAME_AGENT_SWR_KEY = "MUTATE_RENAME_AGENT_SWR"

/** SWR mutation for {@link mutateRenameAgent}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateRenameAgentSwr = () =>
    useSWRMutation(MUTATE_RENAME_AGENT_SWR_KEY, async (_key: string, { arg }: RenameAgentArg) => {
        const result = await mutateRenameAgent({ request: arg })
        if (!result.data) throw new Error("renameAgent answered no data")
        return result.data.renameAgent
    })
