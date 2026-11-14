"use client"

import { mutateUpdateConnection, type MutateUpdateConnectionRequest } from "@/modules/api/graphql/mutations/mutation-update-connection"
import { answeredData } from "@/hooks/workspaceread"
import type { UpdateConnectionMutation } from "@/modules/api"
import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"

/** The SWR key of the updateConnection mutation. */
export const MUTATE_UPDATE_CONNECTION_SWR_KEY = "MUTATE_UPDATE_CONNECTION_SWR"

/** SWR mutation for {@link mutateUpdateConnection}: `trigger(input)` answers the account's form again and rejects with the back end failure. */
export const useMutateUpdateConnectionSwr = (): SWRMutationResponse<
    UpdateConnectionMutation["updateConnection"],
    Error,
    typeof MUTATE_UPDATE_CONNECTION_SWR_KEY,
    MutateUpdateConnectionRequest
> =>
    useSWRMutation(
        MUTATE_UPDATE_CONNECTION_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateUpdateConnection({ request: arg }), MUTATE_UPDATE_CONNECTION_SWR_KEY).updateConnection,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: MutateUpdateConnectionRequest
}
