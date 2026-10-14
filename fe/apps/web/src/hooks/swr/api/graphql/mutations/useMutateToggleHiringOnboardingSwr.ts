"use client"

import useSWRMutation from "swr/mutation"
import { mutateToggleHiringOnboarding } from "@/modules/api/graphql/mutations/mutation-toggle-hiring-onboarding"
import type { MutateToggleHiringOnboardingRequest } from "@/modules/api/graphql/mutations/mutation-toggle-hiring-onboarding"

/** What the toggleHiringOnboarding mutation is triggered with. */
interface ToggleHiringOnboardingArg {
    readonly arg: MutateToggleHiringOnboardingRequest
}

/** The SWR key of the `toggleHiringOnboarding` mutation. */
export const MUTATE_TOGGLE_HIRING_ONBOARDING_SWR_KEY = "MUTATE_TOGGLE_HIRING_ONBOARDING_SWR"

/** SWR mutation for {@link mutateToggleHiringOnboarding}: `trigger(request)` answers `toggleHiringOnboarding` and rejects with the back end failure. */
export const useMutateToggleHiringOnboardingSwr = () =>
    useSWRMutation(
        MUTATE_TOGGLE_HIRING_ONBOARDING_SWR_KEY,
        async (_key: string, { arg }: ToggleHiringOnboardingArg) => {
            const result = await mutateToggleHiringOnboarding({ request: arg })
            if (!result.data) throw new Error("toggleHiringOnboarding answered no data")
            return result.data.toggleHiringOnboarding
        },
    )
