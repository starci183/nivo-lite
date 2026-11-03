"use client"

import { mutateCreateAccountingAdjustment } from "@/modules/api/graphql/mutations/mutation-create-accounting-adjustment"
import type { MutateCreateAccountingAdjustmentRequest } from "@/modules/api/graphql/mutations/mutation-create-accounting-adjustment"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"
import type { SWRMutationResponse } from "swr/mutation"
import type { OperationData } from "@/hooks/workspaceread"

/** The SWR key of the createAccountingAdjustment mutation. */
export const MUTATE_CREATE_ACCOUNTING_ADJUSTMENT_SWR_KEY = "MUTATE_CREATE_ACCOUNTING_ADJUSTMENT_SWR"

/** SWR mutation for {@link mutateCreateAccountingAdjustment}: Appends an accounting correction. `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateCreateAccountingAdjustmentSwr = (): SWRMutationResponse<
    OperationData<typeof mutateCreateAccountingAdjustment>["createAccountingAdjustment"],
    Error,
    typeof MUTATE_CREATE_ACCOUNTING_ADJUSTMENT_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_CREATE_ACCOUNTING_ADJUSTMENT_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(
                await mutateCreateAccountingAdjustment({ request: arg }),
                MUTATE_CREATE_ACCOUNTING_ADJUSTMENT_SWR_KEY,
            ).createAccountingAdjustment,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: MutateCreateAccountingAdjustmentRequest
}
