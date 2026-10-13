import { CombinedGraphQLErrors } from "@apollo/client"

/** The capability code of a GraphQL failure (`extensions.code`, for example `BOOKINGS_TAKEN`), or `undefined` for transport failures. */
export const graphQLErrorCode = (error: unknown): string | undefined => {
    if (!CombinedGraphQLErrors.is(error)) return undefined
    const code = error.errors[0]?.extensions?.code
    return typeof code === "string" ? code : undefined
}
