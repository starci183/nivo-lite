import { Query } from "@nestjs/cqrs"
import type { TemplatePreviewWire } from "@modules/domain/agent-graphs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AgentWorkflowTemplatePreviewRequest } from "./agent-workflow-template-preview.contracts"

/** Shows what accepting a newer template version would write into a workflow; nothing is written. */
export class AgentWorkflowTemplatePreviewQuery extends Query<TemplatePreviewWire> {
    constructor(readonly params: ExecuteParams<AgentWorkflowTemplatePreviewRequest>) {
        super()
    }
}
