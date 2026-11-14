import { DomainError } from "@starci/common"
import type { JsonValue } from "../schema/schema.types"
import type { DoorCallResult, DoorTool } from "./door-port"
import { retryJob } from "./job-retry"

/**
 * Thrown by the run of a declared job whose door call was refused for good (no such tool, input invalid, not allowed, the provider
 * failed): the job processor does not retry it, it parks the job with one alert to the owner. `params.at` names the tool and the refusal.
 */
export class JobRefused extends DomainError<"JOB_REFUSED"> {
    constructor(code: "JOB_REFUSED", at: string, options?: ErrorOptions) {
        super({ code, params: { at }, cause: options?.cause })
    }
}

/**
 * Ends a job that called a door tool the way the call went: nothing to do when it returned output, the queue delivers the job again
 * (with its backoff, and a park with one alert once the attempts are spent) when the provider was away for now, and any other
 * failure is a `JobRefused` the runner parks. `job` names the job. It answers the output of a call that returned one, so a job reads
 * the output from what this returns and never from a call it has not checked.
 */
export const endAfterDoor = (job: string, tool: DoorTool, call: DoorCallResult): JsonValue => {
    if (call.ok) return call.output
    if (call.reason === "transient") retryJob(job)
    throw new JobRefused("JOB_REFUSED", `${tool} ${call.reason}`, { cause: call.message })
}
