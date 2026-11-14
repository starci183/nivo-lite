import type { WorkflowStartAnswer, WorkflowStartView } from "@modules/domain/agent-graphs"
import type { RunWorkflowRequest } from "../../application/run-workflow.contracts"
import type { RunWorkflowInput } from "./dto/run-workflow.input"
import type { RunnableWorkflowType, WorkflowRunType } from "./dto/workflow-run.type"

/** The start request of a runWorkflow input. */
export const toRunWorkflowRequest = (workspaceId: string, input: RunWorkflowInput): RunWorkflowRequest => ({
    workspaceId,
    installationId: input.installationId,
    workflowId: input.workflowId,
    inputs: input.inputs,
    opKey: input.opKey,
})

/** A start's answer as the GraphQL type. */
export const toWorkflowRunType = (answer: WorkflowStartAnswer): WorkflowRunType => ({
    status: answer.status,
    refusal: answer.refusal,
    issues: answer.issues.map((issue) => ({ at: issue.at, code: issue.code })),
})

/** Whether a workflow may be started, as the GraphQL type (the schema as JSON text). */
export const toRunnableWorkflowType = (view: WorkflowStartView): RunnableWorkflowType => ({
    workflowId: view.workflowId,
    key: view.key,
    name: view.name,
    status: view.status,
    runnable: view.runnable,
    refusal: view.refusal,
    inputSchemaJson: view.inputSchemaJson,
})
