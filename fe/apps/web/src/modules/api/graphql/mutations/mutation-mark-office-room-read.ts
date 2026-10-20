import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { MarkOfficeRoomReadMutation, MarkOfficeRoomReadMutationVariables } from "../__generated__/graphql"

/** The input of the `markOfficeRoomRead` mutation. */
export type MutateMarkOfficeRoomReadRequest = WireInput<MarkOfficeRoomReadMutationVariables["input"]>

type MutateMarkOfficeRoomReadResponse = MarkOfficeRoomReadMutation

const mutation1: TypedDocumentNode<
    MutateMarkOfficeRoomReadResponse,
    InputVariables<MutateMarkOfficeRoomReadRequest>
> = gql`
    mutation MarkOfficeRoomRead($input: OfficeRoomKeyInput!) {
        markOfficeRoomRead(input: $input) {
            ok
        }
    }
`

enum MutationMarkOfficeRoomRead {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationMarkOfficeRoomRead,
    TypedDocumentNode<MutateMarkOfficeRoomReadResponse, InputVariables<MutateMarkOfficeRoomReadRequest>>
> = {
    [MutationMarkOfficeRoomRead.Mutation1]: mutation1,
}

/** The back end `markOfficeRoomRead` mutation. */
export const mutateMarkOfficeRoomRead = async ({
    mutation = MutationMarkOfficeRoomRead.Mutation1,
    request,
    signal,
}: MutateParams<MutationMarkOfficeRoomRead, MutateMarkOfficeRoomReadRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
