import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationPostOfficeMessageArgs } from "../__generated__/schema"

/** The input of the `postOfficeMessage` mutation. */
export type MutatePostOfficeMessageRequest = MutationPostOfficeMessageArgs["input"]

type MutatePostOfficeMessageResponse = Pick<Mutation, "postOfficeMessage">

const mutation1: TypedDocumentNode<
    MutatePostOfficeMessageResponse,
    InputVariables<MutatePostOfficeMessageRequest>
> = gql`
    mutation PostOfficeMessage($input: PostOfficeMessageInput!) {
        postOfficeMessage(input: $input) {
            agent_id
            author_kind
            author_name
            body
            created_at
            id
            lead_id
            staff_id
            work_item_id
        }
    }
`

enum MutationPostOfficeMessage {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationPostOfficeMessage,
    TypedDocumentNode<MutatePostOfficeMessageResponse, InputVariables<MutatePostOfficeMessageRequest>>
> = {
    [MutationPostOfficeMessage.Mutation1]: mutation1,
}

/** The back end `postOfficeMessage` mutation. */
export const mutatePostOfficeMessage = async ({
    mutation = MutationPostOfficeMessage.Mutation1,
    request,
    signal,
}: MutateParams<MutationPostOfficeMessage, MutatePostOfficeMessageRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
