import type { ApolloClient } from "@apollo/client"

/**
 * Default Apollo policies: never serve a stale cache entry (SWR owns caching), and let a failed operation throw so a hook or a
 * toast helper sees it. The back end reports failures as `errors[]` with `extensions.{code,kind}`.
 */
export const defaultOptions: ApolloClient.DefaultOptions = {
    watchQuery: {
        fetchPolicy: "no-cache",
    },
    query: {
        fetchPolicy: "no-cache",
    },
    mutate: {
        fetchPolicy: "no-cache",
    },
}
