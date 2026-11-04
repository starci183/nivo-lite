import { CommandHandler } from "@nestjs/cqrs"
import { AgentRunOwnerResumeService } from "@modules/domain/agent-runs"
import type { OwnerResumeAnswer } from "@modules/domain/agent-runs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ResumeAgentRunCommand } from "./resume-agent-run.command"

@CommandHandler(ResumeAgentRunCommand)
/** Runs a parked run again through the owner's door of the agent runs. */
export class ResumeAgentRunHandler extends ICQRSHandler<ResumeAgentRunCommand, OwnerResumeAnswer> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly resumes: AgentRunOwnerResumeService,
    ) {
        super(logger)
    }

    protected override process(command: ResumeAgentRunCommand): Promise<OwnerResumeAnswer> {
        return this.resumes.resume({ principalId: command.params.principal.id, ...command.params.request })
    }
}
