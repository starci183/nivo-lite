import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SaveContentCadenceMutation, SaveContentCadenceMutationVariables } from "../__generated__/graphql"

/** The generated input of saveContentCadence. */
type MutateSaveContentCadenceRequest = WireInput<SaveContentCadenceMutationVariables["input"]>

/** The generated response of saveContentCadence. */
type MutateSaveContentCadenceResponse = SaveContentCadenceMutation

type Document = TypedDocumentNode<MutateSaveContentCadenceResponse, InputVariables<MutateSaveContentCadenceRequest>>

const mutation1: Document = gql`
    mutation SaveContentCadence($input: SaveContentCadenceInput!) {
        saveContentCadence(input: $input) {
            count
        }
    }
`

enum MutationSaveContentCadence {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationSaveContentCadence, Document> = {
    [MutationSaveContentCadence.Mutation1]: mutation1,
}

/** Apollo options for saveContentCadence. */
type MutateSaveContentCadenceParams = MutateParams<MutationSaveContentCadence, MutateSaveContentCadenceRequest>

/** saveContentCadence in the selected workspace, authorized by the back end. */
export const mutateSaveContentCadence = async ({
    mutation = MutationSaveContentCadence.Mutation1,
    request,
    signal,
}: MutateSaveContentCadenceParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
