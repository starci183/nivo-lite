import { Test } from "@nestjs/testing"
import { dayText, instantOf, automationIsoOf, isoOrNull, vndText } from "./format.policy"

const POLICY = Symbol("./format.policy")
type PolicySubject = {
    vndText: typeof vndText
    instantOf: typeof instantOf
    automationIsoOf: typeof automationIsoOf
    isoOrNull: typeof isoOrNull
    dayText: typeof dayText
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: POLICY, useValue: { vndText, instantOf, automationIsoOf, isoOrNull, dayText } }],
    }).compile()
    return moduleRef.get<PolicySubject>(POLICY)
}

describe("vndText", () => {
    it("writes an amount of dong with the thousands separator of Vietnam", async () => {
        const subject = await buildSubject()

        expect(subject.vndText(350000).replace(/\s/gu, " ")).toBe("350.000 ₫")
    })

    it("writes nothing for a missing amount", async () => {
        const subject = await buildSubject()

        expect(subject.vndText(null)).toBe("")
        expect(subject.vndText(undefined)).toBe("")
    })
})

describe("instants", () => {
    it("reads a timestamp that came as text or as a date", async () => {
        const subject = await buildSubject()

        expect(subject.instantOf("2026-10-12T10:00:00.000Z")).toBe(Date.parse("2026-10-12T10:00:00.000Z"))
        expect(subject.instantOf(new Date("2026-10-12T10:00:00.000Z"))).toBe(Date.parse("2026-10-12T10:00:00.000Z"))
    })

    it("writes a timestamp as ISO text", async () => {
        const subject = await buildSubject()

        expect(subject.automationIsoOf("2026-10-12T10:00:00Z")).toBe("2026-10-12T10:00:00.000Z")
        expect(subject.automationIsoOf(new Date("2026-10-12T10:00:00.000Z"))).toBe("2026-10-12T10:00:00.000Z")
    })

    it("writes none for no timestamp", async () => {
        const subject = await buildSubject()

        expect(subject.isoOrNull(null)).toBeNull()
        expect(subject.isoOrNull("2026-10-12T10:00:00Z")).toBe("2026-10-12T10:00:00.000Z")
    })
})

describe("dayText", () => {
    it("turns an ISO day into dd/mm/yyyy", async () => {
        const subject = await buildSubject()

        expect(subject.dayText("2026-10-12")).toBe("12/10/2026")
    })
})
