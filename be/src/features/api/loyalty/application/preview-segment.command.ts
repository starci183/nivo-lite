import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { PreviewSegmentRequest, PreviewSegmentResult } from "./preview-segment.contracts"

/** Shows who a segment holds. */
export class PreviewSegmentCommand extends Command<PreviewSegmentResult> {
    constructor(readonly params: ExecuteParams<PreviewSegmentRequest>) {
        super()
    }
}
