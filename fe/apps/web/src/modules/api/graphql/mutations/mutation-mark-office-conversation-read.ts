import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type {
    MarkOfficeConversationReadMutation,
    MarkOfficeConversationReadMutationVariables,
} from "../__generated__/graphql"

/** The input of the `markOfficeConversationRead` mutation. */
export type MutateMarkOfficeConversationReadRequest = WireInput<MarkOfficeConversationReadMutationVariables["input"]>

type MutateMarkOfficeConversationReadResponse = MarkOfficeConversationReadMutation

const mutation1: TypedDocumentNode<
    MutateMarkOfficeConversationReadResponse,
    InputVariables<MutateMarkOfficeConversationReadRequest>
> = gql`
    mutation MarkOfficeConversationRead($input: OfficeConversationReadInput!) {
        markOfficeConversationRead(input: $input) {
            ok
        }
    }
`

enum MutationMarkOfficeConversationRead {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationMarkOfficeConversationRead,
    TypedDocumentNode<MutateMarkOfficeConversationReadResponse, InputVariables<MutateMarkOfficeConversationReadRequest>>
> = {
    [MutationMarkOfficeConversationRead.Mutation1]: mutation1,
}

/** The back end `markOfficeConversationRead` mutation. */
export const mutateMarkOfficeConversationRead = async ({
    mutation = MutationMarkOfficeConversationRead.Mutation1,
    request,
    signal,
}: MutateParams<MutationMarkOfficeConversationRead, MutateMarkOfficeConversationReadRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
