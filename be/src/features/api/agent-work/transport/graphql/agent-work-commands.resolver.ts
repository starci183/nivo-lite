import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { CloseAgentTaskCommand } from "../../application/close-agent-task.command"
import { RemoveAgentTriggerCommand } from "../../application/remove-agent-trigger.command"
import { SaveAgentGoalCommand } from "../../application/save-agent-goal.command"
import { SaveAgentTriggerCommand } from "../../application/save-agent-trigger.command"
import { SetAgentWorkCommand } from "../../application/set-agent-work.command"
import { SetWorkspaceAgentWorkCommand } from "../../application/set-workspace-agent-work.command"
import {
    toAgentGoalType,
    toAgentTriggerType,
    toAgentWorkAckType,
    toAgentWorkStateType,
    toCloseAgentTaskRequest,
    toRemoveAgentTriggerRequest,
    toSaveAgentGoalRequest,
    toSaveAgentTriggerRequest,
    toSetAgentWorkRequest,
    toSetWorkspaceAgentWorkRequest,
    toWorkspaceSwitchType,
} from "./agent-work.mapper"
import { AgentGoalType } from "./dto/agent-goal.type"
import { AgentTriggerType } from "./dto/agent-trigger.type"
import { AgentWorkAckType } from "./dto/agent-work-ack.type"
import { AgentWorkStateType } from "./dto/agent-work-state.type"
import { CloseAgentTaskInput } from "./dto/close-agent-task.input"
import { RemoveAgentTriggerInput } from "./dto/remove-agent-trigger.input"
import { SaveAgentGoalInput } from "./dto/save-agent-goal.input"
import { SaveAgentTriggerInput } from "./dto/save-agent-trigger.input"
import { SetAgentWorkInput } from "./dto/set-agent-work.input"
import { SetWorkspaceAgentWorkInput } from "./dto/set-workspace-agent-work.input"
import { WorkspaceAgentWorkType } from "./dto/workspace-agent-work.type"

@Resolver()
/** GraphQL doors that change the work of an agent: the two switches (owner only), goals, triggers and tasks (owner or manager). */
export class AgentWorkCommandsResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Switches work on or off for one agent. */
    @Mutation(() => AgentWorkStateType, { name: "setAgentWork" })
    async setAgentWork(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SetAgentWorkInput,
    ): Promise<AgentWorkStateType> {
        const result = await this.commandBus.execute(
            new SetAgentWorkCommand({ request: toSetAgentWorkRequest(workspaceId, input), principal }),
        )
        return toAgentWorkStateType(result)
    }

    /** Switches work on or off for every agent of the workspace. */
    @Mutation(() => WorkspaceAgentWorkType, { name: "setWorkspaceAgentWork" })
    async setWorkspaceAgentWork(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SetWorkspaceAgentWorkInput,
    ): Promise<WorkspaceAgentWorkType> {
        const result = await this.commandBus.execute(
            new SetWorkspaceAgentWorkCommand({ request: toSetWorkspaceAgentWorkRequest(workspaceId, input), principal }),
        )
        return toWorkspaceSwitchType(result)
    }

    /** Adds a goal to an agent or changes one. */
    @Mutation(() => AgentGoalType, { name: "saveAgentGoal" })
    async saveAgentGoal(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveAgentGoalInput,
    ): Promise<AgentGoalType> {
        const result = await this.commandBus.execute(
            new SaveAgentGoalCommand({ request: toSaveAgentGoalRequest(workspaceId, input), principal }),
        )
        return toAgentGoalType(result)
    }

    /** Adds a trigger to an agent or changes one. */
    @Mutation(() => AgentTriggerType, { name: "saveAgentTrigger" })
    async saveAgentTrigger(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveAgentTriggerInput,
    ): Promise<AgentTriggerType> {
        const result = await this.commandBus.execute(
            new SaveAgentTriggerCommand({ request: toSaveAgentTriggerRequest(workspaceId, input), principal }),
        )
        return toAgentTriggerType(result)
    }

    /** Removes a trigger of an agent. */
    @Mutation(() => AgentWorkAckType, { name: "removeAgentTrigger" })
    async removeAgentTrigger(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RemoveAgentTriggerInput,
    ): Promise<AgentWorkAckType> {
        await this.commandBus.execute(
            new RemoveAgentTriggerCommand({ request: toRemoveAgentTriggerRequest(workspaceId, input), principal }),
        )
        return toAgentWorkAckType()
    }

    /** Closes a task an agent is on. */
    @Mutation(() => AgentWorkAckType, { name: "closeAgentTask" })
    async closeAgentTask(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: CloseAgentTaskInput,
    ): Promise<AgentWorkAckType> {
        await this.commandBus.execute(
            new CloseAgentTaskCommand({ request: toCloseAgentTaskRequest(workspaceId, input), principal }),
        )
        return toAgentWorkAckType()
    }
}
