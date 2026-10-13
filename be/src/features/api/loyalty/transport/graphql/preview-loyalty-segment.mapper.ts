import type { PreviewSegmentRequest, PreviewSegmentResult } from "../../application/preview-segment.contracts"
import type { PreviewLoyaltySegmentInput } from "./dto/preview-loyalty-segment.input"
import type { PreviewLoyaltySegmentType } from "./dto/preview-loyalty-segment.type"

/** Maps workspace selection and bounded input into the application request. */
export const toPreviewLoyaltySegmentRequest = (
    input: PreviewLoyaltySegmentInput,
    workspaceId: string,
): PreviewSegmentRequest => ({ workspaceId, ...input })

/** Maps the application result into the GraphQL fields. */
export const toPreviewLoyaltySegmentType = (result: PreviewSegmentResult): PreviewLoyaltySegmentType => ({ ...result })
