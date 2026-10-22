import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { DecideThreadApprovalMutation, DecideThreadApprovalMutationVariables } from "../__generated__/graphql"

/** The input of the `decideThreadApproval` mutation. */
export type MutateDecideThreadApprovalRequest = WireInput<DecideThreadApprovalMutationVariables["input"]>

type MutateDecideThreadApprovalResponse = DecideThreadApprovalMutation

const mutation1: TypedDocumentNode<
    MutateDecideThreadApprovalResponse,
    InputVariables<MutateDecideThreadApprovalRequest>
> = gql`
    mutation DecideThreadApproval($input: DecideThreadApprovalInput!) {
        decideThreadApproval(input: $input) {
            id
            threadId
            authorKind
            authorId
            authorName
            authorRole
            body
            quoted
            mentions {
                kind
                id
                name
            }
            approval {
                requestId
                action
                amount
                unit
                rule
                policy
                expiresAt
                outcome
                decidedBy
                decidedByName
                decidedAt
                approvers {
                    memberId
                    name
                    role
                    roomId
                    status
                }
                excluded {
                    memberId
                    name
                    reason
                }
                owner {
                    kind
                    id
                    name
                }
            }
            createdAt
        }
    }
`

enum MutationDecideThreadApproval {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationDecideThreadApproval,
    TypedDocumentNode<MutateDecideThreadApprovalResponse, InputVariables<MutateDecideThreadApprovalRequest>>
> = {
    [MutationDecideThreadApproval.Mutation1]: mutation1,
}

/** The back end `decideThreadApproval` mutation: approves or rejects the card of a message. */
export const mutateDecideThreadApproval = async ({
    mutation = MutationDecideThreadApproval.Mutation1,
    request,
    signal,
}: MutateParams<MutationDecideThreadApproval, MutateDecideThreadApprovalRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
