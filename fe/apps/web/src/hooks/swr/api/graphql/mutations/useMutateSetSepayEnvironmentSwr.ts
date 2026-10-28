"use client"

import { mutateSetSepayEnvironment } from "@/modules/api/graphql/mutations/mutation-set-sepay-environment"
import type { mutateSetSepayEnvironment as MutateSetSepayEnvironmentOperation } from "@/modules/api/graphql/mutations/mutation-set-sepay-environment"
import useSWRMutation from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"

/** The SWR key of the setSepayEnvironment mutation. */
export const MUTATE_SET_SEPAY_ENVIRONMENT_SWR_KEY = "MUTATE_SET_SEPAY_ENVIRONMENT_SWR"

/** SWR mutation for {@link mutateSetSepayEnvironment}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSetSepayEnvironmentSwr = () =>
    useSWRMutation(
        MUTATE_SET_SEPAY_ENVIRONMENT_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateSetSepayEnvironment({ request: arg }), MUTATE_SET_SEPAY_ENVIRONMENT_SWR_KEY)
                .setSepayEnvironment,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateSetSepayEnvironmentOperation>[0]["request"]
}
