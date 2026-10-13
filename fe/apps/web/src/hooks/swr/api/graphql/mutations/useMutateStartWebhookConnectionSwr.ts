import useSWRMutation from "swr/mutation"
import { mutateStartWebhookConnection } from "@/modules/api/graphql/mutations/mutation-start-webhook-connection"
import type { MutateStartWebhookConnectionRequest } from "@/modules/api/graphql/mutations/mutation-start-webhook-connection"

/** What the startWebhookConnection mutation is triggered with. */
interface StartWebhookConnectionArg {
    readonly arg: MutateStartWebhookConnectionRequest
}

/** The SWR key of the startWebhookConnection mutation. */
export const MUTATE_START_WEBHOOK_CONNECTION_SWR_KEY = "MUTATE_START_WEBHOOK_CONNECTION_SWR"

/** SWR mutation for {@link mutateStartWebhookConnection}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateStartWebhookConnectionSwr = () =>
    useSWRMutation(
        MUTATE_START_WEBHOOK_CONNECTION_SWR_KEY,
        async (_key: string, { arg }: StartWebhookConnectionArg) => {
            const result = await mutateStartWebhookConnection({ request: arg })
            if (result.data === undefined || result.data === null)
                throw new Error("startWebhookConnection answered no data")
            return result.data.startWebhookConnection
        },
    )
