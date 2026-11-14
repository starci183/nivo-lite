import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { ForgetContactMemoryMutation, ForgetContactMemoryMutationVariables } from "../__generated__/graphql"

/** The input of the `forgetContactMemory` mutation. */
type MutateForgetContactMemoryRequest = WireInput<ForgetContactMemoryMutationVariables["input"]>

/** The response of the `forgetContactMemory` mutation: the typed payload straight from the back end contract. */
type MutateForgetContactMemoryResponse = ForgetContactMemoryMutation

type Document = TypedDocumentNode<MutateForgetContactMemoryResponse, InputVariables<MutateForgetContactMemoryRequest>>

const mutation1: Document = gql`
    mutation ForgetContactMemory($input: ForgetContactMemoryInput!) {
        forgetContactMemory(input: $input)
    }
`

enum MutationForgetContactMemory {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationForgetContactMemory, Document> = {
    [MutationForgetContactMemory.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateForgetContactMemory}. */
type MutateForgetContactMemoryParams = MutateParams<MutationForgetContactMemory, MutateForgetContactMemoryRequest>

/** Makes the agents forget the named facts of a person (the back end `forgetContactMemory` mutation); the answer lists what was forgotten. */
export const mutateForgetContactMemory = async ({
    mutation = MutationForgetContactMemory.Mutation1,
    request,
    signal,
}: MutateForgetContactMemoryParams): Promise<ApolloClient.MutateResult<MutateForgetContactMemoryResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
