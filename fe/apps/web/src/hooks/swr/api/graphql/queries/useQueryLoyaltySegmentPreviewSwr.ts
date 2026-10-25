"use client"

import useSWR from "swr"
import { useWorkspaceParamsKey } from "@/hooks/workspaceKey"
import type { WorkspaceReadKey } from "@/hooks/workspaceread"
import { mutatePreviewLoyaltySegment } from "@/modules/api/graphql/mutations/mutation-preview-loyalty-segment"
import type { MutatePreviewLoyaltySegmentRequest } from "@/modules/api/graphql/mutations/types/preview-loyalty-segment"

/** The SWR key of the live segment count. */
export const QUERY_LOYALTY_SEGMENT_PREVIEW_SWR_KEY = "QUERY_LOYALTY_SEGMENT_PREVIEW_SWR"

/** The live count of a promotion segment: `previewLoyaltySegment` is a mutation on the wire (it counts and changes nothing), read here as a cached query keyed on the segment; the last answer stays while a new segment is counted. */
export const useQueryLoyaltySegmentPreviewSwr = (request: MutatePreviewLoyaltySegmentRequest | null) =>
    useSWR(
        useWorkspaceParamsKey(QUERY_LOYALTY_SEGMENT_PREVIEW_SWR_KEY, request === null ? null : [request]),
        async (key: WorkspaceReadKey<MutatePreviewLoyaltySegmentRequest>) => {
            const result = await mutatePreviewLoyaltySegment({ request: key[2] })
            if (!result.data) throw new Error("previewLoyaltySegment answered no data")
            return result.data.previewLoyaltySegment
        },
        { keepPreviousData: true },
    )
