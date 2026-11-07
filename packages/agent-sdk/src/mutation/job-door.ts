import { SdkError } from "../sdk-error"
import type { DoorCallResult, DoorTool } from "./door-port"
import { retryJob } from "./job-retry"

/**
 * Thrown by the run of a declared job whose door call was refused for good (no such tool, input invalid, not allowed, the provider
 * failed): the job processor does not retry it, it parks the job with one alert to the owner. `at` names the tool and the refusal.
 */
export class JobRefused extends SdkError<"JOB_REFUSED"> {}

/**
 * Ends a job that called a door tool the way the call went: nothing to do when it returned output, the queue delivers the job again
 * (with its backoff, and a park with one alert once the attempts are spent) when the provider was away for now, and any other
 * failure is a `JobRefused` the runner parks. `job` names the job. It returns only for a call that returned output, so the call is
 * narrowed to its output afterwards.
 */
export const endAfterDoor: (
    job: string,
    tool: DoorTool,
    call: DoorCallResult,
) => asserts call is Extract<DoorCallResult, { readonly ok: true }> = (job, tool, call) => {
    if (call.ok) return
    if (call.reason === "transient") retryJob(job)
    throw new JobRefused("JOB_REFUSED", `${tool} ${call.reason}`, { cause: call.message })
}
