import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { MutateParams } from "../types"
import type { ApplyContentPillarPresetsMutation } from "../__generated__/graphql"

/** The generated response of applyContentPillarPresets. */
type MutateApplyContentPillarPresetsResponse = ApplyContentPillarPresetsMutation

type Document = TypedDocumentNode<MutateApplyContentPillarPresetsResponse>

const mutation1: Document = gql`
    mutation ApplyContentPillarPresets {
        applyContentPillarPresets {
            count
        }
    }
`

enum MutationApplyContentPillarPresets {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationApplyContentPillarPresets, Document> = {
    [MutationApplyContentPillarPresets.Mutation1]: mutation1,
}

/** Apollo options for applyContentPillarPresets. */
type MutateApplyContentPillarPresetsParams = Omit<MutateParams<MutationApplyContentPillarPresets, never>, "request">

/** applyContentPillarPresets in the selected workspace, authorized by the back end. */
export const mutateApplyContentPillarPresets = async ({
    mutation = MutationApplyContentPillarPresets.Mutation1,
    signal,
}: MutateApplyContentPillarPresetsParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
    })
}
