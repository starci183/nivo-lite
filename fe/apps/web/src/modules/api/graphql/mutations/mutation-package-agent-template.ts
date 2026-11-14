import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { PackageAgentTemplateMutation, PackageAgentTemplateMutationVariables } from "../__generated__/graphql"

/** The response of the `packageAgentTemplate` mutation: the typed payload straight from the back end contract. */
type MutatePackageAgentTemplateResponse = PackageAgentTemplateMutation

/** The input of the `packageAgentTemplate` mutation. */
export type MutatePackageAgentTemplateRequest = WireInput<PackageAgentTemplateMutationVariables["input"]>

const mutation1: TypedDocumentNode<
    MutatePackageAgentTemplateResponse,
    InputVariables<MutatePackageAgentTemplateRequest>
> = gql`
    mutation PackageAgentTemplate($input: PackageAgentTemplateInput!) {
        packageAgentTemplate(input: $input) {
            id
            key
            version
            hash
            changelog
            breaking
            createdAt
        }
    }
`

enum MutationPackageAgentTemplate {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationPackageAgentTemplate,
    TypedDocumentNode<MutatePackageAgentTemplateResponse, InputVariables<MutatePackageAgentTemplateRequest>>
> = {
    [MutationPackageAgentTemplate.Mutation1]: mutation1,
}

/** Apollo params for {@link mutatePackageAgentTemplate}. */
type MutatePackageAgentTemplateParams = MutateParams<MutationPackageAgentTemplate, MutatePackageAgentTemplateRequest>

/** The back end `packageAgentTemplate` mutation. Rejects with the back end failure (message localized by the server). */
export const mutatePackageAgentTemplate = async ({
    mutation = MutationPackageAgentTemplate.Mutation1,
    request,
    signal,
}: MutatePackageAgentTemplateParams): Promise<ApolloClient.MutateResult<MutatePackageAgentTemplateResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
