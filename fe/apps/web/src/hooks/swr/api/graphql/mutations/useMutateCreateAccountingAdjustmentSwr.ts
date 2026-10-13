import { mutateCreateAccountingAdjustment } from "@/modules/api/graphql/mutations/mutation-create-accounting-adjustment"
import { useGraphQLMutationSwr } from "@/hooks/reuseables/useGraphQLMutationSwr"

/** The SWR key of the createAccountingAdjustment mutation. */
export const MUTATE_CREATE_ACCOUNTING_ADJUSTMENT_SWR_KEY = "MUTATE_CREATE_ACCOUNTING_ADJUSTMENT_SWR"

/** SWR mutation for {@link mutateCreateAccountingAdjustment}: Appends an accounting correction. `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateCreateAccountingAdjustmentSwr = () => useGraphQLMutationSwr(MUTATE_CREATE_ACCOUNTING_ADJUSTMENT_SWR_KEY, mutateCreateAccountingAdjustment, (data) => data.createAccountingAdjustment)
