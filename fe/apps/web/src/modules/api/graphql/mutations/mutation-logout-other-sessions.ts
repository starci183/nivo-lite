import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { MutateParams } from "../types"
import type { LogoutOtherSessionsMutation } from "../__generated__/graphql"

/** The response of the `logoutOtherSessions` mutation: the typed payload straight from the back end contract. */
type MutateLogoutOtherSessionsResponse = LogoutOtherSessionsMutation

const mutation1: TypedDocumentNode<MutateLogoutOtherSessionsResponse> = gql`
    mutation LogoutOtherSessions {
        logoutOtherSessions
    }
`

enum MutationLogoutOtherSessions {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationLogoutOtherSessions, TypedDocumentNode<MutateLogoutOtherSessionsResponse>> = {
    [MutationLogoutOtherSessions.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateLogoutOtherSessions}: no input, the bearer token names the person. */
type MutateLogoutOtherSessionsParams = Omit<MutateParams<MutationLogoutOtherSessions, undefined>, "request">

/**
 * Ends every session of the signed-in person except the one this request runs on (the back end `logoutOtherSessions`
 * mutation). Rejects with the back end failure (`CombinedGraphQLErrors`, message localized
 * by the server).
 */
export const mutateLogoutOtherSessions = async ({
    mutation = MutationLogoutOtherSessions.Mutation1,
    signal,
}: MutateLogoutOtherSessionsParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation] })
}
