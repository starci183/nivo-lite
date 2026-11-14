import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type MutateParams } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { StartFirstWorkspaceMutation } from "../__generated__/graphql"

/** The generated response of startFirstWorkspace. */
type MutateStartFirstWorkspaceResponse = StartFirstWorkspaceMutation

type Document = TypedDocumentNode<MutateStartFirstWorkspaceResponse>

const mutation1: Document = gql`
    mutation StartFirstWorkspace {
        startFirstWorkspace {
            id
        }
    }
`

enum MutationStartFirstWorkspace {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationStartFirstWorkspace, Document> = {
    [MutationStartFirstWorkspace.Mutation1]: mutation1,
}

/** Apollo options for startFirstWorkspace. */
type MutateStartFirstWorkspaceParams = Omit<MutateParams<MutationStartFirstWorkspace, never>, "request">

/** The signed-in person's first workspace where free signup is allowed and they have none (the back end `startFirstWorkspace` mutation); a null id when none was created. */
export const mutateStartFirstWorkspace = async ({
    mutation = MutationStartFirstWorkspace.Mutation1,
    signal,
}: MutateStartFirstWorkspaceParams = {}): Promise<ApolloClient.MutateResult<MutateStartFirstWorkspaceResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
    })
}
