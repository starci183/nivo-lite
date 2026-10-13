import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type {
    RequestContentMonthPlanMutation,
    RequestContentMonthPlanMutationVariables,
} from "../__generated__/graphql"

/** Generated input of the `requestContentMonthPlan` mutation. */
type MutateRequestContentMonthPlanRequest = WireInput<RequestContentMonthPlanMutationVariables["input"]>

/** Generated response of the `requestContentMonthPlan` mutation. */
type MutateRequestContentMonthPlanResponse = RequestContentMonthPlanMutation

type Document = TypedDocumentNode<
    MutateRequestContentMonthPlanResponse,
    InputVariables<MutateRequestContentMonthPlanRequest>
>

const mutation1: Document = gql`
    mutation RequestContentMonthPlan($input: RequestContentMonthPlanInput!) {
        requestContentMonthPlan(input: $input) {
            id
            itemId
            status
        }
    }
`

enum MutationRequestContentMonthPlan {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationRequestContentMonthPlan, Document> = {
    [MutationRequestContentMonthPlan.Mutation1]: mutation1,
}

/** Apollo options for the queued content operation. */
type MutateRequestContentMonthPlanParams = MutateParams<
    MutationRequestContentMonthPlan,
    MutateRequestContentMonthPlanRequest
>

/** Queues content AI work; completion is read through contentAiStatus. */
export const mutateRequestContentMonthPlan = async ({
    mutation = MutationRequestContentMonthPlan.Mutation1,
    request,
    signal,
}: MutateRequestContentMonthPlanParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
