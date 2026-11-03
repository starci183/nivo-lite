import { gql } from "@apollo/client"
import type { ApolloClient, TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { ImportAgentTemplateMutation, ImportAgentTemplateMutationVariables } from "../__generated__/graphql"

/** The response of the `importAgentTemplate` mutation: the typed payload straight from the back end contract. */
type MutateImportAgentTemplateResponse = ImportAgentTemplateMutation

/** The input of the `importAgentTemplate` mutation. */
export type MutateImportAgentTemplateRequest = WireInput<ImportAgentTemplateMutationVariables["input"]>

const mutation1: TypedDocumentNode<
    MutateImportAgentTemplateResponse,
    InputVariables<MutateImportAgentTemplateRequest>
> = gql`
    mutation ImportAgentTemplate($input: ImportAgentTemplateInput!) {
        importAgentTemplate(input: $input) {
            installationId
            agentId
            key
            version
            licenseId
        }
    }
`

enum MutationImportAgentTemplate {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationImportAgentTemplate,
    TypedDocumentNode<MutateImportAgentTemplateResponse, InputVariables<MutateImportAgentTemplateRequest>>
> = {
    [MutationImportAgentTemplate.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateImportAgentTemplate}. */
type MutateImportAgentTemplateParams = MutateParams<MutationImportAgentTemplate, MutateImportAgentTemplateRequest>

/** The back end `importAgentTemplate` mutation. Rejects with the back end failure (message localized by the server). */
export const mutateImportAgentTemplate = async ({
    mutation = MutationImportAgentTemplate.Mutation1,
    request,
    signal,
}: MutateImportAgentTemplateParams): Promise<ApolloClient.MutateResult<MutateImportAgentTemplateResponse>> => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
