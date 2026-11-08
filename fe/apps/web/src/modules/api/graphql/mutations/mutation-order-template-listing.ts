import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { OrderTemplateListingMutation, OrderTemplateListingMutationVariables } from "../__generated__/graphql"

/** The response of the `orderTemplateListing` mutation: the typed payload straight from the back end contract. */
type MutateOrderTemplateListingResponse = OrderTemplateListingMutation

/** The input of the `orderTemplateListing` mutation. */
export type MutateOrderTemplateListingRequest = WireInput<OrderTemplateListingMutationVariables["input"]>

const mutation1: TypedDocumentNode<
    MutateOrderTemplateListingResponse,
    InputVariables<MutateOrderTemplateListingRequest>
> = gql`
    mutation OrderTemplateListing($input: OrderTemplateListingInput!) {
        orderTemplateListing(input: $input) {
            orderId
            orderCode
            amountVnd
            expiresAt
            qrUrl
            bank
            account
            holder
        }
    }
`

enum MutationOrderTemplateListing {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationOrderTemplateListing,
    TypedDocumentNode<MutateOrderTemplateListingResponse, InputVariables<MutateOrderTemplateListingRequest>>
> = {
    [MutationOrderTemplateListing.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateOrderTemplateListing}. */
type MutateOrderTemplateListingParams = MutateParams<MutationOrderTemplateListing, MutateOrderTemplateListingRequest>

/** The back end `orderTemplateListing` mutation. Rejects with the back end failure (message localized by the server). */
export const mutateOrderTemplateListing = async ({
    mutation = MutationOrderTemplateListing.Mutation1,
    request,
    signal,
}: MutateOrderTemplateListingParams): Promise<ApolloClient.MutateResult<MutateOrderTemplateListingResponse>> => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
