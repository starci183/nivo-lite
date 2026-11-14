import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { SaveProviderKeysMutation, SaveProviderKeysMutationVariables } from "../__generated__/graphql"

/** The input of the `saveProviderKeys` mutation. */
export type MutateSaveProviderKeysRequest = WireInput<SaveProviderKeysMutationVariables["input"]>

/** The response of the `saveProviderKeys` mutation. */
type MutateSaveProviderKeysResponse = SaveProviderKeysMutation

const mutation1: TypedDocumentNode<MutateSaveProviderKeysResponse, InputVariables<MutateSaveProviderKeysRequest>> = gql`
    mutation SaveProviderKeys($input: SaveProviderKeysInput!) {
        saveProviderKeys(input: $input) {
            confirmed
            localOnly
        }
    }
`

enum MutationSaveProviderKeys {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSaveProviderKeys,
    TypedDocumentNode<MutateSaveProviderKeysResponse, InputVariables<MutateSaveProviderKeysRequest>>
> = {
    [MutationSaveProviderKeys.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSaveProviderKeys}. */
type MutateSaveProviderKeysParams = MutateParams<MutationSaveProviderKeys, MutateSaveProviderKeysRequest>

/** Saves the keys pasted from a payment provider. */
export const mutateSaveProviderKeys = async ({
    mutation = MutationSaveProviderKeys.Mutation1,
    request,
    signal,
}: MutateSaveProviderKeysParams): Promise<ApolloClient.MutateResult<MutateSaveProviderKeysResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
