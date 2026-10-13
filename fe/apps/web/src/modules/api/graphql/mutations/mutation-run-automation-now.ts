import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationRunAutomationNowArgs } from "../__generated__/schema"

/** The input of the `runAutomationNow` mutation. */
export type MutateRunAutomationNowRequest = MutationRunAutomationNowArgs["input"]

/** The response of the `runAutomationNow` mutation. */
type MutateRunAutomationNowResponse = Pick<Mutation, "runAutomationNow">

const mutation1: TypedDocumentNode<MutateRunAutomationNowResponse, InputVariables<MutateRunAutomationNowRequest>> =
    gql`
    mutation RunAutomationNow($input: TemplateKeyInput!) {
        runAutomationNow(input: $input)
    }
`

enum MutationRunAutomationNow {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationRunAutomationNow,
    TypedDocumentNode<MutateRunAutomationNowResponse, InputVariables<MutateRunAutomationNowRequest>>
> = {
    [MutationRunAutomationNow.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRunAutomationNow}. */
type MutateRunAutomationNowParams = MutateParams<MutationRunAutomationNow, MutateRunAutomationNowRequest>

/**
 * Runs one scheduled n8n template of the active workspace once now (the back end `runAutomationNow` mutation). Answers true
 * once the run is queued; the run itself appears in the run history.
 */
export const mutateRunAutomationNow = async ({
    mutation = MutationRunAutomationNow.Mutation1,
    request,
    signal,
}: MutateRunAutomationNowParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
