import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationSaveContentPillarsArgs } from "../__generated__/schema"

/** The generated input of saveContentPillars. */
export type MutateSaveContentPillarsRequest = MutationSaveContentPillarsArgs["input"]

/** The generated response of saveContentPillars. */
type MutateSaveContentPillarsResponse = Pick<Mutation, "saveContentPillars">

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
