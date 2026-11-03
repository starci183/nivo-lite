"use client"

import { mutateSaveContentItem } from "@/modules/api/graphql/mutations/mutation-save-content-item"
import type { MutateSaveContentItemRequest } from "@/modules/api/graphql/mutations/mutation-save-content-item"
import useSWRMutation from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"
import type { SWRMutationResponse } from "swr/mutation"
import type { OperationData } from "@/hooks/workspaceread"

/** The SWR key of the saveContentItem mutation. */
export const MUTATE_SAVE_CONTENT_ITEM_SWR_KEY = "MUTATE_SAVE_CONTENT_ITEM_SWR"

/** SWR mutation for {@link mutateSaveContentItem}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSaveContentItemSwr = (): SWRMutationResponse<
    OperationData<typeof mutateSaveContentItem>["saveContentItem"],
    Error,
    typeof MUTATE_SAVE_CONTENT_ITEM_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_SAVE_CONTENT_ITEM_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateSaveContentItem({ request: arg }), MUTATE_SAVE_CONTENT_ITEM_SWR_KEY)
                .saveContentItem,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: MutateSaveContentItemRequest
}
