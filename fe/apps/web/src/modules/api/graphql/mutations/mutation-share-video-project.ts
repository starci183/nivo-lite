import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { ShareVideoProjectMutation, ShareVideoProjectMutationVariables } from "../__generated__/graphql"

/** The input of the `shareVideoProject` mutation. */
type MutateShareVideoProjectRequest = WireInput<ShareVideoProjectMutationVariables["input"]>

/** The generated payload of the `shareVideoProject` mutation. */
type MutateShareVideoProjectResponse = ShareVideoProjectMutation

type Document = TypedDocumentNode<MutateShareVideoProjectResponse, InputVariables<MutateShareVideoProjectRequest>>

const mutation1: Document = gql`
    mutation ShareVideoProject($input: ShareVideoProjectInput!) {
        shareVideoProject(input: $input) {
            office
            telegram
        }
    }
`

enum MutationShareVideoProject {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationShareVideoProject, Document> = {
    [MutationShareVideoProject.Mutation1]: mutation1,
}

/** Apollo options for the `shareVideoProject` mutation. */
type MutateShareVideoProjectParams = MutateParams<MutationShareVideoProject, MutateShareVideoProjectRequest>

/** Calls `shareVideoProject` through the authenticated back end GraphQL API. */
export const mutateShareVideoProject = async ({
    mutation = MutationShareVideoProject.Mutation1,
    request,
    signal,
}: MutateShareVideoProjectParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
