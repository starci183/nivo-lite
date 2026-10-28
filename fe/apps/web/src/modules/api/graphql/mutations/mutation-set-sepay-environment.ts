import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SetSepayEnvironmentMutation, SetSepayEnvironmentMutationVariables } from "../__generated__/graphql"

/** The input of the `setSepayEnvironment` mutation. */
type MutateSetSepayEnvironmentRequest = WireInput<SetSepayEnvironmentMutationVariables["input"]>

/** The response of the `setSepayEnvironment` mutation. */
type MutateSetSepayEnvironmentResponse = SetSepayEnvironmentMutation

const mutation1: TypedDocumentNode<
    MutateSetSepayEnvironmentResponse,
    InputVariables<MutateSetSepayEnvironmentRequest>
> = gql`
    mutation SetSepayEnvironment($input: SetSepayEnvironmentInput!) {
        setSepayEnvironment(input: $input) {
            id
            name
            status
            environment
            lastError
            bankCode
            bank
            accountMasked
            hasFullAccount
            holder
            webhookUrl
            apiKeyMasked
            pingSeenAt
            transactionSeenAt
            health {
                lastWebhookAt
                validCount
                totalCount
                duplicateCount
            }
            agentIds
        }
    }
`

enum MutationSetSepayEnvironment {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSetSepayEnvironment,
    TypedDocumentNode<MutateSetSepayEnvironmentResponse, InputVariables<MutateSetSepayEnvironmentRequest>>
> = {
    [MutationSetSepayEnvironment.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSetSepayEnvironment}. */
type MutateSetSepayEnvironmentParams = MutateParams<MutationSetSepayEnvironment, MutateSetSepayEnvironmentRequest>

/** Switches a SePay connection between test and live. */
export const mutateSetSepayEnvironment = async ({
    mutation = MutationSetSepayEnvironment.Mutation1,
    request,
    signal,
}: MutateSetSepayEnvironmentParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
