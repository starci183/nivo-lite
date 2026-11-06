import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { PARKED_LOOKED_AT, errorKeyOf, subjectOfContext } from "./parked-runs.policy"

interface Subject {
    readonly subjectOfContext: typeof subjectOfContext
    readonly errorKeyOf: typeof errorKeyOf
    readonly lookedAt: number
}

const SUBJECT = Symbol("parked-runs.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: SUBJECT, useValue: mock<Subject>({ subjectOfContext, errorKeyOf, lookedAt: PARKED_LOOKED_AT }) },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("parked runs policy", () => {
    it("reads the subject the trigger of a run names", async () => {
        const policy = await build()
        expect(policy.subjectOfContext({ subject: { kind: "sales.order", id: "o1" } })).toEqual({
            kind: "sales.order",
            id: "o1",
        })
    })

    it("reads empty texts when the trigger names no subject or names it badly", async () => {
        const policy = await build()
        const none = { kind: "", id: "" }
        expect(policy.subjectOfContext({})).toEqual(none)
        expect(policy.subjectOfContext(null)).toEqual(none)
        expect(policy.subjectOfContext([1])).toEqual(none)
        expect(policy.subjectOfContext({ subject: { kind: 3 } })).toEqual(none)
    })

    it("keys the words of a failure code and looks at a hundred runs", async () => {
        const policy = await build()
        expect(policy.errorKeyOf("X")).toBe("errors.X")
        expect(policy.lookedAt).toBe(100)
    })
})
