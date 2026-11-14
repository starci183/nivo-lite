import { Module } from "@nestjs/common"
import { AgentWorkflowsApiModule } from "../../agent-workflows.module"
import { ConfigurableModuleClass } from "./agent-workflows-graphql.module-definition"
import { AgentWorkflowsResolver } from "./agent-workflows.resolver"
import { AgentWorkflowGraphResolver } from "./agent-workflow-graph.resolver"
import { AgentGraphLayoutResolver } from "./agent-graph-layout.resolver"
import { SaveAgentGraphLayoutResolver } from "./save-agent-graph-layout.resolver"
import { AgentWorkflowResolver } from "./agent-workflow.resolver"
import { AgentWorkflowDiffResolver } from "./agent-workflow-diff.resolver"
import { AgentWorkflowTemplatePreviewResolver } from "./agent-workflow-template-preview.resolver"
import { WorkflowTemplatesResolver } from "./workflow-templates.resolver"
import { WorkflowTemplateResolver } from "./workflow-template.resolver"
import { AgentRunWorkflowsResolver } from "./agent-run-workflows.resolver"
import { CreateAgentWorkflowResolver } from "./create-agent-workflow.resolver"
import { PublishAgentWorkflowVersionResolver } from "./publish-agent-workflow-version.resolver"
import { RollbackAgentWorkflowResolver } from "./rollback-agent-workflow.resolver"
import { AcceptAgentWorkflowTemplateResolver } from "./accept-agent-workflow-template.resolver"
import { AgreeAgentNodeRightsResolver } from "./agree-agent-node-rights.resolver"
import { SetAgentWorkflowStatusResolver } from "./set-agent-workflow-status.resolver"
import { RunWorkflowResolver } from "./run-workflow.resolver"
import { RunnableWorkflowResolver } from "./runnable-workflow.resolver"

@Module({
    imports: [AgentWorkflowsApiModule.register({})],
    providers: [
        AgentWorkflowsResolver,
        AgentWorkflowGraphResolver,
        AgentGraphLayoutResolver,
        SaveAgentGraphLayoutResolver,
        AgentWorkflowResolver,
        AgentWorkflowDiffResolver,
        AgentWorkflowTemplatePreviewResolver,
        WorkflowTemplatesResolver,
        WorkflowTemplateResolver,
        AgentRunWorkflowsResolver,
        CreateAgentWorkflowResolver,
        PublishAgentWorkflowVersionResolver,
        RollbackAgentWorkflowResolver,
        AcceptAgentWorkflowTemplateResolver,
        SetAgentWorkflowStatusResolver,
        AgreeAgentNodeRightsResolver,
        RunWorkflowResolver,
        RunnableWorkflowResolver,
    ],
})
/** The GraphQL transport of the workflows tab and the template pages. */
export class AgentWorkflowsGraphqlModule extends ConfigurableModuleClass {}
