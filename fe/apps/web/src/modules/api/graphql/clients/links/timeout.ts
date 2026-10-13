import { ApolloLink, Observable } from "@apollo/client"
import { graphqlTuning } from "@/modules/config"

/**
 * Fails the operation when the downstream observable does not finish within the configured window. Placed after the error
 * link and before the HTTP link so upstream links still receive the timeout error.
 */
export const createTimeoutLink = () =>
    new ApolloLink(
        (operation, forward) =>
            new Observable((observer) => {
                const timer = setTimeout(() => {
                    observer.error(new Error(`GraphQL request timed out after ${graphqlTuning.timeoutMs}ms`))
                }, graphqlTuning.timeoutMs)
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
