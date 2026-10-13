import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { MutateParams } from "../types"
import type { ApplyContentCadencePresetsMutation } from "../__generated__/graphql"

/** The generated response of applyContentCadencePresets. */
type MutateApplyContentCadencePresetsResponse = ApplyContentCadencePresetsMutation

type Document = TypedDocumentNode<MutateApplyContentCadencePresetsResponse>

const mutation1: Document = gql`
    mutation ApplyContentCadencePresets {
        applyContentCadencePresets {
            count
        }
    }
`

enum MutationApplyContentCadencePresets {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationApplyContentCadencePresets, Document> = {
    [MutationApplyContentCadencePresets.Mutation1]: mutation1,
}

/** Apollo options for applyContentCadencePresets. */
type MutateApplyContentCadencePresetsParams = Omit<MutateParams<MutationApplyContentCadencePresets, never>, "request">

/** applyContentCadencePresets in the selected workspace, authorized by the back end. */
export const mutateApplyContentCadencePresets = async ({
    mutation = MutationApplyContentCadencePresets.Mutation1,
    signal,
}: MutateApplyContentCadencePresetsParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
    })
}
