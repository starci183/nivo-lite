"use client"

import useSWR from "swr"
import { useWorkspaceParamsKey } from "@/hooks/workspaceKey"
import { answeredData, type ReadResponse, type WorkspaceReadKey } from "@/hooks/workspaceread"
import { mutatePreviewLoyaltySegment } from "@/modules/api/graphql/mutations/mutation-preview-loyalty-segment"
import type { MutatePreviewLoyaltySegmentRequest } from "@/modules/api/graphql/mutations/types/preview-loyalty-segment"
import type { PreviewLoyaltySegmentMutation } from "@/modules/api"

/** The SWR key of the live segment count. */
export const QUERY_LOYALTY_SEGMENT_PREVIEW_SWR_KEY = "QUERY_LOYALTY_SEGMENT_PREVIEW_SWR"

/** The live count of a promotion segment: `previewLoyaltySegment` is a mutation on the wire (it counts and changes nothing), read here as a cached query keyed on the segment; the last answer stays while a new segment is counted. */
export const useQueryLoyaltySegmentPreviewSwr = (
    request: MutatePreviewLoyaltySegmentRequest | null,
): ReadResponse<PreviewLoyaltySegmentMutation["previewLoyaltySegment"]> =>
    useSWR(
        useWorkspaceParamsKey(QUERY_LOYALTY_SEGMENT_PREVIEW_SWR_KEY, request === null ? null : [request]),
        async (key: WorkspaceReadKey<MutatePreviewLoyaltySegmentRequest>) => {
            return answeredData(await mutatePreviewLoyaltySegment({ request: key[2] }), "previewLoyaltySegment")
                .previewLoyaltySegment
        },
        { keepPreviousData: true },
    )
