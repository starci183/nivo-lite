import type { JsonValue } from "../schema/schema.types"
import { definePort } from "../port/port"
import type { PortDefinition } from "../port/port.types"

/** The port id of the workflow start: a job wakes a workflow of a module. Never inside a transaction (BE-PERSISTENCE-6). */
export const WORKFLOW_PORT_ID = "engine.workflow"

/** What a job asks to start: the workflow of a module, its version, the inputs the workflow's trigger reads, and the key that makes it happen once. */
export interface WorkflowStart {
    /** The module whose agent runs the workflow (`accounting`). */
    readonly moduleKey: string
    /** The workflow key within that module (`reconcile`). */
    readonly workflow: string
    /** A version number, or `latest`. */
    readonly version: number | "latest"
    /** The inputs, by the name the workflow declares them (ids and plain words). */
    readonly inputs: Readonly<Record<string, JsonValue>>
    /** The same key starts the workflow once, however often the job is delivered. */
    readonly dedupeKey: string
}

/** What a start came to: a run was woken, or this key had already started one. */
export type WorkflowStartResult =
    | { readonly started: true }
    | { readonly started: false; readonly reason: "duplicate" | "no_agent" | "refused" }

/** The api of the workflow port. */
export interface WorkflowApi {
    /** Wakes the workflow exactly as its trigger would, once per `dedupeKey`. */
    start(request: WorkflowStart): Promise<WorkflowStartResult>
}

/** The workflow port declaration a job lists in its ports. */
export const workflowPort: PortDefinition<WorkflowApi> = definePort<WorkflowApi>(WORKFLOW_PORT_ID)
