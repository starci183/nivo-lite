import { CombinedGraphQLErrors } from "@apollo/client"

/** True when the failure of a GraphQL operation is the back end refusal of a missing or expired session (`extensions.kind` is `unauthenticated`). */
export const isUnauthenticatedFailure = (error: unknown): boolean =>
    CombinedGraphQLErrors.is(error) && error.errors.some((failure) => failure.extensions?.kind === "unauthenticated")

/** True when the back end refused because the caller may not do this (`extensions.kind` is `forbidden`). */
export const isForbiddenFailure = (error: unknown): boolean =>
    CombinedGraphQLErrors.is(error) && error.errors.some((failure) => failure.extensions?.kind === "forbidden")

/** True when the back end refused with a not-found (an unknown workspace, or a caller the console does not exist for; `extensions.kind` is `not-found`). */
export const isNotFoundFailure = (error: unknown): boolean =>
    CombinedGraphQLErrors.is(error) && error.errors.some((failure) => failure.extensions?.kind === "not-found")
