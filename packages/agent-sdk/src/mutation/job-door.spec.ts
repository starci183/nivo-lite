import type { DoorCallResult } from "./door-port"
import { JobRefused, endAfterDoor } from "./job-door"
import { JobRetry } from "./job-retry"

/** What `endAfterDoor` throws for a call, or null when it throws nothing. */
const thrownFor = (call: DoorCallResult): unknown => {
    try {
        endAfterDoor("a.job", "nivo.chat.send", call)
        return null
    } catch (cause) {
        return cause
    }
}

describe("endAfterDoor", () => {
    it("does nothing when the door returned output, and answers that output", () => {
        expect(thrownFor({ ok: true, output: null })).toBeNull()
        expect(endAfterDoor("a.job", "nivo.chat.send", { ok: true, output: { ref: "r1" } })).toEqual({ ref: "r1" })
    })

    it("has the queue deliver the job again when the provider was away", () => {
        expect(thrownFor({ ok: false, reason: "transient", message: "503" })).toBeInstanceOf(JobRetry)
    })

    it("throws a refusal naming the tool and the reason for any other failure, so the runner parks the job", () => {
        const thrown = thrownFor({ ok: false, reason: "forbidden", message: "403" })
        expect(thrown).toBeInstanceOf(JobRefused)
        expect(thrown).not.toBeInstanceOf(JobRetry)
        expect(thrown).toMatchObject({
            code: "JOB_REFUSED",
            at: "nivo.chat.send forbidden",
            cause: "403",
            message: "JOB_REFUSED: nivo.chat.send forbidden",
            name: "JobRefused",
        })
    })
})
