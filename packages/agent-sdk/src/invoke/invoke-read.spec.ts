import { invokeRead } from "./invoke-read"
import { context, countRead, doorProvider, failingRead, hostRead, provider, strayRead } from "./invoke.fixture"

describe("invokeRead", () => {
    it("returns the data of a read that runs over its ports", async () => {
        expect(await invokeRead(countRead, provider, {}, context)).toEqual({ ok: true, data: 7 })
    })

    it("reports the problems of variables it refuses", async () => {
        expect(await invokeRead(countRead, provider, { by: 1 }, context)).toEqual({
            ok: false,
            reason: "invalid",
            problems: [{ code: "INPUT_INVALID", at: "by" }],
        })
    })

    it("answers a read of a host operation as failed with INVOKE_NOT_PACKAGE", async () => {
        expect(await invokeRead(hostRead, provider, {}, context)).toEqual({
            ok: false,
            reason: "failed",
            code: "INVOKE_NOT_PACKAGE",
            at: "demo.host",
        })
    })

    it("maps an unprovided port to a failed result", async () => {
        expect(await invokeRead(strayRead, provider, {}, context)).toEqual({
            ok: false,
            reason: "failed",
            code: "PORT_UNPROVIDED",
            at: "engine.door",
        })
    })

    it("runs a read once its port is provided", async () => {
        expect(await invokeRead(strayRead, doorProvider, {}, context)).toEqual({ ok: true, data: 1 })
    })

    it("maps a port the provider lacks to a failed result", async () => {
        const result = await invokeRead(countRead, doorProvider, {}, context)
        expect(result).toEqual({ ok: false, reason: "failed", code: "PORT_UNPROVIDED", at: "demo.counter" })
    })

    it("lets any other thrown error propagate", async () => {
        await expect(invokeRead(failingRead, provider, {}, context)).rejects.toThrow("bug")
    })
})
