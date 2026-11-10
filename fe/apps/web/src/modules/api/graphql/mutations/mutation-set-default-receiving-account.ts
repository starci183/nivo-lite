import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type {
    SetDefaultReceivingAccountMutation,
    SetDefaultReceivingAccountMutationVariables,
} from "../__generated__/graphql"

/** The input of the `setDefaultReceivingAccount` mutation. */
export type MutateSetDefaultReceivingAccountRequest = WireInput<SetDefaultReceivingAccountMutationVariables["input"]>

/** The response of the `setDefaultReceivingAccount` mutation. */
type MutateSetDefaultReceivingAccountResponse = SetDefaultReceivingAccountMutation

type Document = TypedDocumentNode<
    MutateSetDefaultReceivingAccountResponse,
    InputVariables<MutateSetDefaultReceivingAccountRequest>
>

const mutation1: Document = gql`
    mutation SetDefaultReceivingAccount($input: SetDefaultReceivingAccountInput!) {
        setDefaultReceivingAccount(input: $input)
    }
`

enum MutateSetDefaultReceivingAccountDocument {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutateSetDefaultReceivingAccountDocument, Document> = {
    [MutateSetDefaultReceivingAccountDocument.Mutation1]: mutation1,
}

type MutateSetDefaultReceivingAccountParams = MutateParams<
    MutateSetDefaultReceivingAccountDocument,
    MutateSetDefaultReceivingAccountRequest
>

/** Makes one connected payment account the shop's default receiving account, where every payment QR goes (owner only). Rejects with the back end failure. */
export const mutateSetDefaultReceivingAccount = async ({
    mutation = MutateSetDefaultReceivingAccountDocument.Mutation1,
    request,
    signal,
}: MutateSetDefaultReceivingAccountParams): Promise<
    ApolloClient.MutateResult<MutateSetDefaultReceivingAccountResponse>
> => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
