import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SaveContentPillarsMutation, SaveContentPillarsMutationVariables } from "../__generated__/graphql"

/** The generated input of saveContentPillars. */
type MutateSaveContentPillarsRequest = WireInput<SaveContentPillarsMutationVariables["input"]>

/** The generated response of saveContentPillars. */
type MutateSaveContentPillarsResponse = SaveContentPillarsMutation

type Document = TypedDocumentNode<MutateSaveContentPillarsResponse, InputVariables<MutateSaveContentPillarsRequest>>

const mutation1: Document = gql`
    mutation SaveContentPillars($input: SaveContentPillarsInput!) {
        saveContentPillars(input: $input) {
            count
        }
    }
`

enum MutationSaveContentPillars {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationSaveContentPillars, Document> = {
    [MutationSaveContentPillars.Mutation1]: mutation1,
}

/** Apollo options for saveContentPillars. */
type MutateSaveContentPillarsParams = MutateParams<MutationSaveContentPillars, MutateSaveContentPillarsRequest>

/** saveContentPillars in the selected workspace, authorized by the back end. */
export const mutateSaveContentPillars = async ({
    mutation = MutationSaveContentPillars.Mutation1,
    request,
    signal,
}: MutateSaveContentPillarsParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
