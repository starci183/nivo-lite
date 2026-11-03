"use client"

import { mutateCreateContentItem } from "@/modules/api/graphql/mutations/mutation-create-content-item"
import type { MutateCreateContentItemRequest } from "@/modules/api/graphql/mutations/mutation-create-content-item"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"
import type { SWRMutationResponse } from "swr/mutation"
import type { OperationData } from "@/hooks/workspaceread"

/** The SWR key of the createContentItem mutation. */
export const MUTATE_CREATE_CONTENT_ITEM_SWR_KEY = "MUTATE_CREATE_CONTENT_ITEM_SWR"

/** SWR mutation for {@link mutateCreateContentItem}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateCreateContentItemSwr = (): SWRMutationResponse<
    OperationData<typeof mutateCreateContentItem>["createContentItem"],
    Error,
    typeof MUTATE_CREATE_CONTENT_ITEM_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_CREATE_CONTENT_ITEM_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateCreateContentItem({ request: arg }), MUTATE_CREATE_CONTENT_ITEM_SWR_KEY)
                .createContentItem,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: MutateCreateContentItemRequest
}
