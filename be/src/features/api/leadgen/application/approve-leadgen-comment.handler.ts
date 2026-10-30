import { CommandHandler } from "@nestjs/cqrs"
import { LeadGenCommentService } from "./leadgen-comment.service"
import type { LeadGenCommentStatus } from "./leadgen-comment.contracts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ApproveLeadGenCommentCommand } from "./approve-leadgen-comment.command"

@CommandHandler(ApproveLeadGenCommentCommand)
/** Starts an authorized comment approval without waiting for the external effect. */
export class ApproveLeadGenCommentHandler extends ICQRSHandler<ApproveLeadGenCommentCommand, LeadGenCommentStatus> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly comments: LeadGenCommentService,
    ) {
        super(logger)
    }

    protected override process(command: ApproveLeadGenCommentCommand): Promise<LeadGenCommentStatus> {
        return this.comments.approve(command.params.principal.id, command.params.request)
    }
}
