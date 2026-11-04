import {
    EVIDENCE_WEIGHTS,
    REASON,
    claimKeyOf,
    escalateClaim,
    foldText,
    gatherEvidence,
    hasSignal,
    holds,
    judgeAndEffect,
    mentionsCode,
    mentionsName,
    openClaims,
    openClaimsOf,
    overdueClaims,
    runEffect,
    scoreCandidates,
    settleClaim,
} from "./index"
import type { Arrival, Candidate, Claim, EffectHandlers, Judge, Judgement } from "./index"
import VIETNAMESE from "./vietnamese.fixture.json"

const HOUR = 3_600_000
const OPTIONS = { windowMs: 24 * HOUR }

const arrival = (over: Partial<Arrival> = {}): Arrival => ({
    id: "a1",
    amount: 5000,
    text: "BUI NGUYEN DINH Test sepay Chuyen tien dat chau hoa- Ma GD ACSP/ 7o940",
    names: [],
    at: 100 * HOUR,
    ...over,
})

const candidate = (over: Partial<Candidate> = {}): Candidate => ({
    id: "c1",
    label: "order one",
    amountDue: 5000,
    partyName: VIETNAMESE.partyName,
    partyKey: "lead-1",
    codes: ["ORD-2026-0001"],
    openedAt: 99 * HOUR,
    ...over,
})

const claim = (over: Partial<Claim> = {}): Claim => ({
    id: "k1",
    partyKey: "lead-1",
    amount: 5000,
    names: ["BUI NGUYEN DINH"],
    text: VIETNAMESE.claimText,
    at: 99.5 * HOUR,
    status: "open",
    ...over,
})

const judgeOf = (answer: Judgement | null): jest.MockedFunction<Judge> => jest.fn().mockResolvedValue(answer)

describe("text matching", () => {
    it("folds diacritics, case and separators alike", () => {
        expect(foldText(VIETNAMESE.foldInput)).toBe("bui nguyen dinh d")
    })

    it("names a party as whole words only", () => {
        expect(mentionsName("BUI NGUYEN DINH test", VIETNAMESE.partyName)).toBe(true)
        expect(mentionsName("ADINHB", VIETNAMESE.shortName)).toBe(false)
        expect(mentionsName("anything", "a")).toBe(false)
        expect(mentionsName("anything", null)).toBe(false)
    })

    it("names a code without separators but not a longer number", () => {
        expect(mentionsCode("pay ord 2026 0001 thanks", "ORD-2026-0001")).toBe(true)
        expect(mentionsCode("pay ORD-2026-00011", "ORD-2026-0001")).toBe(false)
        expect(mentionsCode("ORD-2026-00011 and ORD-2026-0001", "ORD-2026-0001")).toBe(true)
        expect(mentionsCode("anything", "")).toBe(false)
    })
})

