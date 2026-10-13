import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { RevokeSessionMutation, RevokeSessionMutationVariables } from "../__generated__/graphql"

/** The input of the `revokeSession` mutation. */
type MutateRevokeSessionRequest = WireInput<RevokeSessionMutationVariables["input"]>

/** The response of the `revokeSession` mutation: the typed payload straight from the back end contract. */
type MutateRevokeSessionResponse = RevokeSessionMutation

type Document = TypedDocumentNode<MutateRevokeSessionResponse, InputVariables<MutateRevokeSessionRequest>>

const mutation1: Document = gql`
    mutation RevokeSession($input: RevokeSessionInput!) {
        revokeSession(input: $input)
    }
`

enum MutationRevokeSession {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationRevokeSession, Document> = {
    [MutationRevokeSession.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRevokeSession}. */
type MutateRevokeSessionParams = MutateParams<MutationRevokeSession, MutateRevokeSessionRequest>

/** Signs another device of the account out (the back end `revokeSession` mutation). */
export const mutateRevokeSession = async ({
    mutation = MutationRevokeSession.Mutation1,
    request,
    signal,
}: MutateRevokeSessionParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
