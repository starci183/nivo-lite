import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SetContentAutomationMutation, SetContentAutomationMutationVariables } from "../__generated__/graphql"

/** The generated input of setContentAutomation. */
type MutateSetContentAutomationRequest = WireInput<SetContentAutomationMutationVariables["input"]>

/** The generated response of setContentAutomation. */
type MutateSetContentAutomationResponse = SetContentAutomationMutation

type Document = TypedDocumentNode<MutateSetContentAutomationResponse, InputVariables<MutateSetContentAutomationRequest>>

const mutation1: Document = gql`
    mutation SetContentAutomation($input: SetContentAutomationInput!) {
        setContentAutomation(input: $input) {
            workspaceId
            brandVoice
            avoid
            cta
            hashtags
            automations {
                todayReminder
                offerDraft
                weeklySummary
            }
            marks {
                key
                value
            }
        }
    }
`

enum MutationSetContentAutomation {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationSetContentAutomation, Document> = {
    [MutationSetContentAutomation.Mutation1]: mutation1,
}

/** Apollo options for setContentAutomation. */
type MutateSetContentAutomationParams = MutateParams<MutationSetContentAutomation, MutateSetContentAutomationRequest>

/** setContentAutomation in the selected workspace, authorized by the back end. */
export const mutateSetContentAutomation = async ({
    mutation = MutationSetContentAutomation.Mutation1,
    request,
    signal,
}: MutateSetContentAutomationParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
