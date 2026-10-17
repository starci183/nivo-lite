"use client"

import { mutateRevealSepayKey } from "@/modules/api/graphql/mutations/mutation-reveal-sepay-key"
import type { mutateRevealSepayKey as MutateRevealSepayKeyOperation } from "@/modules/api/graphql/mutations/mutation-reveal-sepay-key"
import useSWRMutation from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"

/** The SWR key of the revealSepayKey mutation. */
export const MUTATE_REVEAL_SEPAY_KEY_SWR_KEY = "MUTATE_REVEAL_SEPAY_KEY_SWR"

/** SWR mutation for {@link mutateRevealSepayKey}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateRevealSepayKeySwr = () =>
    useSWRMutation(
        MUTATE_REVEAL_SEPAY_KEY_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateRevealSepayKey({ request: arg }), MUTATE_REVEAL_SEPAY_KEY_SWR_KEY).revealSepayKey,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateRevealSepayKeyOperation>[0]["request"]
}
