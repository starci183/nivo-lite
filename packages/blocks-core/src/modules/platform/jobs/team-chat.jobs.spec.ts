import { JobRetry } from "@nivo-lite/agent-sdk/mutation"
import type { DoorApi, DoorCallResult, JobContext } from "@nivo-lite/agent-sdk/mutation"
import {
    CHAT_POST_REPORT_TOOL,
    PLATFORM_JOBS,
    POST_REPORT,
    POST_REPORT_INPUT,
} from "./team-chat.jobs"

const CONTEXT: JobContext = { workspaceId: "w1", attempt: 1, effectKey: (step) => step }

const ID = "11111111-1111-4111-8111-111111111111"

const doorOf = (answer: DoorCallResult) => {
    const calls: Array<{ tool: string; input: unknown }> = []
    const door: DoorApi = {
        call: (tool, input) => {
            calls.push({ tool, input })
            return Promise.resolve(answer)
        },
    }
    return { calls, door }
}

describe("the platform jobs", () => {
    it("declares the report job under the name the outbox enqueues", () => {
        expect(PLATFORM_JOBS.map((job) => job.name)).toEqual(["platform.post-report"])
    })

    it("posts the report through the door tool with the run, the agent and the trigger", async () => {
        const { calls, door } = doorOf({ ok: true, output: {} })
        const input = POST_REPORT_INPUT.parse({ runId: ID, agentId: ID, trigger: "tag" })
        await POST_REPORT.run({ door }, input, CONTEXT)
        expect(calls).toEqual([{ tool: CHAT_POST_REPORT_TOOL, input }])
    })

    it("has the queue deliver it again when the door answers a transient failure, and ends the job on any other refusal", async () => {
        const input = POST_REPORT_INPUT.parse({ runId: ID, agentId: ID, trigger: "tag" })
        const busy = doorOf({ ok: false, reason: "transient", message: "busy" })
        await expect(POST_REPORT.run({ door: busy.door }, input, CONTEXT)).rejects.toBeInstanceOf(JobRetry)
        const refused = doorOf({ ok: false, reason: "failed", message: "not_found" })
        await expect(POST_REPORT.run({ door: refused.door }, input, CONTEXT)).resolves.toBeUndefined()
    })

    it("refuses an input the job does not declare", () => {
        expect(POST_REPORT_INPUT.safeParse({ runId: ID }).success).toBe(false)
    })
})
