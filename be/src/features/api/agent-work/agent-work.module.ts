import { Module } from "@nestjs/common"
import { ReadAgentWorkHandler } from "./application/read-agent-work.handler"
import { ReadWorkspaceAgentWorkHandler } from "./application/read-workspace-agent-work.handler"
import { SetAgentWorkHandler } from "./application/set-agent-work.handler"
import { SetWorkspaceAgentWorkHandler } from "./application/set-workspace-agent-work.handler"
import { SaveAgentGoalHandler } from "./application/save-agent-goal.handler"
import { SaveAgentTriggerHandler } from "./application/save-agent-trigger.handler"
import { RemoveAgentTriggerHandler } from "./application/remove-agent-trigger.handler"
import { CloseAgentTaskHandler } from "./application/close-agent-task.handler"
import { ConfigurableModuleClass } from "./agent-work.module-definition"

@Module({
    providers: [
        ReadAgentWorkHandler,
        ReadWorkspaceAgentWorkHandler,
        SetAgentWorkHandler,
        SetWorkspaceAgentWorkHandler,
        SaveAgentGoalHandler,
        SaveAgentTriggerHandler,
        RemoveAgentTriggerHandler,
        CloseAgentTaskHandler,
    ],
})
/** The agent-work feature: the handlers of its application. */
export class AgentWorkApiModule extends ConfigurableModuleClass {}
