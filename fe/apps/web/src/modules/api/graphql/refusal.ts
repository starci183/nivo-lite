import { CombinedGraphQLErrors } from "@apollo/client"

/** Whether the back end refused the operation itself (not allowed, or an input it does not accept) rather than failing to answer. */
export const isRefusedByBackend = (error: unknown): boolean =>
    CombinedGraphQLErrors.is(error) &&
    error.errors.some((failure) => failure.extensions?.kind === "forbidden" || failure.extensions?.kind === "invalid")
