"use client"

import { mutateMoveContentItem } from "@/modules/api/graphql/mutations/mutation-move-content-item"
import type { mutateMoveContentItem as MutateMoveContentItemOperation } from "@/modules/api/graphql/mutations/mutation-move-content-item"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"

/** The SWR key of the moveContentItem mutation. */
export const MUTATE_MOVE_CONTENT_ITEM_SWR_KEY = "MUTATE_MOVE_CONTENT_ITEM_SWR"

/** SWR mutation for {@link mutateMoveContentItem}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateMoveContentItemSwr = () =>
    useSWRMutation(
        MUTATE_MOVE_CONTENT_ITEM_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateMoveContentItem({ request: arg }), MUTATE_MOVE_CONTENT_ITEM_SWR_KEY)
                .moveContentItem,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateMoveContentItemOperation>[0]["request"]
}
