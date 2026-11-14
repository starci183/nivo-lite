import { Test } from "@nestjs/testing"
import { byDateNewestFirst, carriesXml, datedFrom, fixedInstantOf, isRowId } from "./data-records-read.policy"

const SUBJECT = Symbol("data-records-read.policy")

/** The policy's functions as the spec reads them, through the testing module. */
interface Subject {
    readonly byDateNewestFirst: typeof byDateNewestFirst
    readonly carriesXml: typeof carriesXml
    readonly datedFrom: typeof datedFrom
    readonly fixedInstantOf: typeof fixedInstantOf
    readonly isRowId: typeof isRowId
}

const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { byDateNewestFirst, carriesXml, datedFrom, fixedInstantOf, isRowId } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("data-records-read.policy", () => {
    it("writes an instant fixed-width in UTC with microseconds, whatever form Postgres or an ISO gave", async () => {
        const { fixedInstantOf } = await build()
        expect(fixedInstantOf("2026-11-11 10:00:00.123456+00")).toBe("2026-11-11T10:00:00.123456Z")
        expect(fixedInstantOf("2026-11-11 10:00:00.12+00")).toBe("2026-11-11T10:00:00.120000Z")
        expect(fixedInstantOf("2026-11-11 10:00:00+00")).toBe("2026-11-11T10:00:00.000000Z")
        expect(fixedInstantOf("2026-11-11 17:00:00.5+07")).toBe("2026-11-11T10:00:00.500000Z")
        expect(fixedInstantOf("2026-11-11 15:30:00.5+05:30")).toBe("2026-11-11T10:00:00.500000Z")
        expect(fixedInstantOf("2026-11-11T10:00:00.123Z")).toBe("2026-11-11T10:00:00.123000Z")
        expect(fixedInstantOf("not an instant")).toBe("not an instant")
    })

    it("makes code-unit order time order where the Postgres text is not (a session in another time zone)", async () => {
        const { fixedInstantOf } = await build()
        const utc = "2026-11-11 09:00:00+00"
        const hanoi = "2026-11-11 10:00:00+07"
        expect(hanoi > utc).toBe(true)
        expect(fixedInstantOf(hanoi) < fixedInstantOf(utc)).toBe(true)
    })

    it("tells a mail with an XML attachment, a row id, a date from a day on and the newest-first order", async () => {
        const { byDateNewestFirst, carriesXml, datedFrom, isRowId } = await build()
        expect(carriesXml({ attachments: [{ name: "a.xml", xml: "<x/>" }] })).toBe(true)
        expect(carriesXml({ attachments: [{ name: "a.pdf" }] })).toBe(false)
        expect(carriesXml({})).toBe(false)
        expect(isRowId("11111111-1111-4111-8111-111111111111")).toBe(true)
        expect(isRowId("rec-1")).toBe(false)
        expect(datedFrom({ date: "2026-10-01T00:00:00.000Z" }, "2026-10-01")).toBe(true)
        expect(datedFrom({ date: "2026-09-30T23:59:59.000Z" }, "2026-10-01")).toBe(false)
        expect(datedFrom({}, "2026-10-01")).toBe(false)
        const order = [{ value: {} }, { value: { date: "2026-01-01T00:00:00.000Z" } }, { value: { date: "2026-02-01T00:00:00.000Z" } }]
        expect(order.toSorted(byDateNewestFirst).map((mail) => mail.value)).toEqual([
            { date: "2026-02-01T00:00:00.000Z" },
            { date: "2026-01-01T00:00:00.000Z" },
            {},
        ])
    })
})
