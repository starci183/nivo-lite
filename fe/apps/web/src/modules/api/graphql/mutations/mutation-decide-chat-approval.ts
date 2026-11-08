import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { DecideChatApprovalMutation, DecideChatApprovalMutationVariables } from "../__generated__/graphql"

/** Generated input of the DecideChatApproval mutation. */
type MutateDecideChatApprovalRequest = WireInput<DecideChatApprovalMutationVariables["input"]>

type MutateDecideChatApprovalResponse = DecideChatApprovalMutation

type Document = TypedDocumentNode<MutateDecideChatApprovalResponse, InputVariables<MutateDecideChatApprovalRequest>>

const mutation1: Document = gql`
    mutation DecideChatApproval($input: DecideChatApprovalInput!) {
        decideChatApproval(input: $input) {
            approval {
                decisionId
                status
                decidedByName
                decidedAt
                canDecide
            }
            refusal
        }
    }
`

enum MutationDecideChatApproval {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationDecideChatApproval, Document> = { [MutationDecideChatApproval.Mutation1]: mutation1 }

/** Parameters of the DecideChatApproval mutation. */
type MutateDecideChatApprovalParams = MutateParams<MutationDecideChatApproval, MutateDecideChatApprovalRequest>

/** Settles one decision from its card as the caller's seat; every card of that decision reads the outcome. */
export const mutateDecideChatApproval = async ({
    mutation = MutationDecideChatApproval.Mutation1,
    request,
    signal,
    headers,
}: MutateDecideChatApprovalParams): Promise<ApolloClient.MutateResult<MutateDecideChatApprovalResponse>> => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
        context: { headers },
    })
}
