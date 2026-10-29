import { Test } from "@nestjs/testing"
import { EventsErrorCode } from "./errors/events.error"
import {
    isAmountOrAbsent,
    isKey,
    isText,
    isTextOrAbsent,
    memberOf,
    openEnvelope,
    whenPresent,
} from "./money-event.policy"

const SUBJECT = Symbol("money-event.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { isAmountOrAbsent, isKey, isText, isTextOrAbsent, memberOf, openEnvelope, whenPresent },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./money-event.policy")>(SUBJECT)
}

describe("openEnvelope", () => {
    it("opens an envelope and leaves a null field off its body, as an absent one", async () => {
        const subject = await build()

        expect(subject.openEnvelope({ eventId: "e-1", payload: { a: "x", b: null } })).toEqual({
            eventId: "e-1",
            body: { a: "x" },
        })
    })

    it.each([
        null,
        "text",
        {},
        { eventId: " ", payload: {} },
        { eventId: "e-1", payload: null },
        { eventId: 1, payload: {} },
    ])("refuses the malformed envelope %j", async (envelope) => {
        const subject = await build()

        expect(subject.openEnvelope(envelope)).toBeNull()
    })
})

describe("field guards", () => {
    it("tells a key, a text, an optional text and an optional amount", async () => {
        const subject = await build()

        expect([subject.isKey("k"), subject.isKey(" "), subject.isKey(1)]).toEqual([true, false, false])
        expect([subject.isText(""), subject.isText(1)]).toEqual([true, false])
        expect([subject.isTextOrAbsent(undefined), subject.isTextOrAbsent("t"), subject.isTextOrAbsent(1)]).toEqual([
            true,
            true,
            false,
        ])
        expect([
            subject.isAmountOrAbsent(undefined),
            subject.isAmountOrAbsent(2),
            subject.isAmountOrAbsent(Number.NaN),
            subject.isAmountOrAbsent("2"),
        ]).toEqual([true, true, false, false])
    })
})

describe("memberOf", () => {
    it("answers the listed value", async () => {
        const subject = await build()

        expect(subject.memberOf(["a", "b"], "b", "kind")).toBe("b")
    })

    it("refuses a value outside the set with the events error naming the field", async () => {
        const subject = await build()

        expect(() => subject.memberOf(["a", "b"], "c", "kind")).toThrow(
            expect.objectContaining({ code: EventsErrorCode.ValueOutsideSet, params: { field: "kind" } }),
        )
    })
})

describe("whenPresent", () => {
    it("holds the field only when it has a value", async () => {
        const subject = await build()

        expect(subject.whenPresent("leadId", "l-1")).toEqual({ leadId: "l-1" })
        expect(subject.whenPresent("leadId", null)).toEqual({})
        expect(subject.whenPresent("leadId", undefined)).toEqual({})
    })
})
