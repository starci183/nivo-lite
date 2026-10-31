import { Test } from "@nestjs/testing"
import { TRUST_THRESHOLD } from "../agent-graphs.contracts"
import type { ClosedDecision } from "../agent-graphs.contracts"
import { REJECT_HITS, TIMEOUT_HITS, learnSignals } from "./learn-signals.policy"

/** The members of the subject under test. */
interface Subject {
    readonly learnSignals: typeof learnSignals
}

const SUBJECT = Symbol("learn-signals.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { learnSignals } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const decisions = (
    count: number,
    closedAs: ClosedDecision["closedAs"],
    branchKey = "middle",
    from = 0,
): Array<ClosedDecision> =>
    Array.from({ length: count }, (_unused, index) => ({
        id: `d${from + index}`,
        branchKey,
        closedAs,
        amount: 6_000_000,
    }))

describe("learn-signals.policy", () => {
    it("proposes nothing below every threshold", async () => {
        const subject = await build()

        expect(subject.learnSignals([])).toEqual([])
        expect(subject.learnSignals(decisions(TRUST_THRESHOLD - 1, "approved"))).toEqual([])
        expect(subject.learnSignals(decisions(REJECT_HITS - 1, "rejected"))).toEqual([])
        expect(subject.learnSignals(decisions(TIMEOUT_HITS - 1, "expired"))).toEqual([])
    })

    it("proposes to raise the boundary after twenty approvals in a row, and says it widens", async () => {
        const subject = await build()

        const [proposal] = subject.learnSignals(decisions(TRUST_THRESHOLD, "approved"))

        expect(proposal).toMatchObject({
            signal: "trust",
            branchKey: "middle",
            widens: true,
            dedupeKey: "learned:trust:middle:d0",
        })
        expect(proposal?.evidence).toHaveLength(TRUST_THRESHOLD)
    })

    it("keeps the same dedupe key while the streak grows, so it is raised once", async () => {
        const subject = await build()

        const first = subject.learnSignals(decisions(TRUST_THRESHOLD, "approved"))
        const longer = subject.learnSignals(decisions(TRUST_THRESHOLD + 5, "approved"))

        expect(longer[0]?.dedupeKey).toBe(first[0]?.dedupeKey)
        expect(longer[0]?.evidence).toHaveLength(TRUST_THRESHOLD)
    })

    it("breaks the streak at the first decision that was not an approval", async () => {
        const subject = await build()
        const broken = [
            ...decisions(TRUST_THRESHOLD - 1, "approved"),
            ...decisions(1, "edited", "middle", 50),
            ...decisions(5, "approved", "middle", 60),
        ]

        expect(subject.learnSignals(broken).filter((entry) => entry.signal === "trust")).toEqual([])
    })

    it("proposes a lower boundary when five of the last ten were rejected or edited", async () => {
        const subject = await build()
        const mixed = [
            ...decisions(3, "rejected"),
            ...decisions(2, "edited", "middle", 10),
            ...decisions(5, "approved", "middle", 20),
        ]

        const [proposal] = subject.learnSignals(mixed)

        expect(proposal).toMatchObject({ signal: "reject", widens: false })
        expect(proposal?.evidence).toHaveLength(5)
    })

    it("looks only at the last ten decisions for a rejection and a timeout", async () => {
        const subject = await build()
        const old = [...decisions(5, "rejected"), ...decisions(10, "approved", "middle", 10)]

        expect(subject.learnSignals(old)).toEqual([])
    })

    it("proposes a backup when three of the last ten timed out", async () => {
        const subject = await build()
        const slow = [...decisions(3, "expired"), ...decisions(7, "approved", "middle", 10)]

        expect(subject.learnSignals(slow)).toMatchObject([{ signal: "timeout", branchKey: "middle", widens: false }])
    })

    it("reads each branch on its own and counts a decision closed as done as nothing", async () => {
        const subject = await build()
        const two = [...decisions(TRUST_THRESHOLD, "approved", "a"), ...decisions(TRUST_THRESHOLD, "done", "b", 100)]

        expect(subject.learnSignals(two).map((entry) => entry.branchKey)).toEqual(["a"])
    })
})
