import { invokeJob } from "./invoke-job"
import { bumpJob, calls, failingJob, jobContext, provider } from "./invoke.fixture"

describe("invokeJob", () => {
    it("runs the job over its ports on a sound payload", async () => {
        const id = "0d9e5a64-3f6a-4f0b-9a54-3d1a7a0b8c11"
        expect(await invokeJob(bumpJob, provider, { id }, jobContext)).toEqual({ ok: true })
        expect(calls).toEqual([`${id}:7:k:bump`])
    })

    it("answers a refused payload as invalid and runs nothing", async () => {
        const before = calls.length
        expect(await invokeJob(bumpJob, provider, { id: "x", extra: 1 }, jobContext)).toEqual({
            ok: false,
            reason: "invalid",
            problems: [
                { code: "INPUT_UNKNOWN_KEY", at: "extra" },
                { code: "INPUT_INVALID", at: "id" },
            ],
        })
        expect(calls).toHaveLength(before)
    })

    it("throws a failure of the run unchanged, for the processor to classify", async () => {
        await expect(invokeJob(failingJob, provider, {}, jobContext)).rejects.toThrow("transient")
    })
})
