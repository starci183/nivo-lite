import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { ResumeAgentRunMutation, ResumeAgentRunMutationVariables } from "../__generated__/graphql"

/** The input of the `resumeAgentRun` mutation. */
export type MutateResumeAgentRunRequest = WireInput<ResumeAgentRunMutationVariables["input"]>

type MutateResumeAgentRunResponse = ResumeAgentRunMutation

const mutation1: TypedDocumentNode<MutateResumeAgentRunResponse, InputVariables<MutateResumeAgentRunRequest>> = gql`
    mutation ResumeAgentRun($input: ResumeAgentRunInput!) {
        resumeAgentRun(input: $input) {
            kind
            stepKey
        }
    }
`

enum MutationResumeAgentRun {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationResumeAgentRun,
    TypedDocumentNode<MutateResumeAgentRunResponse, InputVariables<MutateResumeAgentRunRequest>>
> = {
    [MutationResumeAgentRun.Mutation1]: mutation1,
}

/** The back end `resumeAgentRun` mutation. Runs a stopped run again from its failed step. */
export const mutateResumeAgentRun = async ({
    mutation = MutationResumeAgentRun.Mutation1,
    request,
    signal,
}: MutateParams<MutationResumeAgentRun, MutateResumeAgentRunRequest>): Promise<
    ApolloClient.MutateResult<MutateResumeAgentRunResponse>
> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
