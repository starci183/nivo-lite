"use client"

import { mutateRunConnectionAction, type MutateRunConnectionActionRequest } from "@/modules/api/graphql/mutations/mutation-run-connection-action"
import { answeredData } from "@/hooks/workspaceread"
import type { RunConnectionActionMutation } from "@/modules/api"
import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"

/** The SWR key of the runConnectionAction mutation. */
export const MUTATE_RUN_CONNECTION_ACTION_SWR_KEY = "MUTATE_RUN_CONNECTION_ACTION_SWR"

/** SWR mutation for {@link mutateRunConnectionAction}: `trigger(input)` answers the action's results and the form again, and rejects with the back end failure. */
export const useMutateRunConnectionActionSwr = (): SWRMutationResponse<
    RunConnectionActionMutation["runConnectionAction"],
    Error,
    typeof MUTATE_RUN_CONNECTION_ACTION_SWR_KEY,
    MutateRunConnectionActionRequest
> =>
    useSWRMutation(
        MUTATE_RUN_CONNECTION_ACTION_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateRunConnectionAction({ request: arg }), MUTATE_RUN_CONNECTION_ACTION_SWR_KEY)
                .runConnectionAction,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: MutateRunConnectionActionRequest
}