describe("evidence", () => {
    it("gathers every kind and adds the weights of those that hold", () => {
        const evidenced = gatherEvidence(arrival(), candidate(), [claim()], OPTIONS)
        expect(holds(evidenced, "amount")).toBe(true)
        expect(holds(evidenced, "name")).toBe(true)
        expect(holds(evidenced, "claim")).toBe(true)
        expect(holds(evidenced, "recency")).toBe(true)
        expect(holds(evidenced, "code")).toBe(false)
        const { amount, name, claim: claimWeight, recency } = EVIDENCE_WEIGHTS
        expect(evidenced.score).toBe(amount + name + claimWeight + recency)
    })

    it("reads the counter name, a missing party name, an old candidate and a claim of another amount", () => {
        const counter = gatherEvidence(arrival({ text: "x", names: ["Bui Nguyen Dinh"] }), candidate(), [], OPTIONS)
        expect(holds(counter, "name")).toBe(true)
        const nameless = gatherEvidence(arrival(), candidate({ partyName: null }), [], OPTIONS)
        expect(nameless.evidence.find((one) => one.key === "name")?.detail).toContain("no party name")
        const old = gatherEvidence(arrival(), candidate({ openedAt: 1 * HOUR }), [], OPTIONS)
        expect(holds(old, "recency")).toBe(false)
        const wrong = gatherEvidence(arrival(), candidate(), [claim({ amount: 9000 })], OPTIONS)
        expect(holds(wrong, "claim")).toBe(false)
        const unnamed = gatherEvidence(arrival(), candidate(), [claim({ amount: null })], OPTIONS)
        expect(holds(unnamed, "claim")).toBe(true)
        const settled = gatherEvidence(arrival(), candidate(), [claim({ status: "settled" })], OPTIONS)
        expect(holds(settled, "claim")).toBe(false)
    })

    it("ranks candidates by score and treats recency alone as no signal", () => {
        const [best, other] = scoreCandidates(
            arrival(),
            [candidate({ id: "weak", amountDue: 1, partyName: "Someone Else" }), candidate()],
            [],
            OPTIONS,
        )
        expect(best?.candidate.id).toBe("c1")
        expect(other?.candidate.id).toBe("weak")
        expect(hasSignal(best ?? gatherEvidence(arrival(), candidate(), [], OPTIONS))).toBe(true)
        expect(hasSignal(other ?? gatherEvidence(arrival(), candidate(), [], OPTIONS))).toBe(false)
    })
})

describe("claim ledger", () => {
    const now = 100 * HOUR

    it("keeps open claims, by party, oldest first", () => {
        const claims = [
            claim({ id: "late", at: 3 }),
            claim({ id: "early", at: 1 }),
            claim({ id: "done", status: "settled" }),
        ]
        expect(openClaims(claims).map((one) => one.id)).toEqual(["late", "early"])
        expect(openClaimsOf(claims, "lead-1").map((one) => one.id)).toEqual(["early", "late"])
        expect(openClaimsOf(claims, "lead-2")).toEqual([])
    })

    it("finds the open claims that waited out the timeout", () => {
        const claims = [claim({ id: "old", at: now - 2 * HOUR }), claim({ id: "new", at: now - 1000 })]
        expect(overdueClaims(claims, now, HOUR).map((one) => one.id)).toEqual(["old"])
    })

    it("keys a claim by party, moment and words, and moves only an open claim", () => {
        expect(claimKeyOf("lead-1", 5, " Hello ")).toBe("lead-1:5:hello")
        expect(claimKeyOf(null, 5, "x")).toBe("-:5:x")
        expect(settleClaim(claim()).status).toBe("settled")
        expect(escalateClaim(claim()).status).toBe("escalated")
        expect(escalateClaim(claim({ status: "settled" })).status).toBe("settled")
        expect(settleClaim(claim({ status: "escalated" })).status).toBe("escalated")
    })
})

