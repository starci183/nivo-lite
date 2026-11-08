import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, type Principal } from "@modules/platform/cqrs"
import { ResumeAgentRunCommand } from "../../application/resume-agent-run.command"
import { AgentRunResumeType } from "./dto/agent-run-resume.type"
import { ResumeAgentRunInput } from "./dto/resume-agent-run.input"
import { toAgentRunResumeType, toResumeAgentRunRequest } from "./resume-agent-run.mapper"

@Resolver()
/** GraphQL door of resumeAgentRun. */
export class ResumeAgentRunResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Runs a parked run of the workspace again from the step it stopped on; owner or manager only. */
    @Mutation(() => AgentRunResumeType, { name: "resumeAgentRun" })
    async resumeAgentRun(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ResumeAgentRunInput,
    ): Promise<AgentRunResumeType> {
        const result = await this.commandBus.execute(
            new ResumeAgentRunCommand({ request: toResumeAgentRunRequest(workspaceId, input), principal }),
        )
        return toAgentRunResumeType(result)
    }
}
