"use client"

import {
    mutateForgetContactMemory,
    type mutateForgetContactMemory as MutateForgetContactMemoryOperation,
} from "@/modules/api/graphql/mutations/mutation-forget-contact-memory"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import type { ForgetContactMemoryMutation } from "@/modules/api"

/** The SWR key of the forgetContactMemory mutation. */
export const MUTATE_FORGET_CONTACT_MEMORY_SWR_KEY = "MUTATE_FORGET_CONTACT_MEMORY_SWR"

/** SWR mutation for {@link mutateForgetContactMemory}: Makes the agents forget named facts. `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateForgetContactMemorySwr = (): SWRMutationResponse<
    ForgetContactMemoryMutation["forgetContactMemory"],
    Error,
    typeof MUTATE_FORGET_CONTACT_MEMORY_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_FORGET_CONTACT_MEMORY_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateForgetContactMemory({ request: arg }), MUTATE_FORGET_CONTACT_MEMORY_SWR_KEY)
                .forgetContactMemory,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateForgetContactMemoryOperation>[0]["request"]
}
