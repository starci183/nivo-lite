import { defineJob, doorPort, retryJob, type DoorApi, type JobDefinition } from "@nivo-lite/agent-sdk/mutation"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"

/** The name of the job that posts the report of a finished run to the chat. */
export const POST_REPORT_JOB = "platform.post-report"

/** The name of the job that posts the approval card of a decision to the chat. */
export const POST_APPROVAL_JOB = "platform.post-approval"

/** The door tool of the chat the two jobs call. */
export const CHAT_POST_REPORT_TOOL = "team-chat.post-report"

/** The door tool of the chat that writes the approval cards. */
export const CHAT_POST_APPROVAL_TOOL = "team-chat.post-approval"

/** How many times the queue delivers either job before it is parked. */
const POST_ATTEMPTS = 6

const id = z.string().min(1).max(MAX_ID)

/** The input of the report job: the run that ended and the agent that ran it, ids and the trigger name only. */
export const POST_REPORT_INPUT: z.ZodObject<{ runId: z.ZodString; agentId: z.ZodString; trigger: z.ZodString }> =
    z.object({ runId: id, agentId: id, trigger: id })

/** The input of the approval job: the decision whose card is posted; the chat reads the request and its rule itself. */
export const POST_APPROVAL_INPUT: z.ZodObject<{ decisionId: z.ZodString }> = z.object({ decisionId: id })

/** The ports both jobs run on: the door out of the system. */
export interface PostPorts {
    /** The door. */
    readonly door: DoorApi
}

/** Says through the door tool; a transient answer has the queue deliver it again, any other answer ends the job (the chat refuses as data). */
const postThrough = async (
    ports: PostPorts,
    job: string,
    tool: `${string}.${string}`,
    input: Readonly<Record<string, JsonValue>>,
): Promise<void> => {
    const result = await ports.door.call(tool, input)
    if (!result.ok && result.reason === "transient") retryJob(job)
}

/** The declared job: posts the report of one finished run; the chat keeps one report per run, so a retry writes it once. */
export const POST_REPORT: JobDefinition<typeof POST_REPORT_INPUT, { readonly door: typeof doorPort }> = defineJob({
    name: POST_REPORT_JOB,
    input: POST_REPORT_INPUT,
    ports: { door: doorPort },
    attempts: POST_ATTEMPTS,
    run: (ports, input) => postThrough(ports, POST_REPORT_JOB, CHAT_POST_REPORT_TOOL, input),
})

/** The declared job: posts the approval card of one decision to the rooms its rule names; one card per decision per room. */
export const POST_APPROVAL: JobDefinition<typeof POST_APPROVAL_INPUT, { readonly door: typeof doorPort }> = defineJob({
    name: POST_APPROVAL_JOB,
    input: POST_APPROVAL_INPUT,
    ports: { door: doorPort },
    attempts: POST_ATTEMPTS,
    run: (ports, input) => postThrough(ports, POST_APPROVAL_JOB, CHAT_POST_APPROVAL_TOOL, input),
})

/** The jobs of the platform module. */
export const PLATFORM_JOBS: ReadonlyArray<JobDefinition> = [POST_REPORT, POST_APPROVAL]
