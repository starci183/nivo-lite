import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationDecideWorkItemArgs } from "../__generated__/schema"

/** The input of the `decideWorkItem` mutation. */
type MutateDecideWorkItemRequest = MutationDecideWorkItemArgs["input"]

/** The generated payload of the `decideWorkItem` mutation. */
type MutateDecideWorkItemResponse = Pick<Mutation, "decideWorkItem">

type Document = TypedDocumentNode<MutateDecideWorkItemResponse, InputVariables<MutateDecideWorkItemRequest>>

const mutation1: Document = gql`
    mutation DecideWorkItem($input: DecideWorkItemInput!) {
        decideWorkItem(input: $input) {
            action
            assigned_staff_id
            chain_id
            completed_at
            created_at
            decided_path
            department
            depth
            error
            evidence_state
            execution_id
            id
            inbound_event_id
            installation_id
            lead_id
            missing_fields
            origin
            parent_id
            proposal {
                amount_vnd
                candidates {
                    amount_vnd
                    id
                    label
                }
                confidence
                draft
                fields
                outcome
                summary
            }
            reason
            reasons
            result {
                href
                summary
            }
            status
            subject_id
            subject_type
            updated_at
            workspace_id
        }
    }
`

enum MutationDecideWorkItem {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationDecideWorkItem, Document> = {
    [MutationDecideWorkItem.Mutation1]: mutation1,
}

/** Apollo options for the `decideWorkItem` mutation. */
type MutateDecideWorkItemParams = MutateParams<MutationDecideWorkItem, MutateDecideWorkItemRequest> & {
    request: MutateDecideWorkItemRequest
}

/** Runs `decideWorkItem` through the authenticated back end GraphQL API. */
export const mutateDecideWorkItem = async ({
    mutation = MutationDecideWorkItem.Mutation1,
    request,
    signal,
}: MutateDecideWorkItemParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
