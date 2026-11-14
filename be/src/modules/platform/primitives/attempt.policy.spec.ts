import { Test } from "@nestjs/testing"
import { TestWorldError, TestWorldErrorCode } from "@tests/world/test-world.error"
import { attempt, attemptAsync } from "./attempt.policy"

const SUBJECT = Symbol("attempt.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { attempt, attemptAsync } }],
    }).compile()
    return moduleRef.get<typeof import("./attempt.policy")>(SUBJECT)
}

describe("attempt", () => {
    it("answers the value of a step that ran", async () => {
        const subject = await build()

        expect(subject.attempt(() => 42)).toEqual({ ok: true, value: 42 })
    })

    it("answers the thrown error as the cause of a step that threw", async () => {
        const subject = await build()
        const cause = new TestWorldError({ code: TestWorldErrorCode.ProviderDown, params: { what: "a bad zone" } })

        expect(
            subject.attempt(() => {
                throw cause
            }),
        ).toEqual({ ok: false, cause })
    })

    it("answers the value of an asynchronous step that resolved", async () => {
        const subject = await build()

        await expect(subject.attemptAsync(() => Promise.resolve(7))).resolves.toEqual({ ok: true, value: 7 })
    })

    it("answers the rejection of an asynchronous step as the cause", async () => {
        const subject = await build()
        const cause = new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { what: "a closed step" } })

        await expect(subject.attemptAsync(() => Promise.reject(cause))).resolves.toEqual({ ok: false, cause })
    })
})
