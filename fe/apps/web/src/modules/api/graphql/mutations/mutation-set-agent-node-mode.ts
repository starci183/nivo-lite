import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type {
    SetAgentNodeModeMutation,
    SetAgentNodeModeMutationVariables,
} from "../__generated__/graphql"

/** The input of the `setAgentNodeMode` mutation. */
export type MutateSetAgentNodeModeRequest = WireInput<SetAgentNodeModeMutationVariables["input"]>

/** The response of the `setAgentNodeMode` mutation: the typed payload straight from the back end contract. */
type MutateSetAgentNodeModeResponse = SetAgentNodeModeMutation

type Document = TypedDocumentNode<
    MutateSetAgentNodeModeResponse,
    InputVariables<MutateSetAgentNodeModeRequest>
>

const mutation1: Document = gql`
    mutation SetAgentNodeMode($input: SetAgentNodeModeInput!) {
        setAgentNodeMode(input: $input) {
            id
            number
            changeKind
            authorKind
            authorId
            note
            templateId
            templateVersion
            fromNumber
            publishedAt
            stepCount
            changedSteps
            active
        }
    }
`

enum MutationSetAgentNodeMode {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationSetAgentNodeMode, Document> = {
    [MutationSetAgentNodeMode.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSetAgentNodeMode}. */
type MutateSetAgentNodeModeParams = MutateParams<
    MutationSetAgentNodeMode,
    MutateSetAgentNodeModeRequest
>

/** The back end `setAgentNodeMode` mutation. */
export const mutateSetAgentNodeMode = async ({
    mutation = MutationSetAgentNodeMode.Mutation1,
    request,
    signal,
}: MutateSetAgentNodeModeParams): Promise<
    ApolloClient.MutateResult<MutateSetAgentNodeModeResponse>
> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
