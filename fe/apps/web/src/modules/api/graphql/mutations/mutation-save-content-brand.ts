import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SaveContentBrandMutation, SaveContentBrandMutationVariables } from "../__generated__/graphql"

/** The generated input of saveContentBrand. */
type MutateSaveContentBrandRequest = WireInput<SaveContentBrandMutationVariables["input"]>

/** The generated response of saveContentBrand. */
type MutateSaveContentBrandResponse = SaveContentBrandMutation

type Document = TypedDocumentNode<MutateSaveContentBrandResponse, InputVariables<MutateSaveContentBrandRequest>>

const mutation1: Document = gql`
    mutation SaveContentBrand($input: SaveContentBrandInput!) {
        saveContentBrand(input: $input) {
            workspaceId
            brandVoice
            avoid
            cta
            hashtags
            automations {
                todayReminder
                offerDraft
                weeklySummary
            }
            marks {
                key
                value
            }
        }
    }
`

enum MutationSaveContentBrand {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationSaveContentBrand, Document> = {
    [MutationSaveContentBrand.Mutation1]: mutation1,
}

/** Apollo options for saveContentBrand. */
type MutateSaveContentBrandParams = MutateParams<MutationSaveContentBrand, MutateSaveContentBrandRequest>

/** saveContentBrand in the selected workspace, authorized by the back end. */
export const mutateSaveContentBrand = async ({
    mutation = MutationSaveContentBrand.Mutation1,
    request,
    signal,
}: MutateSaveContentBrandParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
