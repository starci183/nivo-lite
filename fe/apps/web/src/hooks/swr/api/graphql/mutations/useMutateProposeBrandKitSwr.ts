"use client"

import { mutateProposeBrandKit } from "@/modules/api/graphql/mutations/mutation-propose-brand-kit"
import type { mutateProposeBrandKit as MutateProposeBrandKitOperation } from "@/modules/api/graphql/mutations/mutation-propose-brand-kit"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"

/** The SWR key of the proposeBrandKit mutation. */
export const MUTATE_PROPOSE_BRAND_KIT_SWR_KEY = "MUTATE_PROPOSE_BRAND_KIT_SWR"

/** SWR mutation for {@link mutateProposeBrandKit}: `trigger(input)` reads the attached guideline PDF into a brand proposal. */
export const useMutateProposeBrandKitSwr = () =>
    useSWRMutation(
        MUTATE_PROPOSE_BRAND_KIT_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateProposeBrandKit({ request: arg }), MUTATE_PROPOSE_BRAND_KIT_SWR_KEY)
                .proposeBrandKit,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateProposeBrandKitOperation>[0]["request"]
}
