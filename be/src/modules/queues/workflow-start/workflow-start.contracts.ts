import { isRecord } from "@modules/platform/primitives"

/** The queue name: the contract between a person's start of a workflow (in every app that offers it) and the api's delivery of it. */
export const WORKFLOW_START_QUEUE = "workflow_start"

/** The jobs of the workflow-start queue; the value is the job name inside the queue. */
export enum WorkflowStartJob {
    /** A person started a workflow by hand: the api hands the call to the one event pipeline (`deliver`). */
    Deliver = "workflow-start.deliver",
}

/** The payload of a deliver job: one person's start of one workflow of one agent, already allowed and checked against its contract. */
export interface WorkflowStartPayload {
    /** The workspace of the agent. */
    readonly workspaceId: string
    /** The installation's agent the workflow belongs to. */
    readonly agentId: string
    /** The member who started it. */
    readonly memberId: string
    /** The key of the workflow within the agent: the call's pin. */
    readonly workflowKey: string
    /** The once-key of the start (the person and their opKey): the event's id. */
    readonly key: string
    /** The inputs, as the workflow's declared contract takes them: the event's data. */
    readonly inputs: Readonly<Record<string, unknown>>
}

/** True when a job payload is the payload of a deliver job. */
export const isWorkflowStartPayload = (value: unknown): value is WorkflowStartPayload =>
    isRecord(value) &&
    ["workspaceId", "agentId", "memberId", "workflowKey", "key"].every((key) => typeof value[key] === "string") &&
    isRecord(value.inputs)

/** The once-key of one start: the person and their opKey, so the same start written twice is one job and one event. */
export const workflowStartKeyOf = (principalId: string, opKey: string): string => `workflow-run:${principalId}:${opKey}`
