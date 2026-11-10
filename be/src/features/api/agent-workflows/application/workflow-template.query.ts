import { Query } from "@nestjs/cqrs"
import type { TemplateWire } from "@modules/domain/agent-graphs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { WorkflowTemplateRequest } from "./workflow-template.contracts"

/** Reads one workflow template with its versions, what it needs and the graph of its newest version. */
export class WorkflowTemplateQuery extends Query<TemplateWire> {
    constructor(readonly params: ExecuteParams<WorkflowTemplateRequest>) {
        super()
    }
}
