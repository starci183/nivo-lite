import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type {
    ReturnZaloAuthorizationMutation,
    ReturnZaloAuthorizationMutationVariables,
} from "../__generated__/graphql"

/** The input of the `returnZaloAuthorization` mutation. */
export type MutateReturnZaloAuthorizationRequest = WireInput<ReturnZaloAuthorizationMutationVariables["input"]>

/** The response of the `returnZaloAuthorization` mutation. */
type MutateReturnZaloAuthorizationResponse = ReturnZaloAuthorizationMutation

const mutation1: TypedDocumentNode<
    MutateReturnZaloAuthorizationResponse,
    InputVariables<MutateReturnZaloAuthorizationRequest>
> = gql`
    mutation ReturnZaloAuthorization($input: ReturnZaloAuthorizationInput!) {
        returnZaloAuthorization(input: $input) {
            id
            name
            status
            webhookUrl
            callbackUrl
            authorized
            oaSecretSaved
            oaId
            firstEvent {
                amount
                at
                content
            }
            agentIds
        }
    }
`

enum MutationReturnZaloAuthorization {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationReturnZaloAuthorization,
    TypedDocumentNode<MutateReturnZaloAuthorizationResponse, InputVariables<MutateReturnZaloAuthorizationRequest>>
> = {
    [MutationReturnZaloAuthorization.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateReturnZaloAuthorization}. */
type MutateReturnZaloAuthorizationParams = MutateParams<
    MutationReturnZaloAuthorization,
    MutateReturnZaloAuthorizationRequest
>

/** Hands the Zalo return (code and state) to the back end. */
export const mutateReturnZaloAuthorization = async ({
    mutation = MutationReturnZaloAuthorization.Mutation1,
    request,
    signal,
}: MutateReturnZaloAuthorizationParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
