import { CombinedGraphQLErrors } from "@apollo/client"

/** True when the failure of a GraphQL operation is the back end refusal of a missing or expired session (`extensions.kind` is `unauthenticated`). */
export const isUnauthenticatedFailure = (error: unknown): boolean =>
    CombinedGraphQLErrors.is(error) && error.errors.some((failure) => failure.extensions?.kind === "unauthenticated")
