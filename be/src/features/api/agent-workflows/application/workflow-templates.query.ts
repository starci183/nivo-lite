import { Query } from "@nestjs/cqrs"
import type { TemplateWire } from "@modules/domain/agent-graphs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { WorkflowTemplatesRequest } from "./workflow-templates.contracts"

/** Lists the workflow templates of the market, of one module or of all. */
export class WorkflowTemplatesQuery extends Query<ReadonlyArray<TemplateWire>> {
    constructor(readonly params: ExecuteParams<WorkflowTemplatesRequest>) {
        super()
    }
}
