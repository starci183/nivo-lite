import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { ApplySetupMutation, ApplySetupMutationVariables } from "../__generated__/graphql"

/** The input of the `applySetup` mutation. */
export type MutateApplySetupRequest = WireInput<ApplySetupMutationVariables["input"]>

type MutateApplySetupResponse = ApplySetupMutation

const mutation1: TypedDocumentNode<MutateApplySetupResponse, InputVariables<MutateApplySetupRequest>> = gql`
    mutation ApplySetup($input: ModuleInstallationIdInput!) {
        applySetup(input: $input) {
            version
        }
    }
`

enum MutationApplySetup {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationApplySetup,
    TypedDocumentNode<MutateApplySetupResponse, InputVariables<MutateApplySetupRequest>>
> = {
    [MutationApplySetup.Mutation1]: mutation1,
}

/** The back end `applySetup` mutation. */
export const mutateApplySetup = async ({
    mutation = MutationApplySetup.Mutation1,
    request,
    signal,
}: MutateParams<MutationApplySetup, MutateApplySetupRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
