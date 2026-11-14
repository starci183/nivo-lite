import { Query } from "@nestjs/cqrs"
import type { WorkflowStartView } from "@modules/domain/agent-graphs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RunnableWorkflowRequest } from "./run-workflow.contracts"

/** Whether a person may start one workflow, and the JSON Schema of its declared input. */
export class RunnableWorkflowQuery extends Query<WorkflowStartView> {
    constructor(readonly params: ExecuteParams<RunnableWorkflowRequest>) {
        super()
    }
}
