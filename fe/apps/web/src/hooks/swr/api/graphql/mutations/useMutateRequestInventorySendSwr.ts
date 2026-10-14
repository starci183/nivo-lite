"use client"

import useSWRMutation from "swr/mutation"
import { mutateRequestInventorySend } from "@/modules/api/graphql/mutations/mutation-request-inventory-send"
import type { MutateRequestInventorySendRequest } from "@/modules/api/graphql/mutations/mutation-request-inventory-send"

/** What the requestInventorySend mutation is triggered with. */
interface RequestInventorySendArg {
    readonly arg: MutateRequestInventorySendRequest
}

/** The SWR key of the `requestInventorySend` mutation. */
export const MUTATE_REQUEST_INVENTORY_SEND_SWR_KEY = "MUTATE_REQUEST_INVENTORY_SEND_SWR"

/** SWR mutation for {@link mutateRequestInventorySend}: `trigger(request)` answers `requestInventorySend` and rejects with the back end failure. */
export const useMutateRequestInventorySendSwr = () =>
    useSWRMutation(MUTATE_REQUEST_INVENTORY_SEND_SWR_KEY, async (_key: string, { arg }: RequestInventorySendArg) => {
        const result = await mutateRequestInventorySend({ request: arg })
        if (!result.data) throw new Error("requestInventorySend answered no data")
        return result.data.requestInventorySend
    })
