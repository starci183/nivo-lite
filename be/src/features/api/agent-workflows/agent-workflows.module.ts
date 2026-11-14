import { Module } from "@nestjs/common"
import { AgentWorkflowListService } from "@modules/domain/agent-pages"
import { AgentWorkflowsHandler } from "./application/agent-workflows.handler"
import { AgentWorkflowGraphHandler } from "./application/agent-workflow-graph.handler"
import { AgentGraphLayoutHandler } from "./application/agent-graph-layout.handler"
import { SaveAgentGraphLayoutHandler } from "./application/save-agent-graph-layout.handler"
import { AgentWorkflowHandler } from "./application/agent-workflow.handler"
import { AgentWorkflowDiffHandler } from "./application/agent-workflow-diff.handler"
import { AgentWorkflowTemplatePreviewHandler } from "./application/agent-workflow-template-preview.handler"
import { WorkflowTemplatesHandler } from "./application/workflow-templates.handler"
import { WorkflowTemplateHandler } from "./application/workflow-template.handler"
import { AgentRunWorkflowsHandler } from "./application/agent-run-workflows.handler"
import { CreateAgentWorkflowHandler } from "./application/create-agent-workflow.handler"
import { PublishAgentWorkflowVersionHandler } from "./application/publish-agent-workflow-version.handler"
import { RollbackAgentWorkflowHandler } from "./application/rollback-agent-workflow.handler"
import { AcceptAgentWorkflowTemplateHandler } from "./application/accept-agent-workflow-template.handler"
import { AgreeAgentNodeRightsHandler } from "./application/agree-agent-node-rights.handler"
import { SetAgentWorkflowStatusHandler } from "./application/set-agent-workflow-status.handler"
import { SetAgentNodeModeHandler } from "./application/set-agent-node-mode.handler"
import { RunWorkflowHandler } from "./application/run-workflow.handler"
import { RunnableWorkflowHandler } from "./application/runnable-workflow.handler"
import { ConfigurableModuleClass } from "./agent-workflows.module-definition"

@Module({
    providers: [
        AgentWorkflowListService,
        AgentWorkflowsHandler,
        AgentWorkflowGraphHandler,
        AgentGraphLayoutHandler,
        SaveAgentGraphLayoutHandler,
        AgentWorkflowHandler,
        AgentWorkflowDiffHandler,
        AgentWorkflowTemplatePreviewHandler,
        WorkflowTemplatesHandler,
        WorkflowTemplateHandler,
        AgentRunWorkflowsHandler,
        CreateAgentWorkflowHandler,
        PublishAgentWorkflowVersionHandler,
        RollbackAgentWorkflowHandler,
        AcceptAgentWorkflowTemplateHandler,
        SetAgentWorkflowStatusHandler,
        SetAgentNodeModeHandler,
        AgreeAgentNodeRightsHandler,
        RunWorkflowHandler,
        RunnableWorkflowHandler,
    ],
})
/** The workflows feature: the workflows of each agent, their version history and the templates they come from. */
export class AgentWorkflowsApiModule extends ConfigurableModuleClass {}
