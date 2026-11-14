import { Test } from "@nestjs/testing"
import { addsOverBound, inForceLockKey } from "./in-force.policy"

const SUBJECT = Symbol("in-force.policy")
const BOUND = { truths: 100, bytes: 10_000 }

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { addsOverBound, inForceLockKey } }],
    }).compile()
    return moduleRef.get<{ addsOverBound: typeof addsOverBound; inForceLockKey: typeof inForceLockKey }>(SUBJECT)
}

describe("in-force.policy: a bounded write and the bound", () => {
    it.each([
        ["reaches the bound exactly", { truths: 99, bytes: 9_000 }, { truths: 100, bytes: 10_000 }, false],
        ["adds the truth that goes over the count", { truths: 100, bytes: 9_000 }, { truths: 101, bytes: 9_100 }, true],
        ["adds the bytes that go over the text bound", { truths: 50, bytes: 9_990 }, { truths: 51, bytes: 10_001 }, true],
        ["adds nothing in a workspace already above (a founder took it there)", { truths: 140, bytes: 12_000 }, { truths: 140, bytes: 12_000 }, false],
        ["takes away from what is in force", { truths: 140, bytes: 12_000 }, { truths: 139, bytes: 11_900 }, false],
        ["adds one truth to a workspace already above", { truths: 140, bytes: 9_000 }, { truths: 141, bytes: 9_100 }, true],
        ["replaces a value by a longer one above the text bound", { truths: 60, bytes: 10_000 }, { truths: 60, bytes: 10_040 }, true],
        ["replaces a value by a longer one under both bounds", { truths: 60, bytes: 5_000 }, { truths: 60, bytes: 5_040 }, false],
    ])("a write that %s", async (_what, before, after, refused) => {
        const subject = await build()

        expect(subject.addsOverBound(before, after, BOUND)).toBe(refused)
    })

    it("locks per workspace", async () => {
        const subject = await build()

        expect(subject.inForceLockKey("ws-a")).toBe("brain-facts.in-force:ws-a")
        expect(subject.inForceLockKey("ws-a")).not.toBe(subject.inForceLockKey("ws-b"))
    })
})
