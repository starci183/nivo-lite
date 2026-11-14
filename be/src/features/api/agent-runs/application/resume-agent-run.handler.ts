import { CommandHandler } from "@nestjs/cqrs"
import { AgentRunResumeService, type AgentRunResumeAnswer } from "@modules/domain/agent-pages"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ResumeAgentRunCommand } from "./resume-agent-run.command"

@CommandHandler(ResumeAgentRunCommand)
/** The old owner's resume of a parked run, kept as a shell: no run parks any more, so the capability reads nothing and answers `thread_run`. */
export class ResumeAgentRunHandler extends ICQRSHandler<ResumeAgentRunCommand, AgentRunResumeAnswer> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly resumes: AgentRunResumeService,
    ) {
        super(logger)
    }

    protected override process(_command: ResumeAgentRunCommand): Promise<AgentRunResumeAnswer> {
        return this.resumes.resume()
    }
}
