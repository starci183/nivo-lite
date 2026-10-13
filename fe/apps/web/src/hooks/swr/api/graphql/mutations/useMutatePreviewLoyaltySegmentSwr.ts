import useSWRMutation from "swr/mutation"
import { mutatePreviewLoyaltySegment } from "@/modules/api/graphql/mutations"
import type { MutatePreviewLoyaltySegmentRequest } from "@/modules/api/graphql/mutations/types/preview-loyalty-segment"

/** The SWR key of the `previewLoyaltySegment` mutation. */
export const MUTATE_PREVIEW_LOYALTY_SEGMENT_SWR_KEY = "MUTATE_PREVIEW_LOYALTY_SEGMENT_SWR"

/** Counts the members a promo segment reaches, with a small sample. */
export const useMutatePreviewLoyaltySegmentSwr = () =>
    useSWRMutation(
        MUTATE_PREVIEW_LOYALTY_SEGMENT_SWR_KEY,
        async (_key: string, { arg }: { arg: MutatePreviewLoyaltySegmentRequest }) => {
            const result = await mutatePreviewLoyaltySegment({ request: arg })
            if (!result.data) throw new Error("previewLoyaltySegment answered no data")
            return result.data.previewLoyaltySegment
        },
    )
