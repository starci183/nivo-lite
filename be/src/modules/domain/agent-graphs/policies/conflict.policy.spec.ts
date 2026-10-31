import { Test } from "@nestjs/testing"
import { conflictOf, valueHashOf } from "./conflict.policy"

/** The members of the subject under test. */
interface Subject {
    readonly conflictOf: typeof conflictOf
    readonly valueHashOf: typeof valueHashOf
}

const SUBJECT = Symbol("conflict.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { conflictOf, valueHashOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const OLD = { id: "fact-1", status: "superseded", value: "Over 5tr ask Dinh" }
const NEWER = { id: "fact-2", status: "active", value: "Over 8tr ask Dinh" }

describe("conflict.policy", () => {
    it("hashes a rule the same however it is spaced or cased", async () => {
        const subject = await build()

        expect(subject.valueHashOf(" Over 5tr ask Dinh ")).toBe(subject.valueHashOf("over 5tr ask dinh"))
        expect(subject.valueHashOf("Over 5tr")).not.toBe(subject.valueHashOf("Over 8tr"))
    })

    it("finds a rule replaced by one that says something else, keyed by the node and the new fact", async () => {
        const subject = await build()

        expect(subject.conflictOf("decide", subject.valueHashOf(OLD.value), OLD, NEWER)).toEqual({
            newFactId: "fact-2",
            newValueHash: subject.valueHashOf(NEWER.value),
            dedupeKey: "conflict:decide:fact-2",
        })
    })

    it("finds nothing while the cited rule is in force, is gone, or has no successor", async () => {
        const subject = await build()
        const hash = subject.valueHashOf(OLD.value)

        expect(subject.conflictOf("decide", hash, { ...OLD, status: "active" }, NEWER)).toBeNull()
        expect(subject.conflictOf("decide", hash, null, NEWER)).toBeNull()
        expect(subject.conflictOf("decide", hash, OLD, null)).toBeNull()
    })

    it("finds nothing when the rule in force says what the owner confirmed", async () => {
        const subject = await build()

        expect(subject.conflictOf("decide", subject.valueHashOf(NEWER.value), OLD, NEWER)).toBeNull()
    })
})
