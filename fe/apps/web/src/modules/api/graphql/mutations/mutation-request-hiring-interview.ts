import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { RequestHiringInterviewMutation, RequestHiringInterviewMutationVariables } from "../__generated__/graphql"

/** The input of the `requestHiringInterview` mutation. */
export type MutateRequestHiringInterviewRequest = WireInput<RequestHiringInterviewMutationVariables["input"]>

/** The response of the `requestHiringInterview` mutation. */
type MutateRequestHiringInterviewResponse = RequestHiringInterviewMutation

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
