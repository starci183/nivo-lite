import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { RecordOutcomeMutation, RecordOutcomeMutationVariables } from "../__generated__/graphql"

/** Generated input of the recordOutcome mutation. */
export type MutateRecordOutcomeRequest = WireInput<RecordOutcomeMutationVariables["input"]>

/** Generated response of the recordOutcome mutation. */
type MutateRecordOutcomeResponse = RecordOutcomeMutation

type Document = TypedDocumentNode<MutateRecordOutcomeResponse, InputVariables<MutateRecordOutcomeRequest>>

const mutation1: Document = gql`
    mutation RecordOutcome($input: RecordOutcomeInput!) {
        recordOutcome(input: $input) {
            channel
            company
            contactName
            handedToAccounting
            leadId
            need
            stage
        }
    }
`

enum MutationRecordOutcome {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationRecordOutcome, Document> = {
    [MutationRecordOutcome.Mutation1]: mutation1,
}

/** Apollo parameters for the recordOutcome mutation. */
type MutateRecordOutcomeParams = MutateParams<MutationRecordOutcome, MutateRecordOutcomeRequest>

/** Runs the workspace-scoped recordOutcome mutation through the authenticated GraphQL client. */
export const mutateRecordOutcome = async ({
    mutation = MutationRecordOutcome.Mutation1,
    request,
    signal,
    headers,
}: MutateRecordOutcomeParams) => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
