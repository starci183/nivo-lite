"use client"

import { mutateTransitionContentItem } from "@/modules/api/graphql/mutations/mutation-transition-content-item"
import type { mutateTransitionContentItem as MutateTransitionContentItemOperation } from "@/modules/api/graphql/mutations/mutation-transition-content-item"
import useSWRMutation from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"

/** The SWR key of the transitionContentItem mutation. */
export const MUTATE_TRANSITION_CONTENT_ITEM_SWR_KEY = "MUTATE_TRANSITION_CONTENT_ITEM_SWR"

/** SWR mutation for {@link mutateTransitionContentItem}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateTransitionContentItemSwr = () =>
    useSWRMutation(
        MUTATE_TRANSITION_CONTENT_ITEM_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateTransitionContentItem({ request: arg }), MUTATE_TRANSITION_CONTENT_ITEM_SWR_KEY)
                .transitionContentItem,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateTransitionContentItemOperation>[0]["request"]
}
