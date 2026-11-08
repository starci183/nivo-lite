import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SubmitTemplateListingMutation, SubmitTemplateListingMutationVariables } from "../__generated__/graphql"

/** The response of the `submitTemplateListing` mutation: the typed payload straight from the back end contract. */
type MutateSubmitTemplateListingResponse = SubmitTemplateListingMutation

/** The input of the `submitTemplateListing` mutation. */
export type MutateSubmitTemplateListingRequest = WireInput<SubmitTemplateListingMutationVariables["input"]>

const mutation1: TypedDocumentNode<
    MutateSubmitTemplateListingResponse,
    InputVariables<MutateSubmitTemplateListingRequest>
> = gql`
    mutation SubmitTemplateListing($input: SubmitTemplateListingInput!) {
        submitTemplateListing(input: $input) {
            id
            templateKey
            version
            status
            priceVnd
            revenueSharePct
            reviewNote
            firstParty
            updatedAt
            name {
                vi
                en
            }
            checks {
                id
                ok
                detail
            }
        }
    }
`

enum MutationSubmitTemplateListing {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSubmitTemplateListing,
    TypedDocumentNode<MutateSubmitTemplateListingResponse, InputVariables<MutateSubmitTemplateListingRequest>>
> = {
    [MutationSubmitTemplateListing.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSubmitTemplateListing}. */
type MutateSubmitTemplateListingParams = MutateParams<MutationSubmitTemplateListing, MutateSubmitTemplateListingRequest>

/** The back end `submitTemplateListing` mutation. Rejects with the back end failure (message localized by the server). */
export const mutateSubmitTemplateListing = async ({
    mutation = MutationSubmitTemplateListing.Mutation1,
    request,
    signal,
}: MutateSubmitTemplateListingParams): Promise<ApolloClient.MutateResult<MutateSubmitTemplateListingResponse>> => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
