import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationProposeAutomationBodyArgs } from "../__generated__/schema"

/** The input of the `proposeAutomationBody` mutation. */
export type MutateProposeAutomationBodyRequest = MutationProposeAutomationBodyArgs["input"]

/** The response of the `proposeAutomationBody` mutation. */
type MutateProposeAutomationBodyResponse = Pick<Mutation, "proposeAutomationBody">

const mutation1: TypedDocumentNode<
    MutateProposeAutomationBodyResponse,
    InputVariables<MutateProposeAutomationBodyRequest>
> = gql`
    mutation ProposeAutomationBody($input: TemplateKeyInput!) {
        proposeAutomationBody(input: $input) {
            body
            generated
            contextVersion
        }
    }
`

enum MutationProposeAutomationBody {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationProposeAutomationBody,
    TypedDocumentNode<MutateProposeAutomationBodyResponse, InputVariables<MutateProposeAutomationBodyRequest>>
> = {
    [MutationProposeAutomationBody.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateProposeAutomationBody}. */
type MutateProposeAutomationBodyParams = MutateParams<MutationProposeAutomationBody, MutateProposeAutomationBodyRequest>

/**
 * Proposes the shop's own wording of one template from its active context (the back end `proposeAutomationBody` mutation).
 * Nothing is saved: the owner reviews the proposal and saves it with `updateAutomationPipeline`.
 */
export const mutateProposeAutomationBody = async ({
    mutation = MutationProposeAutomationBody.Mutation1,
    request,
    signal,
}: MutateProposeAutomationBodyParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
