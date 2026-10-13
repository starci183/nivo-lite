import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { RecordManualEvidenceMutation, RecordManualEvidenceMutationVariables } from "../__generated__/graphql"

/** The response of the `recordManualEvidence` mutation: the typed payload straight from the back end contract. */
type MutateRecordManualEvidenceResponse = RecordManualEvidenceMutation

/** The input of the `recordManualEvidence` mutation. */
export type MutateRecordManualEvidenceRequest = WireInput<RecordManualEvidenceMutationVariables["input"]>

const mutation1: TypedDocumentNode<
    MutateRecordManualEvidenceResponse,
    InputVariables<MutateRecordManualEvidenceRequest>
> = gql`
    mutation RecordManualEvidence($input: RecordManualEvidenceInput!) {
        recordManualEvidence(input: $input) {
            duplicate
        }
    }
`

enum MutationRecordManualEvidence {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationRecordManualEvidence,
    TypedDocumentNode<MutateRecordManualEvidenceResponse, InputVariables<MutateRecordManualEvidenceRequest>>
> = {
    [MutationRecordManualEvidence.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRecordManualEvidence}. */
type MutateRecordManualEvidenceParams = MutateParams<MutationRecordManualEvidence, MutateRecordManualEvidenceRequest>

/**
 * Admits one piece of manual evidence: money the owner knows arrived (the back end `recordManualEvidence` mutation).
 * Rejects with the back end failure (`CombinedGraphQLErrors`, message localized by the server).
 */
export const mutateRecordManualEvidence = async ({
    mutation = MutationRecordManualEvidence.Mutation1,
    request,
    signal,
}: MutateRecordManualEvidenceParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
