import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { AttachProviderByTemplateMutation, AttachProviderByTemplateMutationVariables } from "../__generated__/graphql"

/** The input of the `attachProviderByTemplate` mutation. */
export type MutateAttachProviderByTemplateRequest = WireInput<AttachProviderByTemplateMutationVariables["input"]>

/** The response of the `attachProviderByTemplate` mutation. */
type MutateAttachProviderByTemplateResponse = AttachProviderByTemplateMutation

type Document = TypedDocumentNode<MutateAttachProviderByTemplateResponse, InputVariables<MutateAttachProviderByTemplateRequest>>

const mutation1: Document = gql`
    mutation AttachProviderByTemplate($input: AttachProviderByTemplateInput!) {
        attachProviderByTemplate(input: $input)
    }
`

enum MutateAttachProviderByTemplateDocument {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutateAttachProviderByTemplateDocument, Document> = {
    [MutateAttachProviderByTemplateDocument.Mutation1]: mutation1,
}

type MutateAttachProviderByTemplateParams = MutateParams<MutateAttachProviderByTemplateDocument, MutateAttachProviderByTemplateRequest>

/** Attaches a provider to the listed agents with their template defaults (owner or manager); answers the attached agent ids. Rejects with the back end failure. */
export const mutateAttachProviderByTemplate = async ({
    mutation = MutateAttachProviderByTemplateDocument.Mutation1,
    request,
    signal,
}: MutateAttachProviderByTemplateParams): Promise<ApolloClient.MutateResult<MutateAttachProviderByTemplateResponse>> => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
