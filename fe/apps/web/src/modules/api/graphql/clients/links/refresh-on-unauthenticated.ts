import { ApolloLink, Observable } from "@apollo/client"
import { renewSessionToken } from "@/modules/auth"

/** True when a result carries the back end refusal of a missing or expired session (`extensions.kind` is `unauthenticated`). */
const isUnauthenticated = (result: ApolloLink.Result): boolean =>
    result.errors?.some((failure) => failure.extensions?.kind === "unauthenticated") === true

/** Parameters of the refresh link. */
export interface CreateRefreshOnUnauthenticatedLinkParams {
    /** Refreshes the session and answers the new token; defaults to `POST /auth/refresh`. */
    refresh?: () => Promise<string | undefined>
}

/** Keeps retry and cancellation state local to one operation subscription. */
const refreshOperation = (
    operation: ApolloLink.Operation,
    forward: ApolloLink.ForwardFunction,
    refresh: () => Promise<string | undefined>,
): Observable<ApolloLink.Result> =>
    new Observable((observer) => {
        let subscription: { unsubscribe: () => void } | undefined
        let cancelled = false
        const send = (retried: boolean): void => {
            let awaitingRetry = false
            subscription = forward(operation).subscribe({
                next: (result) => {
                    if (retried || !isUnauthenticated(result)) {
                        observer.next(result)
                        return
                    }
                    awaitingRetry = true
                    void refresh().then((token) => {
                        if (cancelled) return
                        if (token === undefined) {
                            observer.next(result)
                            observer.complete()
                            return
                        }
                        send(true)
                    })
                },
                error: (error) => observer.error(error),
                complete: () => {
                    if (!awaitingRetry) observer.complete()
                },
            })
        }
        send(false)
        return () => {
            cancelled = true
            subscription?.unsubscribe()
        }
    })

/**
 * On an `unauthenticated` answer, refreshes the session once and sends the same operation again; the access-token
 * link below it then attaches the new token. When the refresh yields no session, the original answer goes through so the
 * caller sees the refusal.
 */
export const createRefreshOnUnauthenticatedLink = ({
    refresh = renewSessionToken,
}: CreateRefreshOnUnauthenticatedLinkParams = {}) =>
    new ApolloLink((operation, forward) => refreshOperation(operation, forward, refresh))
