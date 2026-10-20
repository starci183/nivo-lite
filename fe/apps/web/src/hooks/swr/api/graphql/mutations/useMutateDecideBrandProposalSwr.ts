"use client"

import { mutateDecideBrandProposal } from "@/modules/api/graphql/mutations/mutation-decide-brand-proposal"
import type { mutateDecideBrandProposal as MutateDecideBrandProposalOperation } from "@/modules/api/graphql/mutations/mutation-decide-brand-proposal"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"

/** The SWR key of the decideBrandProposal mutation. */
export const MUTATE_DECIDE_BRAND_PROPOSAL_SWR_KEY = "MUTATE_DECIDE_BRAND_PROPOSAL_SWR"

/** SWR mutation for {@link mutateDecideBrandProposal}: `trigger(input)` confirms or rejects a brand proposal. */
export const useMutateDecideBrandProposalSwr = () =>
    useSWRMutation(
        MUTATE_DECIDE_BRAND_PROPOSAL_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateDecideBrandProposal({ request: arg }), MUTATE_DECIDE_BRAND_PROPOSAL_SWR_KEY)
                .decideBrandProposal,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateDecideBrandProposalOperation>[0]["request"]
}
