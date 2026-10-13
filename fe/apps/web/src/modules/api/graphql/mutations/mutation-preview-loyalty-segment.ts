import type { PreviewLoyaltySegmentMutation } from "../__generated__/graphql"
import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { MutatePreviewLoyaltySegmentRequest } from "./types/preview-loyalty-segment"

const mutation1 = gql`
    mutation PreviewLoyaltySegment($input: PreviewLoyaltySegmentInput!) {
        previewLoyaltySegment(input: $input) {
            reachable
            sample {
                id
                name
                tierKey
            }
            total
        }
    }
`

enum MutationPreviewLoyaltySegment {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationPreviewLoyaltySegment, DocumentNode> = {
    [MutationPreviewLoyaltySegment.Mutation1]: mutation1,
}

/** Apollo params for {@link mutatePreviewLoyaltySegment}. */
type MutationPreviewLoyaltySegmentParams = MutateParams<
    MutationPreviewLoyaltySegment,
    MutatePreviewLoyaltySegmentRequest
>

/** Counts the members a promo segment reaches, with a small sample. */
export const mutatePreviewLoyaltySegment = async ({
    mutation = MutationPreviewLoyaltySegment.Mutation1,
    request,
    signal,
}: MutationPreviewLoyaltySegmentParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate<PreviewLoyaltySegmentMutation, InputVariables<MutatePreviewLoyaltySegmentRequest>>({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
