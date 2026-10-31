"use client"

import { mutateRotateSepayKey } from "@/modules/api/graphql/mutations/mutation-rotate-sepay-key"
import type { mutateRotateSepayKey as MutateRotateSepayKeyOperation } from "@/modules/api/graphql/mutations/mutation-rotate-sepay-key"
import useSWRMutation from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"

/** The SWR key of the rotateSepayKey mutation. */
export const MUTATE_ROTATE_SEPAY_KEY_SWR_KEY = "MUTATE_ROTATE_SEPAY_KEY_SWR"

/** SWR mutation for {@link mutateRotateSepayKey}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateRotateSepayKeySwr = () =>
    useSWRMutation(
        MUTATE_ROTATE_SEPAY_KEY_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateRotateSepayKey({ request: arg }), MUTATE_ROTATE_SEPAY_KEY_SWR_KEY).rotateSepayKey,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateRotateSepayKeyOperation>[0]["request"]
}
