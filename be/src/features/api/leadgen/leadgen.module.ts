import { Module } from "@nestjs/common"
import { ApproveLeadGenCommentHandler } from "./application/approve-leadgen-comment.handler"
import { ReadLeadGenCommentStatusHandler } from "./application/read-leadgen-comment-status.handler"
import { ReadLeadGenWorkbenchHandler } from "./application/read-leadgen-workbench.handler"
import { LeadGenCommentService } from "./application/leadgen-comment.service"
import { ConfigurableModuleClass } from "./leadgen.module-definition"

@Module({
    providers: [
        LeadGenCommentService,
        ReadLeadGenWorkbenchHandler,
        ApproveLeadGenCommentHandler,
        ReadLeadGenCommentStatusHandler,
    ],
})
/** The handlers of the Lead Gen workbench. */
export class LeadGenApiModule extends ConfigurableModuleClass {}
