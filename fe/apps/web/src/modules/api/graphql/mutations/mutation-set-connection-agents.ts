import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { SetConnectionAgentsMutation, SetConnectionAgentsMutationVariables } from "../__generated__/graphql"

/** The input of the `setConnectionAgents` mutation. */
type MutateSetConnectionAgentsRequest = WireInput<SetConnectionAgentsMutationVariables["input"]>

/** The response of the `setConnectionAgents` mutation. */
type MutateSetConnectionAgentsResponse = SetConnectionAgentsMutation

const mutation1: TypedDocumentNode<
    MutateSetConnectionAgentsResponse,
    InputVariables<MutateSetConnectionAgentsRequest>
> = gql`
    mutation SetConnectionAgents($input: SetConnectionAgentsInput!) {
        setConnectionAgents(input: $input)
    }
`

enum MutationSetConnectionAgents {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSetConnectionAgents,
    TypedDocumentNode<MutateSetConnectionAgentsResponse, InputVariables<MutateSetConnectionAgentsRequest>>
> = {
    [MutationSetConnectionAgents.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSetConnectionAgents}. */
type MutateSetConnectionAgentsParams = MutateParams<MutationSetConnectionAgents, MutateSetConnectionAgentsRequest>

/** Sets exactly which agents work through a connection. */
export const mutateSetConnectionAgents = async ({
    mutation = MutationSetConnectionAgents.Mutation1,
    request,
    signal,
}: MutateSetConnectionAgentsParams): Promise<ApolloClient.MutateResult<MutateSetConnectionAgentsResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