describe("judgeAndEffect", () => {
    const never = judgeOf(null)

    it("applies a code that names one candidate whose amount is due, without the judge", async () => {
        const outcome = await judgeAndEffect(arrival({ text: "pay ORD-2026-0001" }), [candidate()], [], never, OPTIONS)
        expect(outcome).toMatchObject({ stage: "code", effect: { kind: "apply", candidateId: "c1" } })
        expect(outcome.reasons).toEqual([REASON.codeAndAmount])
        expect(never).not.toHaveBeenCalled()
    })

    it("asks a person when the code names a candidate but the amount differs, or names several", async () => {
        const differs = await judgeAndEffect(
            arrival({ text: "ORD-2026-0001", amount: 4000 }),
            [candidate()],
            [],
            never,
            OPTIONS,
        )
        expect(differs.effect).toEqual({ kind: "ask", candidateIds: ["c1"] })
        expect(differs.reasons).toEqual([REASON.codeAmountDiffers])
        const several = await judgeAndEffect(
            arrival({ text: "ORD-2026-0001 ORD-2026-0002" }),
            [candidate(), candidate({ id: "c2", codes: ["ORD-2026-0002"] })],
            [],
            never,
            OPTIONS,
        )
        expect(several.effect).toEqual({ kind: "ask", candidateIds: ["c1", "c2"] })
        expect(several.reasons).toEqual([REASON.codeAmbiguous])
    })

    it("leaves an arrival no candidate has any evidence for, without the judge", async () => {
        const outcome = await judgeAndEffect(
            arrival({ amount: 2000, text: "Test Sepay MoMo" }),
            [candidate()],
            [claim({ amount: 5000 })],
            never,
            OPTIONS,
        )
        expect(outcome).toMatchObject({ stage: "no_evidence", effect: { kind: "leave" } })
        expect(never).not.toHaveBeenCalled()
    })

    it("applies what the judge matches when the claim came before the money", async () => {
        const judge = judgeOf({ verdict: "match", candidateId: "c1", reasons: ["amount, name and claim agree"] })
        const outcome = await judgeAndEffect(arrival(), [candidate()], [claim()], judge, OPTIONS)
        expect(outcome).toMatchObject({ stage: "judge", effect: { kind: "apply", candidateId: "c1" } })
        expect(outcome.reasons).toEqual(["amount, name and claim agree"])
        const brief = judge.mock.calls[0]?.[0]
        expect(brief?.claims).toHaveLength(1)
        expect(brief?.candidates.map((one) => one.candidate.id)).toEqual(["c1"])
    })

    it("asks a person when the judge is ambiguous, unavailable, unfaithful or the amount differs", async () => {
        const ambiguous = await judgeAndEffect(
            arrival(),
            [candidate(), candidate({ id: "c2", partyName: "Other", codes: [] })],
            [],
            judgeOf({ verdict: "ambiguous", candidateId: null, reasons: ["two fit"] }),
            OPTIONS,
        )
        expect(ambiguous.effect).toEqual({ kind: "ask", candidateIds: ["c1", "c2"] })
        const unavailable = await judgeAndEffect(arrival(), [candidate()], [], never, OPTIONS)
        expect(unavailable).toMatchObject({ stage: "judge_unavailable", effect: { kind: "ask", candidateIds: ["c1"] } })
        const unknown = await judgeAndEffect(
            arrival(),
            [candidate()],
            [],
            judgeOf({ verdict: "match", candidateId: "ghost", reasons: [] }),
            OPTIONS,
        )
        expect(unknown.effect).toEqual({ kind: "ask", candidateIds: ["c1"] })
        const short = await judgeAndEffect(
            arrival({ amount: 4000 }),
            [candidate()],
            [],
            judgeOf({ verdict: "match", candidateId: "c1", reasons: ["name agrees"] }),
            OPTIONS,
        )
        expect(short.effect).toEqual({ kind: "ask", candidateIds: ["c1"] })
        expect(short.reasons).toEqual(["name agrees", REASON.amountDiffers])
    })

    it("leaves an arrival the judge says matches none", async () => {
        const outcome = await judgeAndEffect(
            arrival(),
            [candidate()],
            [],
            judgeOf({ verdict: "no_match", candidateId: null, reasons: ["another person"] }),
            OPTIONS,
        )
        expect(outcome).toMatchObject({ stage: "judge", effect: { kind: "leave" }, reasons: ["another person"] })
    })

    it("runs the handler of the effect", async () => {
        const handlers: EffectHandlers<string> = {
            apply: (id) => Promise.resolve(`apply ${id}`),
            ask: (ids) => Promise.resolve(`ask ${ids.join(",")}`),
            leave: () => Promise.resolve("leave"),
        }
        const outcome = await judgeAndEffect(arrival({ text: "ORD-2026-0001" }), [candidate()], [], never, OPTIONS)
        await expect(runEffect(outcome, handlers)).resolves.toBe("apply c1")
        await expect(
            runEffect({ ...outcome, effect: { kind: "ask", candidateIds: ["a", "b"] } }, handlers),
        ).resolves.toBe("ask a,b")
        await expect(runEffect({ ...outcome, effect: { kind: "leave" } }, handlers)).resolves.toBe("leave")
    })
})
