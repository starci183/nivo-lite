import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationRequestHiringInterviewArgs } from "../__generated__/schema"

/** The input of the `requestHiringInterview` mutation. */
export type MutateRequestHiringInterviewRequest = MutationRequestHiringInterviewArgs["input"]

/** The response of the `requestHiringInterview` mutation. */
type MutateRequestHiringInterviewResponse = Pick<Mutation, "requestHiringInterview">

const mutation1: TypedDocumentNode<
    MutateRequestHiringInterviewResponse,
    InputVariables<MutateRequestHiringInterviewRequest>
> = gql`
    mutation RequestHiringInterview($input: RequestHiringInterviewInput!) {
        requestHiringInterview(input: $input) {
            error
            status
            summary
        }
    }
`

enum MutationRequestHiringInterview {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationRequestHiringInterview,
    TypedDocumentNode<MutateRequestHiringInterviewResponse, InputVariables<MutateRequestHiringInterviewRequest>>
> = {
    [MutationRequestHiringInterview.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRequestHiringInterview}. */
type MutateRequestHiringInterviewParams = MutateParams<
    MutationRequestHiringInterview,
    MutateRequestHiringInterviewRequest
>

/** Runs the `requestHiringInterview` mutation. */
export const mutateRequestHiringInterview = async ({
    mutation = MutationRequestHiringInterview.Mutation1,
    request,
    signal,
}: MutateRequestHiringInterviewParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
