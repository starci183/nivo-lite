"use client"

import { useGraphQLMutationSwr } from "@/hooks/reuseables"
import { mutatePreviewLoyaltySegment } from "@/modules/api/graphql/mutations/mutation-preview-loyalty-segment"

/** The SWR key of the previewLoyaltySegment mutation. */
export const MUTATE_PREVIEW_LOYALTY_SEGMENT_SWR_KEY = "MUTATE_PREVIEW_LOYALTY_SEGMENT_SWR"

/** SWR mutation for {@link mutatePreviewLoyaltySegment}: `trigger(input)` answers the segment preview and rejects with the back end failure. */
export const useMutatePreviewLoyaltySegmentSwr = () =>
    useGraphQLMutationSwr(
        MUTATE_PREVIEW_LOYALTY_SEGMENT_SWR_KEY,
        async (params: Parameters<typeof mutatePreviewLoyaltySegment>[0]) => {
            const result = await mutatePreviewLoyaltySegment(params)
            if (!result.data) throw new Error("previewLoyaltySegment answered no data")
            return result
        },
        (data) => data.previewLoyaltySegment,
    )
