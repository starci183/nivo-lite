import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SaveVideoBrandMutation, SaveVideoBrandMutationVariables } from "../__generated__/graphql"

/** The input of the `saveVideoBrand` mutation. */
type MutateSaveVideoBrandRequest = WireInput<SaveVideoBrandMutationVariables["input"]>

/** The generated payload of the `saveVideoBrand` mutation. */
type MutateSaveVideoBrandResponse = SaveVideoBrandMutation

type Document = TypedDocumentNode<MutateSaveVideoBrandResponse, InputVariables<MutateSaveVideoBrandRequest>>

const mutation1: Document = gql`
    mutation SaveVideoBrand($input: SaveVideoBrandInput!) {
        saveVideoBrand(input: $input) {
            logoPath
            musicTrack
            primary
            secondary
            shopName
            voice
        }
    }
`

enum MutationSaveVideoBrand {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationSaveVideoBrand, Document> = {
    [MutationSaveVideoBrand.Mutation1]: mutation1,
}

/** Apollo options for the `saveVideoBrand` mutation. */
type MutateSaveVideoBrandParams = MutateParams<MutationSaveVideoBrand, MutateSaveVideoBrandRequest>

/** Calls `saveVideoBrand` through the authenticated back end GraphQL API. */
export const mutateSaveVideoBrand = async ({
    mutation = MutationSaveVideoBrand.Mutation1,
    request,
    signal,
}: MutateSaveVideoBrandParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
