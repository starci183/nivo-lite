import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type MutateParams } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { ResetSandboxAccountMutation, ResetSandboxAccountMutationVariables } from "../__generated__/graphql"

/** The variables of the `resetSandboxAccount` mutation. */
export type MutateResetSandboxAccountRequest = ResetSandboxAccountMutationVariables

/** The response of the `resetSandboxAccount` mutation: the typed payload straight from the back end contract. */
type MutateResetSandboxAccountResponse = ResetSandboxAccountMutation

type Document = TypedDocumentNode<MutateResetSandboxAccountResponse, ResetSandboxAccountMutationVariables>

const mutation1: Document = gql`
    mutation ResetSandboxAccount($connectionId: ID!) {
        resetSandboxAccount(connectionId: $connectionId)
    }
`

enum MutationResetSandboxAccount {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationResetSandboxAccount, Document> = { [MutationResetSandboxAccount.Mutation1]: mutation1 }

/** Apollo params for {@link mutateResetSandboxAccount}. */
type MutateResetSandboxAccountParams = MutateParams<MutationResetSandboxAccount, MutateResetSandboxAccountRequest>

/** Clears the call log and the state of a sandbox account (the back end `resetSandboxAccount` mutation, owner and manager). */
export const mutateResetSandboxAccount = async ({
    mutation = MutationResetSandboxAccount.Mutation1,
    request,
    signal,
}: MutateResetSandboxAccountParams): Promise<ApolloClient.MutateResult<MutateResetSandboxAccountResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: request })
}
