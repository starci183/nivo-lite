"use client"

import { mutateRecheckZaloConnection } from "@/modules/api/graphql/mutations/mutation-recheck-zalo-connection"
import type { mutateRecheckZaloConnection as MutateRecheckZaloConnectionOperation } from "@/modules/api/graphql/mutations/mutation-recheck-zalo-connection"
import useSWRMutation from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"
import type { SWRMutationResponse } from "swr/mutation"
import type { OperationData } from "@/hooks/workspaceread"

/** The SWR key of the recheckZaloConnection mutation. */
export const MUTATE_RECHECK_ZALO_CONNECTION_SWR_KEY = "MUTATE_RECHECK_ZALO_CONNECTION_SWR_KEY"

/** SWR mutation for {@link mutateRecheckZaloConnection}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateRecheckZaloConnectionSwr = (): SWRMutationResponse<
    OperationData<typeof mutateRecheckZaloConnection>["recheckZaloConnection"],
    Error,
    typeof MUTATE_RECHECK_ZALO_CONNECTION_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_RECHECK_ZALO_CONNECTION_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateRecheckZaloConnection({ request: arg }), MUTATE_RECHECK_ZALO_CONNECTION_SWR_KEY)
                .recheckZaloConnection,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateRecheckZaloConnectionOperation>[0]["request"]
}
