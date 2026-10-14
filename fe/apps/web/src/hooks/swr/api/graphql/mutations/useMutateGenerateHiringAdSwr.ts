"use client"

import useSWRMutation from "swr/mutation"
import { mutateGenerateHiringAd } from "@/modules/api/graphql/mutations/mutation-generate-hiring-ad"
import type { MutateGenerateHiringAdRequest } from "@/modules/api/graphql/mutations/mutation-generate-hiring-ad"

/** What the generateHiringAd mutation is triggered with. */
interface GenerateHiringAdArg {
    readonly arg: MutateGenerateHiringAdRequest
}

/** The SWR key of the `generateHiringAd` mutation. */
export const MUTATE_GENERATE_HIRING_AD_SWR_KEY = "MUTATE_GENERATE_HIRING_AD_SWR"

/** SWR mutation for {@link mutateGenerateHiringAd}: `trigger(request)` answers `generateHiringAd` and rejects with the back end failure. */
export const useMutateGenerateHiringAdSwr = () =>
    useSWRMutation(MUTATE_GENERATE_HIRING_AD_SWR_KEY, async (_key: string, { arg }: GenerateHiringAdArg) => {
        const result = await mutateGenerateHiringAd({ request: arg })
        if (!result.data) throw new Error("generateHiringAd answered no data")
        return result.data.generateHiringAd
    })
