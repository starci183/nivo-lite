import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AgentRunResumeAnswer } from "@modules/domain/agent-pages"
import type { ResumeAgentRunRequest } from "./resume-agent-run.contracts"

/** The old resume of a parked run (a shell: it answers `thread_run`). */
export class ResumeAgentRunCommand extends Command<AgentRunResumeAnswer> {
    constructor(readonly params: ExecuteParams<ResumeAgentRunRequest>) {
        super()
    }
}
