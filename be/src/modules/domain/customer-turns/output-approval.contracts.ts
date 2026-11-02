import type { WorkSpec } from "@modules/domain/decisions"
import type { HeldCall, OutputScope } from "./output-steps.schema"

/** The run that holds the exact calls until a person answers the work item. */
export interface OutputApprovalWait {
    /** The wake whose run waits. */
    readonly wakeId: string
    /** The calls the person is asked to approve. */
    readonly calls: ReadonlyArray<HeldCall>
    /** The conversation and graph nodes of the output. */
    readonly scope: OutputScope
}

/** An approval request, with its durable run wait when it came from the core road. */
export interface OutputApprovalRequest {
    /** The work that the policy gate puts before a person. */
    readonly spec: WorkSpec
    /** The run waiting on the item, or null on the legacy road. */
    readonly wait: OutputApprovalWait | null
}
