/** The GraphQL error fields consumed by the failure readers. */
interface GraphQLFailure {
    readonly message: string
    readonly extensions?: Record<string, unknown>
}

/** The public shape of an Apollo combined GraphQL error. */
interface CombinedGraphQLFailure {
    readonly name: "CombinedGraphQLErrors"
    readonly errors: readonly GraphQLFailure[]
}

/** Narrows unknown wire values without depending on the transport library. */
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null

/** Accepts GraphQL errors with a message and optional extension fields. */
const isGraphQLFailure = (value: unknown): value is GraphQLFailure =>
    isRecord(value) &&
    typeof value.message === "string" &&
    (value.extensions === undefined || isRecord(value.extensions))

/** Recognizes the public combined-error shape, including real Apollo-created errors. */
const isCombinedGraphQLFailure = (error: unknown): error is CombinedGraphQLFailure =>
    isRecord(error) &&
    error.name === "CombinedGraphQLErrors" &&
    Array.isArray(error.errors) &&
    error.errors.every(isGraphQLFailure)

/** The capability code of a GraphQL failure (`extensions.code`, for example `BOOKINGS_TAKEN`), or `undefined` for transport failures. */
export const graphQLErrorCode = (error: unknown): string | undefined => {
    if (!isCombinedGraphQLFailure(error)) return undefined
    const code = error.errors[0]?.extensions?.code
    return typeof code === "string" ? code : undefined
}

/** True when the failure of a GraphQL operation is the back end refusal of a missing or expired session (`extensions.kind` is `unauthenticated`). */
export const isUnauthenticatedFailure = (error: unknown): boolean =>
    isCombinedGraphQLFailure(error) && error.errors.some((failure) => failure.extensions?.kind === "unauthenticated")

/** True when the back end refused because the caller may not do this (`extensions.kind` is `forbidden`). */
export const isForbiddenFailure = (error: unknown): boolean =>
    isCombinedGraphQLFailure(error) && error.errors.some((failure) => failure.extensions?.kind === "forbidden")

/** True when the back end refused with a not-found (an unknown workspace, or a caller the console does not exist for; `extensions.kind` is `not-found`). */
export const isNotFoundFailure = (error: unknown): boolean =>
    isCombinedGraphQLFailure(error) && error.errors.some((failure) => failure.extensions?.kind === "not-found")

/** True when the back end refused an input it does not accept (`extensions.kind` is `invalid`): an id that is no id at all. */
export const isInvalidFailure = (error: unknown): boolean =>
    isCombinedGraphQLFailure(error) && error.errors.some((failure) => failure.extensions?.kind === "invalid")

/** Whether the back end refused the operation itself (not allowed, or an input it does not accept) rather than failing to answer. */
export const isRefusedByBackend = (error: unknown): boolean =>
    isCombinedGraphQLFailure(error) &&
    error.errors.some((failure) => failure.extensions?.kind === "forbidden" || failure.extensions?.kind === "invalid")
