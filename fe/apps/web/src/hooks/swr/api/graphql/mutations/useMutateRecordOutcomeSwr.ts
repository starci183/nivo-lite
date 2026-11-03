"use client"

import useSWRMutation from "swr/mutation"
import {
    mutateRecordOutcome,
    type MutateRecordOutcomeRequest,
} from "@/modules/api/graphql/mutations/mutation-record-outcome"
import type { SWRMutationResponse } from "swr/mutation"
import type { RecordOutcomeMutation } from "@/modules/api"

/** What the recordOutcome mutation is triggered with. */
interface RecordOutcomeArg {
    readonly arg: MutateRecordOutcomeRequest
}

/** The SWR key of the recordOutcome mutation. */
export const MUTATE_RECORD_OUTCOME_SWR_KEY = "MUTATE_RECORD_OUTCOME_SWR"

/** SWR mutation for {@link mutateRecordOutcome}: `trigger(request)` answers the result and rejects with the back end failure. */
export const useMutateRecordOutcomeSwr = (): SWRMutationResponse<
    RecordOutcomeMutation["recordOutcome"],
    Error,
    typeof MUTATE_RECORD_OUTCOME_SWR_KEY,
    RecordOutcomeArg["arg"]
> =>
    useSWRMutation(MUTATE_RECORD_OUTCOME_SWR_KEY, async (_key: string, { arg }: RecordOutcomeArg) => {
        const result = await mutateRecordOutcome({ request: arg })
        if (!result.data) throw new Error("recordOutcome answered no data")
        return result.data.recordOutcome
    })
