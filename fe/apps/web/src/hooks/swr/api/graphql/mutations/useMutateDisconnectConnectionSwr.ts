"use client"

import {
    mutateDisconnectConnection,
    type mutateDisconnectConnection as MutateDisconnectConnectionOperation,
} from "@/modules/api/graphql/mutations/mutation-disconnect-connection"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import type { DisconnectConnectionMutation } from "@/modules/api"

/** The SWR key of the disconnectConnection mutation. */
export const MUTATE_DISCONNECT_CONNECTION_SWR_KEY = "MUTATE_DISCONNECT_CONNECTION_SWR"

/** SWR mutation for {@link mutateDisconnectConnection}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateDisconnectConnectionSwr = (): SWRMutationResponse<
    DisconnectConnectionMutation["disconnectConnection"],
    Error,
    typeof MUTATE_DISCONNECT_CONNECTION_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_DISCONNECT_CONNECTION_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateDisconnectConnection({ request: arg }), MUTATE_DISCONNECT_CONNECTION_SWR_KEY)
                .disconnectConnection,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateDisconnectConnectionOperation>[0]["request"]
}
