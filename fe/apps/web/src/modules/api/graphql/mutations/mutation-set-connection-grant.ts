import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { SetConnectionGrantMutation, SetConnectionGrantMutationVariables } from "../__generated__/graphql"

/** The input of the `setConnectionGrant` mutation. */
type MutateSetConnectionGrantRequest = WireInput<SetConnectionGrantMutationVariables["input"]>

/** The response of the `setConnectionGrant` mutation. */
type MutateSetConnectionGrantResponse = SetConnectionGrantMutation

const mutation1: TypedDocumentNode<
    MutateSetConnectionGrantResponse,
    InputVariables<MutateSetConnectionGrantRequest>
> = gql`
    mutation SetConnectionGrant($input: SetConnectionGrantInput!) {
        setConnectionGrant(input: $input)
    }
`

enum MutationSetConnectionGrant {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSetConnectionGrant,
    TypedDocumentNode<MutateSetConnectionGrantResponse, InputVariables<MutateSetConnectionGrantRequest>>
> = {
    [MutationSetConnectionGrant.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSetConnectionGrant}. */
type MutateSetConnectionGrantParams = MutateParams<MutationSetConnectionGrant, MutateSetConnectionGrantRequest>

/** Binds one agent to a connection, or unbinds it. */
export const mutateSetConnectionGrant = async ({
    mutation = MutationSetConnectionGrant.Mutation1,
    request,
    signal,
}: MutateSetConnectionGrantParams): Promise<ApolloClient.MutateResult<MutateSetConnectionGrantResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
