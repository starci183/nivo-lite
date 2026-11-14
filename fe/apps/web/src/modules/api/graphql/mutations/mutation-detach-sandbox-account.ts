import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { DetachSandboxAccountMutation, DetachSandboxAccountMutationVariables } from "../__generated__/graphql"

/** The input of the `detachSandboxAccount` mutation. */
export type MutateDetachSandboxAccountRequest = WireInput<DetachSandboxAccountMutationVariables["input"]>

/** The response of the `detachSandboxAccount` mutation: the typed payload straight from the back end contract. */
type MutateDetachSandboxAccountResponse = DetachSandboxAccountMutation

type Document = TypedDocumentNode<MutateDetachSandboxAccountResponse, InputVariables<MutateDetachSandboxAccountRequest>>

const mutation1: Document = gql`
    mutation DetachSandboxAccount($input: SandboxAccountAgentInput!) {
        detachSandboxAccount(input: $input) {
            id
            agents {
                id
                label
            }
        }
    }
`

enum MutationDetachSandboxAccount {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationDetachSandboxAccount, Document> = { [MutationDetachSandboxAccount.Mutation1]: mutation1 }

/** Apollo params for {@link mutateDetachSandboxAccount}. */
type MutateDetachSandboxAccountParams = MutateParams<MutationDetachSandboxAccount, MutateDetachSandboxAccountRequest>

/** Takes a sandbox account away from an agent (the back end `detachSandboxAccount` mutation, owner and manager). */
export const mutateDetachSandboxAccount = async ({
    mutation = MutationDetachSandboxAccount.Mutation1,
    request,
    signal,
}: MutateDetachSandboxAccountParams): Promise<ApolloClient.MutateResult<MutateDetachSandboxAccountResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
