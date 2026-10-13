import { Module } from "@nestjs/common"
import { ApproveLeadGenCommentHandler } from "./application/approve-leadgen-comment.handler"
import { ReadLeadGenCommentStatusHandler } from "./application/read-leadgen-comment-status.handler"
import { ReadLeadGenWorkbenchHandler } from "./application/read-leadgen-workbench.handler"

@Module({ providers: [ReadLeadGenWorkbenchHandler, ApproveLeadGenCommentHandler, ReadLeadGenCommentStatusHandler] })
/** The handlers of the Lead Gen workbench. */
export class LeadGenApiModule {}
