import { CommandHandler } from "@nestjs/cqrs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ResumeAgentRunCommand } from "./resume-agent-run.command"
import type { ResumeAgentRunAnswer } from "./resume-agent-run.contracts"

/** The one answer: a thread run moves only through its stop. */
const THREAD_RUN: ResumeAgentRunAnswer = { kind: "thread_run", stepKey: null }

@CommandHandler(ResumeAgentRunCommand)
/** The old owner's resume of a parked run, kept as a shell: no run parks any more, so it reads nothing and answers `thread_run`. */
export class ResumeAgentRunHandler extends ICQRSHandler<ResumeAgentRunCommand, ResumeAgentRunAnswer> {
    constructor(@InjectLogger() logger: Logger) {
        super(logger)
    }

    protected override process(_command: ResumeAgentRunCommand): Promise<ResumeAgentRunAnswer> {
        return Promise.resolve(THREAD_RUN)
    }
}
