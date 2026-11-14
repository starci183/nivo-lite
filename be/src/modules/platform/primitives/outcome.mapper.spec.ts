import { Test } from "@nestjs/testing"
import { DomainError } from "@modules/platform/errors"
import { ok, refused, unwrapOutcome } from "./outcome.mapper"

/** A partial-object matcher, typed `unknown` so it flows into any slot. */
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

/** What `run` throws, read as `unknown`; the matcher then judges its fields. */
const thrownBy = (run: () => unknown): unknown => {
    try {
        run()
    } catch (error) {
        return error
    }
    return undefined
}
const SUBJECT = Symbol("outcome.mapper")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { ok, refused, unwrapOutcome } }],
    }).compile()
    return moduleRef.get<typeof import("./outcome.mapper")>(SUBJECT)
}

type CapabilityErrorCode = "CAPABILITY_REFUSED"

class CapabilityError extends DomainError<CapabilityErrorCode> {}

describe("outcome mappers", () => {
    describe("ok", () => {
        it("wraps the produced value as a success", async () => {
            const subject = await build()

            const value = { id: "value-1" }

            expect(subject.ok(value)).toEqual({ kind: "ok", value })
        })
    })

    describe("refused", () => {
        it("wraps the capability code and display parameters as a refusal", async () => {
            const subject = await build()

            expect(subject.refused("CAPABILITY_REFUSED", { resource: "value-1" })).toEqual({
                kind: "refused",
                code: "CAPABILITY_REFUSED",
                params: { resource: "value-1" },
            })
        })

        it("keeps display parameters optional", async () => {
            const subject = await build()

            expect(subject.refused("CAPABILITY_REFUSED")).toEqual({
                kind: "refused",
                code: "CAPABILITY_REFUSED",
                params: undefined,
            })
        })
    })

    describe("a refusal with a cause", () => {
        it("keeps the failure that caused it, and the thrown error carries it as its cause", async () => {
            const subject = await build()
            const failure = new RangeError("bad bytes")

            const outcome = subject.refused<CapabilityErrorCode>("CAPABILITY_REFUSED", undefined, failure)

            expect(outcome).toEqual({ kind: "refused", code: "CAPABILITY_REFUSED", params: undefined, cause: failure })
            expect(thrownBy(() => subject.unwrapOutcome(outcome, CapabilityError))).toEqual(
                objectLike({ name: "CapabilityError", cause: failure }),
            )
        })

        it("has no cause key when no failure is given", async () => {
            const subject = await build()

            expect(Object.keys(subject.refused("CAPABILITY_REFUSED"))).not.toContain("cause")
        })
    })

    describe("unwrapOutcome", () => {
        it("returns the value of a successful outcome", async () => {
            const subject = await build()

            expect(subject.unwrapOutcome(subject.ok("value-1"), CapabilityError)).toBe("value-1")
        })

        it("turns a refusal into the capability error with its parameters", async () => {
            const subject = await build()

            const outcome = subject.refused<CapabilityErrorCode>("CAPABILITY_REFUSED", { resource: "value-1" })

            expect(thrownBy(() => subject.unwrapOutcome(outcome, CapabilityError))).toEqual(
                objectLike({
                    name: "CapabilityError",
                    code: "CAPABILITY_REFUSED",
                    params: { resource: "value-1" },
                }),
            )
        })
    })
})
