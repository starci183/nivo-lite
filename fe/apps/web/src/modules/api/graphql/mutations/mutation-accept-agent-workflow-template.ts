import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { AcceptAgentWorkflowTemplateMutation, AcceptAgentWorkflowTemplateMutationVariables } from "../__generated__/graphql"

/** The input of the `acceptAgentWorkflowTemplate` mutation. */
export type MutateAcceptAgentWorkflowTemplateRequest = WireInput<AcceptAgentWorkflowTemplateMutationVariables["input"]>

type AcceptAgentWorkflowTemplateMutationResponse = AcceptAgentWorkflowTemplateMutation

const mutation1: TypedDocumentNode<AcceptAgentWorkflowTemplateMutationResponse, InputVariables<MutateAcceptAgentWorkflowTemplateRequest>> = gql`
    mutation AcceptAgentWorkflowTemplate($input: AcceptAgentWorkflowTemplateInput!) {
        acceptAgentWorkflowTemplate(input: $input) { id number changeKind authorKind authorId note templateId templateVersion fromNumber publishedAt stepCount changedSteps active }
    }
`

enum MutationAcceptAgentWorkflowTemplate {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationAcceptAgentWorkflowTemplate, TypedDocumentNode<AcceptAgentWorkflowTemplateMutationResponse, InputVariables<MutateAcceptAgentWorkflowTemplateRequest>>> = {
    [MutationAcceptAgentWorkflowTemplate.Mutation1]: mutation1,
}

/** The back end `acceptAgentWorkflowTemplate` mutation. Writes a new version that syncs a newer template version. */
export const mutateAcceptAgentWorkflowTemplate = async ({
    mutation = MutationAcceptAgentWorkflowTemplate.Mutation1,
    request,
    signal,
}: MutateParams<MutationAcceptAgentWorkflowTemplate, MutateAcceptAgentWorkflowTemplateRequest>): Promise<ApolloClient.MutateResult<AcceptAgentWorkflowTemplateMutationResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
