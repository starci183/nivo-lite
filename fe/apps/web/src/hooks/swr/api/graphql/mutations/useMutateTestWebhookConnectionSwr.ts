import useSWRMutation from "swr/mutation"
import { mutateTestWebhookConnection } from "@/modules/api/graphql/mutations/mutation-test-webhook-connection"
import type { MutateTestWebhookConnectionRequest } from "@/modules/api/graphql/mutations/mutation-test-webhook-connection"

/** What the testWebhookConnection mutation is triggered with. */
interface TestWebhookConnectionArg {
    readonly arg: MutateTestWebhookConnectionRequest
}

/** The SWR key of the testWebhookConnection mutation. */
export const MUTATE_TEST_WEBHOOK_CONNECTION_SWR_KEY = "MUTATE_TEST_WEBHOOK_CONNECTION_SWR"

/** SWR mutation for {@link mutateTestWebhookConnection}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateTestWebhookConnectionSwr = () =>
    useSWRMutation(MUTATE_TEST_WEBHOOK_CONNECTION_SWR_KEY, async (_key: string, { arg }: TestWebhookConnectionArg) => {
        const result = await mutateTestWebhookConnection({ request: arg })
        if (result.data === undefined || result.data === null) throw new Error("testWebhookConnection answered no data")
        return result.data.testWebhookConnection
    })
