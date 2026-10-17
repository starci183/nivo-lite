"use client"

import { mutatePreviewLoyaltySegment } from "@/modules/api/graphql/mutations/mutation-preview-loyalty-segment"
import type { mutatePreviewLoyaltySegment as MutatePreviewLoyaltySegmentOperation } from "@/modules/api/graphql/mutations/mutation-preview-loyalty-segment"
import useSWRMutation from "swr/mutation"

/** The SWR key of the previewLoyaltySegment mutation. */
export const MUTATE_PREVIEW_LOYALTY_SEGMENT_SWR_KEY = "MUTATE_PREVIEW_LOYALTY_SEGMENT_SWR"

/** SWR mutation for {@link mutatePreviewLoyaltySegment}: `trigger(input)` answers the segment preview and rejects with the back end failure. */
export const useMutatePreviewLoyaltySegmentSwr = () =>
    useSWRMutation(MUTATE_PREVIEW_LOYALTY_SEGMENT_SWR_KEY, async (_key: string, { arg }: TriggerArg) => {
        const result = await mutatePreviewLoyaltySegment({ request: arg })
        if (!result.data) throw new Error("previewLoyaltySegment answered no data")
        return result.data.previewLoyaltySegment
    })

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutatePreviewLoyaltySegmentOperation>[0]["request"]
}
