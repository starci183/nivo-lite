import { Test } from "@nestjs/testing"
import { boundedPoints, MORE_SUBJECT } from "./document-critic-bound.policy"
import { CRITIC_CAPS, type CriticKind, type CriticPoint, type CriticSay } from "./document-critic.contracts"

const SUBJECT = Symbol("document-critic-bound.policy")
interface Subject {
    readonly boundedPoints: typeof boundedPoints
}
const buildSubject = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { boundedPoints } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const say: CriticSay = (key, params = {}) => [key, ...Object.entries(params).map(([name, value]) => `${name}=${value}`)].join("|")

const point = (index: number, kind: CriticKind, severity: CriticPoint["severity"], origin: CriticPoint["origin"] = "ai"): CriticPoint => ({
    kind,
    origin,
    severity,
    subject: `s${String(index)}`,
    line: `line ${String(index)}`,
    why: "why",
    question: "question",
    quotes: [{ text: `quote ${String(index)}`, passageId: `c${String(index)}`, chunkHash: `h${String(index)}`, role: "this", factId: `f${String(index)}`, sourceId: "s1", sourceTitle: "Doc" }],
    against: null,
    choices: [],
})

const isMore = (one: CriticPoint): boolean => one.subject.startsWith(MORE_SUBJECT)

describe("the bound on what one document adds to the founder's list (D-N-4)", () => {
    it("contradiction points: twelve of a kind one by one, the high ones first; the rest rolled up, the highest severity kept; another kind is bounded on its own", async () => {
        const subject = await buildSubject()
        const medium = Array.from({ length: 14 }, (_, index) => point(index, "other_document", "medium", "rule"))
        const high = point(20, "other_document", "high", "rule")
        const inside = Array.from({ length: 5 }, (_, index) => point(100 + index, "inside_contradiction", "high", "rule"))

        const out = subject.boundedPoints(say, [...medium, high, ...inside])

        expect(out.capped).toEqual([{ kind: "other_document", left: 3 }])
        const other = out.points.filter((one) => one.kind === "other_document")
        expect(other.filter((one) => !isMore(one))).toHaveLength(CRITIC_CAPS.rulePointsPerKind)
        expect(other[0]).toBe(high)
        expect(other.filter(isMore).map((one) => [one.origin, one.severity, one.line, one.quotes.length, one.quotes[0]?.factId])).toEqual([
            ["rule", "medium", say("more.line", { count: "3" }), 3, null],
        ])
        expect(out.points.filter((one) => one.kind === "inside_contradiction")).toHaveLength(5)
    })
})
