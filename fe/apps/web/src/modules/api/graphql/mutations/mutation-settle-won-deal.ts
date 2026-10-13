import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationSettleWonDealArgs } from "../__generated__/schema"

/** Generated input of the settleWonDeal mutation. */
export type MutateSettleWonDealRequest = MutationSettleWonDealArgs["input"]

/** Generated response of the settleWonDeal mutation. */
type MutateSettleWonDealResponse = Pick<Mutation, "settleWonDeal">

type Document = TypedDocumentNode<MutateSettleWonDealResponse, InputVariables<MutateSettleWonDealRequest>>

const mutation1: Document = gql`
    mutation SettleWonDeal($input: SettleWonDealInput!) {
        settleWonDeal(input: $input) {
            id
            status
        }
    }
`

enum MutationSettleWonDeal {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationSettleWonDeal, Document> = {
    [MutationSettleWonDeal.Mutation1]: mutation1,
}

/** Apollo parameters for the settleWonDeal mutation. */
type MutateSettleWonDealParams = MutateParams<MutationSettleWonDeal, MutateSettleWonDealRequest>

/** Runs the workspace-scoped settleWonDeal mutation through the authenticated GraphQL client. */
export const mutateSettleWonDeal = async ({
    mutation = MutationSettleWonDeal.Mutation1,
    request,
    signal,
    headers,
}: MutateSettleWonDealParams) => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
