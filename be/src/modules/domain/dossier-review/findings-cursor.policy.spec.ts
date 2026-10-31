import { Test } from "@nestjs/testing"
import { DossierReviewErrorCode } from "./errors/dossier-review.error"
import { cursorOf, findingPageOf, scopeOf, severityRank } from "./findings-cursor.policy"

const SUBJECT = Symbol("findings-cursor.policy")
type Subject = {
    cursorOf: typeof cursorOf
    findingPageOf: typeof findingPageOf
    scopeOf: typeof scopeOf
    severityRank: typeof severityRank
}
const subjectOf = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { cursorOf, findingPageOf, scopeOf, severityRank } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const ID = "11111111-1111-4111-8111-111111111111"
const AT = "2026-10-31T10:00:00.000Z"
const encoded = (body: unknown): string => Buffer.from(JSON.stringify(body)).toString("base64url")

const thrownBy = (read: () => unknown): unknown => {
    try {
        read()
    } catch (error) {
        return error
    }
    return null
}

describe("severityRank", () => {
    it.each([
        ["critical", 0],
        ["high", 1],
        ["medium", 2],
        ["low", 3],
    ] as const)("ranks %s as %d", async (severity, rank) => {
        const subject = await subjectOf()
        expect(subject.severityRank(severity)).toBe(rank)
    })
})

describe("scopeOf", () => {
    it("is the same for the same filters in any order and differs for another filter or workspace", async () => {
        const subject = await subjectOf()
        const one = subject.scopeOf("w1", { statuses: ["open", "confirmed"], severities: ["high", "low"] })
        const same = subject.scopeOf("w1", { statuses: ["confirmed", "open"], severities: ["low", "high"] })

        expect(one).toBe(same)
        expect(one).toMatch(/^dossier-findings:[\da-f]{24}$/u)
        expect(subject.scopeOf("w2", {})).not.toBe(subject.scopeOf("w1", {}))
        expect(
            subject.scopeOf("w1", { dossierId: "d1", assigneeId: "m1", unassigned: true, draftsAwaiting: false }),
        ).not.toBe(subject.scopeOf("w1", {}))
    })
})

describe("findingPageOf", () => {
    it("reads 50 from the first page by default", async () => {
        const subject = await subjectOf()
        expect(subject.findingPageOf({}, "s")).toEqual({ first: 50, after: null, scope: "s" })
        expect(subject.findingPageOf({ first: null, after: null }, "s")).toEqual({ first: 50, after: null, scope: "s" })
    })

    it("reads back the position of a cursor it handed out", async () => {
        const subject = await subjectOf()
        const cursor = subject.cursorOf({ rank: 1, at: AT, id: ID }, "s")

        expect(subject.findingPageOf({ first: 10, after: cursor }, "s")).toEqual({
            first: 10,
            after: { rank: 1, at: AT, id: ID },
            scope: "s",
        })
    })

    it.each([0, 101, 1.5])("refuses a page size of %p", async (first) => {
        const subject = await subjectOf()
        expect(thrownBy(() => subject.findingPageOf({ first }, "s"))).toMatchObject({
            code: DossierReviewErrorCode.PageInvalid,
            params: { fields: "first" },
        })
    })

    it.each([
        ["too long", "a".repeat(2049)],
        ["not base64url", "a+b"],
        ["not JSON", Buffer.from("{").toString("base64url")],
        ["not a record", encoded(5)],
        ["of another version", encoded({ v: 2, scope: "s", rank: 0, at: AT, id: ID })],
        ["of another scope", encoded({ v: 1, scope: "t", rank: 0, at: AT, id: ID })],
        ["with a rank that is not a number", encoded({ v: 1, scope: "s", rank: "0", at: AT, id: ID })],
        ["with a fractional rank", encoded({ v: 1, scope: "s", rank: 0.5, at: AT, id: ID })],
        ["with a negative rank", encoded({ v: 1, scope: "s", rank: -1, at: AT, id: ID })],
        ["with a rank past low", encoded({ v: 1, scope: "s", rank: 4, at: AT, id: ID })],
        ["with an instant that is not text", encoded({ v: 1, scope: "s", rank: 0, at: 5, id: ID })],
        ["with an instant that is no date", encoded({ v: 1, scope: "s", rank: 0, at: "soon", id: ID })],
        ["with an id that is not text", encoded({ v: 1, scope: "s", rank: 0, at: AT, id: 5 })],
        ["with an id that is no uuid", encoded({ v: 1, scope: "s", rank: 0, at: AT, id: "x" })],
    ])("refuses a cursor %s", async (_case, after) => {
        const subject = await subjectOf()
        expect(thrownBy(() => subject.findingPageOf({ after }, "s"))).toMatchObject({
            code: DossierReviewErrorCode.PageInvalid,
            params: { fields: "after" },
        })
    })
})
