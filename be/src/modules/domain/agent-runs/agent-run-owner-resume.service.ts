import { Injectable } from "@nestjs/common"
import { WorkspaceMembersService, type WorkspaceRole } from "@modules/domain/workspace-members"
import { AgentRunResumeService } from "./agent-run-resume.service"
import { AgentRunStoreService } from "./agent-run-store.service"
import type { OwnerResumeAnswer, OwnerResumeRequest, ResumeResult } from "./agent-runs-engine.contracts"

/** The seats that may run a stopped run again: the people who govern the workspace's agents. */
const GOVERNORS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]

/** The answer for a run the caller's workspace does not hold: the same as for a run that does not exist, so no id is confirmed. */
const NOT_FOUND: OwnerResumeAnswer = { kind: "not_found", stepKey: null }

/** The answer of a resume, flat: the step only when the run goes on. */
const answerOf = (result: ResumeResult): OwnerResumeAnswer =>
    result.kind === "resumed" ? { kind: result.kind, stepKey: result.stepKey } : { kind: result.kind, stepKey: null }

@Injectable()
/**
 * The owner's door to a parked run: an owner or manager of the workspace runs it again from the step it stopped on, the way the sweep
 * and a new build do, with their seat and their reason kept on the run. A run of another workspace answers as one that does not exist.
 */
export class AgentRunOwnerResumeService {
    constructor(
        private readonly members: WorkspaceMembersService,
        private readonly runs: AgentRunStoreService,
        private readonly resumes: AgentRunResumeService,
    ) {}

    /** Runs the parked run again from its failed step for an owner or manager of its workspace; refused for any other seat. */
    async resume(request: OwnerResumeRequest): Promise<OwnerResumeAnswer> {
        await this.members.require(request.principalId, request.workspaceId, GOVERNORS)
        const actor = await this.members.idOf(request.principalId, request.workspaceId)
        const run = await this.runs.runById(request.workspaceId, request.runId)
        if (run?.workspaceId !== request.workspaceId) return NOT_FOUND
        return answerOf(
            await this.resumes.resume({ workspaceId: run.workspaceId, runId: run.id, actor, reason: request.reason }),
        )
    }
}
