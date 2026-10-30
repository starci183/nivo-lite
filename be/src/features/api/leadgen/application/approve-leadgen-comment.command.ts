import { Command } from "@nestjs/cqrs"
import type { ApproveLeadGenCommentRequest, LeadGenCommentStatus } from "./leadgen-comment.contracts"
import type { ExecuteParams } from "@modules/platform/cqrs"

/** Queues an approved public reply through the existing decisions job. */
export class ApproveLeadGenCommentCommand extends Command<LeadGenCommentStatus> {
    constructor(readonly params: ExecuteParams<ApproveLeadGenCommentRequest>) {
        super()
    }
}
