import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationAdminExtendSubscriptionArgs } from "../__generated__/schema"

/** The input of the `adminExtendSubscription` mutation. */
export type MutateAdminExtendSubscriptionRequest = MutationAdminExtendSubscriptionArgs["input"]

/** The response of the `adminExtendSubscription` mutation. */
type MutateAdminExtendSubscriptionResponse = Pick<Mutation, "adminExtendSubscription">

const mutation1: TypedDocumentNode<
    MutateAdminExtendSubscriptionResponse,
    InputVariables<MutateAdminExtendSubscriptionRequest>
> = gql`
    mutation AdminExtendSubscription($input: AdminExtendSubscriptionInput!) {
        adminExtendSubscription(input: $input) {
            paidUntil
        }
    }
`

enum MutationAdminExtendSubscription {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationAdminExtendSubscription,
    TypedDocumentNode<MutateAdminExtendSubscriptionResponse, InputVariables<MutateAdminExtendSubscriptionRequest>>
> = {
    [MutationAdminExtendSubscription.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateAdminExtendSubscription}. */
type MutateAdminExtendSubscriptionParams = MutateParams<
    MutationAdminExtendSubscription,
    MutateAdminExtendSubscriptionRequest
>

/** Extends the paid period of a workspace by whole days (the back end `adminExtendSubscription` mutation). */
export const mutateAdminExtendSubscription = async ({
    mutation = MutationAdminExtendSubscription.Mutation1,
    request,
    signal,
}: MutateAdminExtendSubscriptionParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
