"use client"

import { mutateTestWebhookConnection } from "@/modules/api/graphql/mutations/mutation-test-webhook-connection"
import type { mutateTestWebhookConnection as MutateTestWebhookConnectionOperation } from "@/modules/api/graphql/mutations/mutation-test-webhook-connection"
import useSWRMutation from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"

/** The SWR key of the testWebhookConnection mutation. */
export const MUTATE_TEST_WEBHOOK_CONNECTION_SWR_KEY = "MUTATE_TEST_WEBHOOK_CONNECTION_SWR"

/** SWR mutation for {@link mutateTestWebhookConnection}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateTestWebhookConnectionSwr = () =>
    useSWRMutation(
        MUTATE_TEST_WEBHOOK_CONNECTION_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateTestWebhookConnection({ request: arg }), MUTATE_TEST_WEBHOOK_CONNECTION_SWR_KEY)
                .testWebhookConnection,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateTestWebhookConnectionOperation>[0]["request"]
}
