import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SaveZnsRenewalMutation, SaveZnsRenewalMutationVariables } from "../__generated__/graphql"

/** The input of the `saveZnsRenewal` mutation. */
type MutateSaveZnsRenewalRequest = WireInput<SaveZnsRenewalMutationVariables["input"]>

/** The response of the `saveZnsRenewal` mutation. */
type MutateSaveZnsRenewalResponse = SaveZnsRenewalMutation

const mutation1: TypedDocumentNode<MutateSaveZnsRenewalResponse, InputVariables<MutateSaveZnsRenewalRequest>> = gql`
    mutation SaveZnsRenewal($input: SaveZnsRenewalInput!) {
        saveZnsRenewal(input: $input) {
            templateId
            params {
                customerName
                plan
                endDate
                amount
                transferContent
                invoiceNumber
            }
        }
    }
`

enum MutationSaveZnsRenewal {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSaveZnsRenewal,
    TypedDocumentNode<MutateSaveZnsRenewalResponse, InputVariables<MutateSaveZnsRenewalRequest>>
> = {
    [MutationSaveZnsRenewal.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSaveZnsRenewal}. */
type MutateSaveZnsRenewalParams = MutateParams<MutationSaveZnsRenewal, MutateSaveZnsRenewalRequest>

/** Stores the ZNS renewal template of a Zalo connection. Rejects with the back end failure. */
export const mutateSaveZnsRenewal = async ({
    mutation = MutationSaveZnsRenewal.Mutation1,
    request,
    signal,
}: MutateSaveZnsRenewalParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
