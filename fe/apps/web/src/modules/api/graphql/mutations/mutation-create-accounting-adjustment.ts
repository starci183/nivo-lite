import { gql, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type {
    CreateAccountingAdjustmentMutation,
    CreateAccountingAdjustmentMutationVariables,
} from "../__generated__/graphql"

/** The input of the `createAccountingAdjustment` mutation. */
export type MutateCreateAccountingAdjustmentRequest = WireInput<CreateAccountingAdjustmentMutationVariables["input"]>

type MutateCreateAccountingAdjustmentResponse = CreateAccountingAdjustmentMutation

const mutation1: TypedDocumentNode<
    MutateCreateAccountingAdjustmentResponse,
    InputVariables<MutateCreateAccountingAdjustmentRequest>
> = gql`
    mutation CreateAccountingAdjustment($input: CreateAccountingAdjustmentInput!) {
        createAccountingAdjustment(input: $input) {
            id
            targetType
            targetId
            note
            correctedAmount
            createdBy
            createdAt
        }
    }
`

enum MutationCreateAccountingAdjustment {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationCreateAccountingAdjustment, typeof mutation1> = {
    [MutationCreateAccountingAdjustment.Mutation1]: mutation1,
}

/** Records a correction after the back end verifies the target and the member's role. */
export const mutateCreateAccountingAdjustment = async ({
    mutation = MutationCreateAccountingAdjustment.Mutation1,
    request,
    signal,
}: MutateParams<MutationCreateAccountingAdjustment, MutateCreateAccountingAdjustmentRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
