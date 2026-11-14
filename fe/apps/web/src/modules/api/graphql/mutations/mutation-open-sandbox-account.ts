import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { OpenSandboxAccountMutation, OpenSandboxAccountMutationVariables } from "../__generated__/graphql"

/** The input of the `openSandboxAccount` mutation. */
export type MutateOpenSandboxAccountRequest = WireInput<OpenSandboxAccountMutationVariables["input"]>

/** The response of the `openSandboxAccount` mutation: the typed payload straight from the back end contract. */
type MutateOpenSandboxAccountResponse = OpenSandboxAccountMutation

type Document = TypedDocumentNode<MutateOpenSandboxAccountResponse, InputVariables<MutateOpenSandboxAccountRequest>>

const mutation1: Document = gql`
    mutation OpenSandboxAccount($input: OpenSandboxAccountInput!) {
        openSandboxAccount(input: $input) {
            id
            sandboxKey
        }
    }
`

enum MutationOpenSandboxAccount {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationOpenSandboxAccount, Document> = { [MutationOpenSandboxAccount.Mutation1]: mutation1 }

/** Apollo params for {@link mutateOpenSandboxAccount}. */
type MutateOpenSandboxAccountParams = MutateParams<MutationOpenSandboxAccount, MutateOpenSandboxAccountRequest>

/** Opens a sandbox account of a provider (the back end `openSandboxAccount` mutation, owner and manager). */
export const mutateOpenSandboxAccount = async ({
    mutation = MutationOpenSandboxAccount.Mutation1,
    request,
    signal,
}: MutateOpenSandboxAccountParams): Promise<ApolloClient.MutateResult<MutateOpenSandboxAccountResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
