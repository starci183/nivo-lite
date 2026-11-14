import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { AttachSandboxAccountMutation, AttachSandboxAccountMutationVariables } from "../__generated__/graphql"

/** The input of the `attachSandboxAccount` mutation. */
export type MutateAttachSandboxAccountRequest = WireInput<AttachSandboxAccountMutationVariables["input"]>

/** The response of the `attachSandboxAccount` mutation: the typed payload straight from the back end contract. */
type MutateAttachSandboxAccountResponse = AttachSandboxAccountMutation

type Document = TypedDocumentNode<MutateAttachSandboxAccountResponse, InputVariables<MutateAttachSandboxAccountRequest>>

const mutation1: Document = gql`
    mutation AttachSandboxAccount($input: SandboxAccountAgentInput!) {
        attachSandboxAccount(input: $input) {
            id
            agents {
                id
                label
            }
        }
    }
`

enum MutationAttachSandboxAccount {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationAttachSandboxAccount, Document> = { [MutationAttachSandboxAccount.Mutation1]: mutation1 }

/** Apollo params for {@link mutateAttachSandboxAccount}. */
type MutateAttachSandboxAccountParams = MutateParams<MutationAttachSandboxAccount, MutateAttachSandboxAccountRequest>

/** Gives an existing sandbox account to an agent (the back end `attachSandboxAccount` mutation, owner and manager). */
export const mutateAttachSandboxAccount = async ({
    mutation = MutationAttachSandboxAccount.Mutation1,
    request,
    signal,
}: MutateAttachSandboxAccountParams): Promise<ApolloClient.MutateResult<MutateAttachSandboxAccountResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
