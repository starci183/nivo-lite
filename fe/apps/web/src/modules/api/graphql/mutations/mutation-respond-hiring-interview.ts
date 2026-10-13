import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createNoAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { RespondHiringInterviewMutation, RespondHiringInterviewMutationVariables } from "../__generated__/graphql"

/** The input of the `respondHiringInterview` mutation. */
export type MutateRespondHiringInterviewRequest = WireInput<RespondHiringInterviewMutationVariables["input"]>

/** The response of the `respondHiringInterview` mutation. */
type MutateRespondHiringInterviewResponse = RespondHiringInterviewMutation

const mutation1: TypedDocumentNode<
    MutateRespondHiringInterviewResponse,
    InputVariables<MutateRespondHiringInterviewRequest>
> = gql`
    mutation RespondHiringInterview($input: RespondHiringInterviewInput!) {
        respondHiringInterview(input: $input) {
            outcome
            slotStart
        }
    }
`

enum MutationRespondHiringInterview {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationRespondHiringInterview,
    TypedDocumentNode<MutateRespondHiringInterviewResponse, InputVariables<MutateRespondHiringInterviewRequest>>
> = {
    [MutationRespondHiringInterview.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRespondHiringInterview}. */
type MutateRespondHiringInterviewParams = MutateParams<
    MutationRespondHiringInterview,
    MutateRespondHiringInterviewRequest
>

/** Runs the `respondHiringInterview` mutation (anonymous public door). */
export const mutateRespondHiringInterview = async ({
    mutation = MutationRespondHiringInterview.Mutation1,
    request,
    signal,
}: MutateRespondHiringInterviewParams) => {
    const apollo = createNoAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
