"use client"

import { mutateDeleteConnection } from "@/modules/api/graphql/mutations/mutation-delete-connection"
import type { mutateDeleteConnection as MutateDeleteConnectionOperation } from "@/modules/api/graphql/mutations/mutation-delete-connection"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"
import type { SWRMutationResponse } from "swr/mutation"
import type { OperationData } from "@/hooks/workspaceread"

/** The SWR key of the deleteConnection mutation. */
export const MUTATE_DELETE_CONNECTION_SWR_KEY = "MUTATE_DELETE_CONNECTION_SWR"

/** SWR mutation for {@link mutateDeleteConnection}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateDeleteConnectionSwr = (): SWRMutationResponse<
    OperationData<typeof mutateDeleteConnection>["deleteConnection"],
    Error,
    typeof MUTATE_DELETE_CONNECTION_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_DELETE_CONNECTION_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateDeleteConnection({ request: arg }), MUTATE_DELETE_CONNECTION_SWR_KEY)
                .deleteConnection,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateDeleteConnectionOperation>[0]["request"]
}
