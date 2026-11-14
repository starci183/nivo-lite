import { RetryLink } from "@apollo/client/link/retry"

/** The transport tuning of the retry link: the backoff (milliseconds) and the attempts. */
export interface RetryTuning {
    readonly retryInitialDelayMs: number
    readonly retryMaxDelayMs: number
    readonly retryMaxAttempts: number
}

/**
 * Retries failed operations with jittered exponential backoff. Placed first in the chain so transient network errors are
 * retried before any other link sees the failure. A GraphQL error answer (`errors[]`) is a result, not a network error, and
 * is not retried.
 *
 * @see {@link https://www.apollographql.com/docs/react/api/link/apollo-link-retry | RetryLink API}
 */
export const createRetryLink = (tuning: RetryTuning): RetryLink =>
    new RetryLink({
        delay: { initial: tuning.retryInitialDelayMs, max: tuning.retryMaxDelayMs, jitter: true },
        attempts: { max: tuning.retryMaxAttempts, retryIf: (error) => !!error },
    })
