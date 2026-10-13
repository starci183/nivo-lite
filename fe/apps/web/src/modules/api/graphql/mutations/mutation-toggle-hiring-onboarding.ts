import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationToggleHiringOnboardingArgs } from "../__generated__/schema"

/** The input of the `toggleHiringOnboarding` mutation. */
export type MutateToggleHiringOnboardingRequest = MutationToggleHiringOnboardingArgs["input"]

/** The response of the `toggleHiringOnboarding` mutation. */
type MutateToggleHiringOnboardingResponse = Pick<Mutation, "toggleHiringOnboarding">

const mutation1: TypedDocumentNode<
    MutateToggleHiringOnboardingResponse,
    InputVariables<MutateToggleHiringOnboardingRequest>
> = gql`
    mutation ToggleHiringOnboarding($input: ToggleHiringOnboardingInput!) {
        toggleHiringOnboarding(input: $input)
    }
`

enum MutationToggleHiringOnboarding {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationToggleHiringOnboarding,
    TypedDocumentNode<MutateToggleHiringOnboardingResponse, InputVariables<MutateToggleHiringOnboardingRequest>>
> = {
    [MutationToggleHiringOnboarding.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateToggleHiringOnboarding}. */
type MutateToggleHiringOnboardingParams = MutateParams<
    MutationToggleHiringOnboarding,
    MutateToggleHiringOnboardingRequest
>

/** Runs the `toggleHiringOnboarding` mutation. */
export const mutateToggleHiringOnboarding = async ({
    mutation = MutationToggleHiringOnboarding.Mutation1,
    request,
    signal,
}: MutateToggleHiringOnboardingParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
