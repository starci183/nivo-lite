import { useGraphQLMutationSwr } from "@/hooks/reuseables"
import { mutateTestWebhookConnection } from "@/modules/api/graphql/mutations/mutation-test-webhook-connection"

/** The SWR key of the testWebhookConnection mutation. */
export const MUTATE_TEST_WEBHOOK_CONNECTION_SWR_KEY = "MUTATE_TEST_WEBHOOK_CONNECTION_SWR"

/** SWR mutation for {@link mutateTestWebhookConnection}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateTestWebhookConnectionSwr = () =>
    useGraphQLMutationSwr(
        MUTATE_TEST_WEBHOOK_CONNECTION_SWR_KEY,
        mutateTestWebhookConnection,
        (data) => data.testWebhookConnection,
    )
