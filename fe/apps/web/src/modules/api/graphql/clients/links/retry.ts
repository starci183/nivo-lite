import { RetryLink } from "@apollo/client/link/retry"
import { graphqlTuning } from "@/modules/config"

/**
 * Retries failed operations with jittered exponential backoff. Placed first in the chain so transient network errors are
 * retried before any other link sees the failure. A GraphQL error answer (`errors[]`) is a result, not a network error, and
 * is not retried.
 *
 * @see {@link https://www.apollographql.com/docs/react/api/link/apollo-link-retry | RetryLink API}
 */
export const createRetryLink = () =>
    new RetryLink({
        delay: { initial: graphqlTuning.retryInitialDelayMs, max: graphqlTuning.retryMaxDelayMs, jitter: true },
        attempts: { max: graphqlTuning.retryMaxAttempts, retryIf: (error) => !!error },
    })
