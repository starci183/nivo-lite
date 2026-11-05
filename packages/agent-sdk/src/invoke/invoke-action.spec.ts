import { invokeAction } from "./invoke-action"
import {
    bumpAction,
    context,
    doorProvider,
    failingAction,
    hostAction,
    plainDoorAction,
    provider,
    transactionalDoorAction,
} from "./invoke.fixture"

const failedData = (result: Awaited<ReturnType<typeof invokeAction>>): unknown =>
    !result.ok && result.reason === "failed" ? result.data : undefined

describe("invokeAction", () => {
    it("returns the result of an action that runs over its ports", async () => {
        expect(await invokeAction(bumpAction, provider, { id: "a" }, context)).toEqual({ ok: true, data: 7 })
    })

    it("answers a refused payload as invalid", async () => {
        const result = await invokeAction(bumpAction, provider, { id: "a", extra: 1 }, context)
        expect(!result.ok && result.reason).toBe("invalid")
    })

    it("answers an action of a host operation as failed with INVOKE_NOT_PACKAGE", async () => {
        expect(failedData(await invokeAction(hostAction, provider, {}, context))).toEqual({
            code: "INVOKE_NOT_PACKAGE",
            at: "demo.host-action",
        })
    })

    it("refuses an external port inside a transactional action", async () => {
        expect(failedData(await invokeAction(transactionalDoorAction, provider, { id: "a" }, context))).toEqual({
            code: "INVOKE_EXTERNAL_IN_TX",
            at: "demo.door-tx",
        })
    })

    it("maps an unprovided port of a non-transactional action to a failed result", async () => {
        expect(failedData(await invokeAction(plainDoorAction, provider, { id: "a" }, context))).toEqual({
            code: "PORT_UNPROVIDED",
            at: "engine.door",
        })
    })

    it("runs a non-transactional action that uses the door", async () => {
        expect(await invokeAction(plainDoorAction, doorProvider, { id: "a" }, context)).toEqual({ ok: true })
    })

    it("lets any other thrown error propagate", async () => {
        await expect(invokeAction(failingAction, provider, { id: "a" }, context)).rejects.toThrow("bug")
    })
})
