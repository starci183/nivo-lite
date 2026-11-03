"use client"

import useSWRMutation from "swr/mutation"
import { mutateFinishWebhookConnection } from "@/modules/api/graphql/mutations/mutation-finish-webhook-connection"
import type { MutateFinishWebhookConnectionRequest } from "@/modules/api/graphql/mutations/mutation-finish-webhook-connection"
import type { SWRMutationResponse } from "swr/mutation"
import type { OperationData } from "@/hooks/workspaceread"

/** What the finishWebhookConnection mutation is triggered with. */
interface FinishWebhookConnectionArg {
    readonly arg: MutateFinishWebhookConnectionRequest
}

/** The SWR key of the finishWebhookConnection mutation. */
export const MUTATE_FINISH_WEBHOOK_CONNECTION_SWR_KEY = "MUTATE_FINISH_WEBHOOK_CONNECTION_SWR"

/** SWR mutation for {@link mutateFinishWebhookConnection}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateFinishWebhookConnectionSwr = (): SWRMutationResponse<
    OperationData<typeof mutateFinishWebhookConnection>["finishWebhookConnection"],
    Error,
    typeof MUTATE_FINISH_WEBHOOK_CONNECTION_SWR_KEY,
    FinishWebhookConnectionArg["arg"]
> =>
    useSWRMutation(
        MUTATE_FINISH_WEBHOOK_CONNECTION_SWR_KEY,
        async (_key: string, { arg }: FinishWebhookConnectionArg) => {
            const result = await mutateFinishWebhookConnection({ request: arg })
            if (!result.data) throw new Error("finishWebhookConnection answered no data")
            return result.data.finishWebhookConnection
        },
    )
