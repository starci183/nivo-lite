import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationAdminSetWorkspacePlanArgs } from "../__generated__/schema"

/** The input of the `adminSetWorkspacePlan` mutation. */
export type MutateAdminSetWorkspacePlanRequest = MutationAdminSetWorkspacePlanArgs["input"]

/** The response of the `adminSetWorkspacePlan` mutation. */
type MutateAdminSetWorkspacePlanResponse = Pick<Mutation, "adminSetWorkspacePlan">

const mutation1: TypedDocumentNode<
    MutateAdminSetWorkspacePlanResponse,
    InputVariables<MutateAdminSetWorkspacePlanRequest>
> = gql`
    mutation AdminSetWorkspacePlan($input: AdminSetWorkspacePlanInput!) {
        adminSetWorkspacePlan(input: $input) {
            planCode
            creditsLimit
        }
    }
`

enum MutationAdminSetWorkspacePlan {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationAdminSetWorkspacePlan,
    TypedDocumentNode<MutateAdminSetWorkspacePlanResponse, InputVariables<MutateAdminSetWorkspacePlanRequest>>
> = {
    [MutationAdminSetWorkspacePlan.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateAdminSetWorkspacePlan}. */
type MutateAdminSetWorkspacePlanParams = MutateParams<MutationAdminSetWorkspacePlan, MutateAdminSetWorkspacePlanRequest>

/** Moves a workspace to a plan and sets its own credit allowance (the back end `adminSetWorkspacePlan` mutation). */
export const mutateAdminSetWorkspacePlan = async ({
    mutation = MutationAdminSetWorkspacePlan.Mutation1,
    request,
    signal,
}: MutateAdminSetWorkspacePlanParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
