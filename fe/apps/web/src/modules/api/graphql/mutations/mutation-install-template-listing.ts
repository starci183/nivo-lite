import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { InstallTemplateListingMutation, InstallTemplateListingMutationVariables } from "../__generated__/graphql"

/** The response of the `installTemplateListing` mutation: the typed payload straight from the back end contract. */
type MutateInstallTemplateListingResponse = InstallTemplateListingMutation

/** The input of the `installTemplateListing` mutation. */
export type MutateInstallTemplateListingRequest = WireInput<InstallTemplateListingMutationVariables["input"]>

const mutation1: TypedDocumentNode<
    MutateInstallTemplateListingResponse,
    InputVariables<MutateInstallTemplateListingRequest>
> = gql`
    mutation InstallTemplateListing($input: InstallTemplateListingInput!) {
        installTemplateListing(input: $input) {
            installationId
            agentId
            key
            version
            licenseId
        }
    }
`

enum MutationInstallTemplateListing {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationInstallTemplateListing,
    TypedDocumentNode<MutateInstallTemplateListingResponse, InputVariables<MutateInstallTemplateListingRequest>>
> = {
    [MutationInstallTemplateListing.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateInstallTemplateListing}. */
type MutateInstallTemplateListingParams = MutateParams<
    MutationInstallTemplateListing,
    MutateInstallTemplateListingRequest
>

/** The back end `installTemplateListing` mutation. Rejects with the back end failure (message localized by the server). */
export const mutateInstallTemplateListing = async ({
    mutation = MutationInstallTemplateListing.Mutation1,
    request,
    signal,
}: MutateInstallTemplateListingParams): Promise<ApolloClient.MutateResult<MutateInstallTemplateListingResponse>> => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
