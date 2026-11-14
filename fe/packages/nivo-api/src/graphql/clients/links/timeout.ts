import { ApolloLink, Observable } from "@apollo/client"

/** The window of the timeout link, in milliseconds. */
export interface TimeoutTuning {
    readonly timeoutMs: number
}

/**
 * Fails the operation when the downstream observable does not finish within the configured window. Placed after the error
 * link and before the HTTP link so upstream links still receive the timeout error.
 */
export const createTimeoutLink = (tuning: TimeoutTuning): ApolloLink =>
    new ApolloLink(
        (operation, forward) =>
            new Observable((observer) => {
                const timer = setTimeout(() => {
                    observer.error(new Error(`GraphQL request timed out after ${tuning.timeoutMs}ms`))
                }, tuning.timeoutMs)
                const subscription = forward(operation).subscribe({
                    next: (value) => observer.next(value),
                    error: (error) => {
                        clearTimeout(timer)
                        observer.error(error)
                    },
                    complete: () => {
                        clearTimeout(timer)
                        observer.complete()
                    },
                })
                return () => {
                    clearTimeout(timer)
                    subscription.unsubscribe()
                }
            }),
    )
