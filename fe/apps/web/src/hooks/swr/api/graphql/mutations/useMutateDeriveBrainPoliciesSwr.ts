"use client"

import { mutateDeriveBrainPolicies } from "@/modules/api/graphql/mutations/mutation-derive-brain-policies"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import type { DeriveBrainPoliciesMutation } from "@/modules/api"

/** The SWR key of the deriveBrainPolicies mutation. */
export const MUTATE_DERIVE_BRAIN_POLICIES_SWR_KEY = "MUTATE_DERIVE_BRAIN_POLICIES_SWR"

/** SWR mutation for {@link mutateDeriveBrainPolicies}: queues one derive pass of the shop's policies (no input). */
export const useMutateDeriveBrainPoliciesSwr = (): SWRMutationResponse<
    DeriveBrainPoliciesMutation["deriveBrainPolicies"],
    Error,
    typeof MUTATE_DERIVE_BRAIN_POLICIES_SWR_KEY,
    never
> =>
    useSWRMutation(
        MUTATE_DERIVE_BRAIN_POLICIES_SWR_KEY,
        async (_key: string) =>
            answeredData(await mutateDeriveBrainPolicies(), MUTATE_DERIVE_BRAIN_POLICIES_SWR_KEY).deriveBrainPolicies,
    )
