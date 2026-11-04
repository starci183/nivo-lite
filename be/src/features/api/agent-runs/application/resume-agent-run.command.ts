import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { OwnerResumeAnswer } from "@modules/domain/agent-runs"
import type { ResumeAgentRunRequest } from "./resume-agent-run.contracts"

/** Runs a parked run again from the step it stopped on. */
export class ResumeAgentRunCommand extends Command<OwnerResumeAnswer> {
    constructor(readonly params: ExecuteParams<ResumeAgentRunRequest>) {
        super()
    }
}
