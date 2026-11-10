import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ResumeAgentRunAnswer, ResumeAgentRunRequest } from "./resume-agent-run.contracts"

/** The old resume of a parked run (a shell: it answers `thread_run`). */
export class ResumeAgentRunCommand extends Command<ResumeAgentRunAnswer> {
    constructor(readonly params: ExecuteParams<ResumeAgentRunRequest>) {
        super()
    }
}
