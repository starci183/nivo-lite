"use client"

import {
    mutateStartZaloConnection,
    type mutateStartZaloConnection as MutateStartZaloConnectionOperation,
} from "@/modules/api/graphql/mutations/mutation-start-zalo-connection"
import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"
import type { StartZaloConnectionMutation } from "@/modules/api"

/** The SWR key of the startZaloConnection mutation. */
export const MUTATE_START_ZALO_CONNECTION_SWR_KEY = "MUTATE_START_ZALO_CONNECTION_SWR"

/** SWR mutation for {@link mutateStartZaloConnection}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateStartZaloConnectionSwr = (): SWRMutationResponse<
    StartZaloConnectionMutation["startZaloConnection"],
    Error,
    typeof MUTATE_START_ZALO_CONNECTION_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_START_ZALO_CONNECTION_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateStartZaloConnection({ request: arg }), MUTATE_START_ZALO_CONNECTION_SWR_KEY)
                .startZaloConnection,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateStartZaloConnectionOperation>[0]["request"]
}
