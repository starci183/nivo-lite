import { Command } from "@nestjs/cqrs"
import type { SubmitContentRequest, SubmittedContent } from "@modules/domain/content-publishing"
import type { ExecuteParams } from "@modules/platform/cqrs"

/** Submits a complete draft to the existing human approval gate. */
export class SubmitContentForApprovalCommand extends Command<SubmittedContent> {
    constructor(readonly params: ExecuteParams<SubmitContentRequest>) {
        super()
    }
}
