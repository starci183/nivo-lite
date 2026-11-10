import { gql, type ApolloClient } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type {
    PublishAgentWorkflowVersionMutation,
    PublishAgentWorkflowVersionMutationVariables,
} from "../__generated__/graphql"

/** The input of the `publishAgentWorkflowVersion` mutation. */
export type MutatePublishAgentWorkflowVersionRequest = WireInput<PublishAgentWorkflowVersionMutationVariables["input"]>

/** The response of the `publishAgentWorkflowVersion` mutation: the typed payload straight from the back end contract. */
type MutatePublishAgentWorkflowVersionResponse = PublishAgentWorkflowVersionMutation

type Document = TypedDocumentNode<
    MutatePublishAgentWorkflowVersionResponse,
    InputVariables<MutatePublishAgentWorkflowVersionRequest>
>

const mutation1: Document = gql`
    mutation PublishAgentWorkflowVersion($input: PublishAgentWorkflowVersionInput!) {
        publishAgentWorkflowVersion(input: $input) {
            id
            number
            changeKind
            authorKind
            authorId
            note
            templateId
            templateVersion
            fromNumber
            publishedAt
            stepCount
            changedSteps
            active
        }
    }
`

enum MutationPublishAgentWorkflowVersion {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationPublishAgentWorkflowVersion, Document> = {
    [MutationPublishAgentWorkflowVersion.Mutation1]: mutation1,
}

/** Apollo params for {@link mutatePublishAgentWorkflowVersion}. */
type MutatePublishAgentWorkflowVersionParams = MutateParams<
    MutationPublishAgentWorkflowVersion,
    MutatePublishAgentWorkflowVersionRequest
>

/** The back end `publishAgentWorkflowVersion` mutation. */
export const mutatePublishAgentWorkflowVersion = async ({
    mutation = MutationPublishAgentWorkflowVersion.Mutation1,
    request,
    signal,
}: MutatePublishAgentWorkflowVersionParams): Promise<
    ApolloClient.MutateResult<MutatePublishAgentWorkflowVersionResponse>
> => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
