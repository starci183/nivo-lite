import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createNoAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationRespondHiringInterviewArgs } from "../__generated__/schema"

/** The input of the `respondHiringInterview` mutation. */
export type MutateRespondHiringInterviewRequest = MutationRespondHiringInterviewArgs["input"]

/** The response of the `respondHiringInterview` mutation. */
type MutateRespondHiringInterviewResponse = Pick<Mutation, "respondHiringInterview">

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
