import type { PreviewSegmentRequest, PreviewSegmentResult } from "../../application/preview-segment.contracts"
import type { PreviewSegmentParamsRequest, PreviewSegmentBodyRequest } from "./dto/preview-segment.request"
import type { PreviewSegmentResponse } from "./dto/preview-segment.response"

/** Maps the HTTP input of preview-segment to the command request. */
export const toPreviewSegmentRequest = (
    params: PreviewSegmentParamsRequest,
    body: PreviewSegmentBodyRequest,
): PreviewSegmentRequest => ({
    workspaceId: params.workspaceId,
    segment: {
        tiers: [...body.segment.tiers],
        inactiveDays: body.segment.inactiveDays,
        birthdayThisMonth: body.segment.birthdayThisMonth,
        minSpendVnd: body.segment.minSpendVnd,
    },
})

/** Maps the preview-segment result to the HTTP answer. */
export const toPreviewSegmentResponse = (result: PreviewSegmentResult): PreviewSegmentResponse => result
