"use client"

import useSWRMutation from "swr/mutation"
import { mutateHandoffToAccounting } from "@/modules/api/graphql/mutations/mutation-handoff-to-accounting"
import type { MutateHandoffToAccountingRequest } from "@/modules/api/graphql/mutations/mutation-handoff-to-accounting"
import type { SWRMutationResponse } from "swr/mutation"
import type { OperationData } from "@/hooks/workspaceread"

/** What the handoffToAccounting mutation is triggered with. */
interface HandoffToAccountingArg {
    readonly arg: MutateHandoffToAccountingRequest
}

/** The SWR key of the handoffToAccounting mutation. */
export const MUTATE_HANDOFF_TO_ACCOUNTING_SWR_KEY = "MUTATE_HANDOFF_TO_ACCOUNTING_SWR"

/** SWR mutation for {@link mutateHandoffToAccounting}: `trigger(request)` answers the result and rejects with the back end failure. */
export const useMutateHandoffToAccountingSwr = (): SWRMutationResponse<
    OperationData<typeof mutateHandoffToAccounting>["handoffToAccounting"],
    Error,
    typeof MUTATE_HANDOFF_TO_ACCOUNTING_SWR_KEY,
    HandoffToAccountingArg["arg"]
> =>
    useSWRMutation(MUTATE_HANDOFF_TO_ACCOUNTING_SWR_KEY, async (_key: string, { arg }: HandoffToAccountingArg) => {
        const result = await mutateHandoffToAccounting({ request: arg })
        if (!result.data) throw new Error("handoffToAccounting answered no data")
        return result.data.handoffToAccounting
    })
