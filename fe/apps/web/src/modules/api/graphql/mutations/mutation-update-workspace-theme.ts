import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { UpdateWorkspaceThemeMutation, UpdateWorkspaceThemeMutationVariables } from "../__generated__/graphql"

/** The input of the `updateWorkspaceTheme` mutation: the six theme parameters (and the optional mode). */
export type MutateUpdateWorkspaceThemeRequest = WireInput<UpdateWorkspaceThemeMutationVariables["input"]>

type MutateUpdateWorkspaceThemeResponse = UpdateWorkspaceThemeMutation

type Document = TypedDocumentNode<MutateUpdateWorkspaceThemeResponse, InputVariables<MutateUpdateWorkspaceThemeRequest>>

const mutation1: Document = gql`
    mutation UpdateWorkspaceTheme($input: UpdateWorkspaceThemeInput!) {
        updateWorkspaceTheme(input: $input) {
            base
            chroma
            font
            hue
            lightness
            mode
            radius
        }
    }
`

enum MutationUpdateWorkspaceTheme {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationUpdateWorkspaceTheme, Document> = {
    [MutationUpdateWorkspaceTheme.Mutation1]: mutation1,
}

/** The back end `updateWorkspaceTheme` mutation: saves the brand theme of the open workspace (owner and manager). */
export const mutateUpdateWorkspaceTheme = async ({
    mutation = MutationUpdateWorkspaceTheme.Mutation1,
    request,
    signal,
}: MutateParams<MutationUpdateWorkspaceTheme, MutateUpdateWorkspaceThemeRequest>): Promise<
    ApolloClient.MutateResult<MutateUpdateWorkspaceThemeResponse>
> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
