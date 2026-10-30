import { Query } from "@nestjs/cqrs"
import type { LeadGenCommentStatus } from "./leadgen-comment.contracts"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ReadLeadGenCommentStatusRequest } from "./read-leadgen-comment-status.contracts"

/** Reads progress of one queued public-comment decision. */
export class ReadLeadGenCommentStatusQuery extends Query<LeadGenCommentStatus> {
    constructor(readonly params: ExecuteParams<ReadLeadGenCommentStatusRequest>) {
        super()
    }
}
