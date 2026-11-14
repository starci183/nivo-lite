import { Module } from "@nestjs/common"
import { DecideAgentRunStepHandler } from "./application/decide-agent-run-step.handler"
import { ReadAgentRunHandler } from "./application/read-agent-run.handler"
import { ReadAgentRunsHandler } from "./application/read-agent-runs.handler"
import { ReadAgentWorkLogHandler } from "./application/read-agent-work-log.handler"
import { ReadAgentWorkHandler } from "./application/read-agent-work.handler"
import { ReadWorkspaceAgentWorkHandler } from "./application/read-workspace-agent-work.handler"
import { SetAgentWorkHandler } from "./application/set-agent-work.handler"
import { SetWorkspaceAgentWorkHandler } from "./application/set-workspace-agent-work.handler"
import { SaveAgentTriggerHandler } from "./application/save-agent-trigger.handler"
import { RemoveAgentTriggerHandler } from "./application/remove-agent-trigger.handler"
import { CloseAgentTaskHandler } from "./application/close-agent-task.handler"
import { RunFlowHandler } from "./application/run-flow.handler"
import {
    AgentRunBoardService,
    AgentRunDecisionsService,
    AgentRunFlowService,
    AgentRunPageService,
    AgentWorkLogService,
} from "@modules/domain/agent-pages"
import { ConfigurableModuleClass } from "./agent-work.module-definition"

@Module({
    providers: [
        AgentRunBoardService,
        AgentRunDecisionsService,
        AgentRunFlowService,
        AgentRunPageService,
        AgentWorkLogService,
        ReadAgentWorkHandler,
        ReadAgentWorkLogHandler,
        ReadAgentRunsHandler,
        ReadAgentRunHandler,
        DecideAgentRunStepHandler,
        ReadWorkspaceAgentWorkHandler,
        SetAgentWorkHandler,
        SetWorkspaceAgentWorkHandler,
        SaveAgentTriggerHandler,
        RemoveAgentTriggerHandler,
        CloseAgentTaskHandler,
        RunFlowHandler,
    ],
})
/** The agent-work feature: the handlers of its application. */
export class AgentWorkApiModule extends ConfigurableModuleClass {}
