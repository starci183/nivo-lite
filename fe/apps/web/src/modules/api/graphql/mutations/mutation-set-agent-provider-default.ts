import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { SetAgentProviderDefaultMutation, SetAgentProviderDefaultMutationVariables } from "../__generated__/graphql"

/** The input of the `setAgentProviderDefault` mutation. */
export type MutateSetAgentProviderDefaultRequest = WireInput<SetAgentProviderDefaultMutationVariables["input"]>

/** The response of the `setAgentProviderDefault` mutation: the typed payload straight from the back end contract. */
type MutateSetAgentProviderDefaultResponse = SetAgentProviderDefaultMutation

type Document = TypedDocumentNode<
    MutateSetAgentProviderDefaultResponse,
    InputVariables<MutateSetAgentProviderDefaultRequest>
>

const mutation1: Document = gql`
    mutation SetAgentProviderDefault($input: SetAgentProviderDefaultInput!) {
        setAgentProviderDefault(input: $input)
    }
`

enum MutationSetAgentProviderDefault {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationSetAgentProviderDefault, Document> = {
    [MutationSetAgentProviderDefault.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSetAgentProviderDefault}. */
type MutateSetAgentProviderDefaultParams = MutateParams<
    MutationSetAgentProviderDefault,
    MutateSetAgentProviderDefaultRequest
>

/** Makes an account the one an agent uses by default among its accounts of one provider (the back end `setAgentProviderDefault` mutation). */
export const mutateSetAgentProviderDefault = async ({
    mutation = MutationSetAgentProviderDefault.Mutation1,
    request,
    signal,
}: MutateSetAgentProviderDefaultParams): Promise<ApolloClient.MutateResult<MutateSetAgentProviderDefaultResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
