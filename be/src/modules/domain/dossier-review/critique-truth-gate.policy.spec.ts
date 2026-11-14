import { Test } from "@nestjs/testing"
import { DONG_20K_VI, DONG_25K_VI, DONG_30K_VI, FOUNDER_NAME_VI } from "@tests/fixtures/i18n/dossier-review-spec.messages"
import { ANSWERED_BY_PARAM, NO_TRUTH_GATE, exemptPassageIds, truthGateOf } from "./critique-truth-gate.policy"
import { DossierFindingEntity, SourceCritiqueEntity } from "./persistence/entities"

const SUBJECT = Symbol("critique-truth-gate.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { truthGateOf, exemptPassageIds } }],
    }).compile()
    return moduleRef.get<typeof import("./critique-truth-gate.policy")>(SUBJECT)
}

/** A critique that is done: both passages read, nothing waiting. */
const rowOf = (): SourceCritiqueEntity =>
    Object.assign(new SourceCritiqueEntity(), { state: "done", reason: null, reviewedHashes: ["h1", "h2"], waitingPassages: 0, verifiedTruths: [] })

/** A done critique with this many passages still waiting. */
const rowWaiting = (waitingPassages: number): SourceCritiqueEntity => Object.assign(rowOf(), { waitingPassages })

/** A critique that did not finish: why, the passages it read so far, and how many still wait. */
const rowNotDone = (
    reason: SourceCritiqueEntity["reason"],
    reviewedHashes: Array<string>,
    waitingPassages: number,
): SourceCritiqueEntity => Object.assign(rowOf(), { state: "not_done", reason, reviewedHashes, waitingPassages })

/** An open CONTRADICTION point of the rules (a produced kind): the default of every point below. */
const pointOf = (id: string, more: Partial<DossierFindingEntity> & { readonly hashes?: ReadonlyArray<string> } = {}): DossierFindingEntity => {
    const { hashes = ["h1"], ...columns } = more
    return Object.assign(new DossierFindingEntity(), {
        id,
        ruleKey: "shop.shop_contradiction",
        origin: "rule",
        severity: "high",
        status: "open",
        resolution: null,
        factIds: [],
        params: { group: "shop", shopKind: "shop_contradiction", sourceId: "doc", choices: "[{}]" },
        evidence: hashes.map((chunkHash) => ({ role: "claim", chunkHash })),
        ...columns,
    })
}

/** An open point of an OLD kind, as an earlier critic stored it. */
const oldPoint = (id: string, kind: string, origin: "rule" | "ai", hashes: ReadonlyArray<string>, more: Readonly<Record<string, string>> = {}): DossierFindingEntity =>
    pointOf(id, { ruleKey: `shop.${kind}`, origin, severity: "high", hashes, factIds: ["f-old"], params: { group: "unclear", shopKind: kind, sourceId: "doc", choices: "[]", ...more } })

const answered = (id: string, answer: object, more: Partial<DossierFindingEntity> & { readonly hashes?: ReadonlyArray<string> } = {}, extra: Readonly<Record<string, string>> = {}) =>
    pointOf(id, {
        status: "resolved",
        resolution: "manual",
        params: { group: "shop", shopKind: "shop_contradiction", sourceId: "doc", answer: JSON.stringify(answer), [ANSWERED_BY_PARAM]: FOUNDER_NAME_VI, ...extra },
        ...more,
    })

describe("critique-truth-gate.policy: what the truths work reads of the critic", () => {
    it("a document the critic was never asked about: nothing reviewed, nothing held, nothing decided", async () => {
        const subject = await build()
        expect(subject.truthGateOf(null, [pointOf("p1")])).toBe(NO_TRUTH_GATE)
    })

    it("every open point with its group, severity and the truths it names; only the open ones are listed; the verdict fields say nothing", async () => {
        const subject = await build()
        const gate = subject.truthGateOf(rowWaiting(3), [
            pointOf("p-shop", { factIds: ["f1", "t1"] }),
            pointOf("p-skipped", { status: "dismissed", hashes: ["h3"] }),
            pointOf("p-gone", { status: "resolved", resolution: "not_detected", hashes: ["h4"] }),
        ])

        expect(gate).toMatchObject({ state: "done", reason: null, waitingPassages: 3, unverifiedTruths: 0 })
        expect(gate.verdicts.size).toBe(0)
        expect([...gate.reviewed]).toEqual(["h1", "h2"])
        expect(gate.findings).toEqual([
            { id: "p-shop", group: "shop", kind: "shop_contradiction", severity: "high", holds: true, hashes: ["h1"], factIds: ["f1", "t1"], namesAll: false },
        ])
    })

    it("an answer decides only the truth it names: kept as written (keep the document, pick) = confirmed; a typed value = corrected (the proposal it filed)", async () => {
        const subject = await build()
        const gate = subject.truthGateOf(rowOf(), [
            answered("p-keep", { kind: "keep_document", factId: "f-doc", value: DONG_30K_VI }),
            answered("p-pick", { kind: "pick", factId: "f-picked", value: DONG_25K_VI }, { hashes: ["h2"] }),
            answered("p-typed", { kind: "value", factId: "f-doc2", value: DONG_20K_VI }, { hashes: ["h2"] }, { proposalFactId: "f-own" }),
            // These decide nothing to put in force: the shop's value stays, the line is dropped, the correction is made in the file.
            answered("p-shop", { kind: "keep_shop", factId: "t1", value: "x" }),
            answered("p-remove", { kind: "remove", factId: "f-drop", value: null }),
            answered("p-file", { kind: "keep_document", factId: null, value: null }),
            // Closed by a decision on the graph (no answer), and skipped: nothing decided here.
            pointOf("p-graph", { status: "resolved", resolution: "manual" }),
            pointOf("p-skip", { status: "dismissed" }),
        ])

        expect(Object.fromEntries(gate.decided)).toEqual({
            "f-doc": { kind: "confirmed", by: FOUNDER_NAME_VI },
            "f-picked": { kind: "confirmed", by: FOUNDER_NAME_VI },
            "f-own": { kind: "corrected", by: FOUNDER_NAME_VI },
        })
        expect(gate.findings).toEqual([])
        expect(gate.held.size).toBe(0)
    })

    it("confirmedBy names a passage only when EVERY point that quotes it is answered in favour of the document; an answer recorded before the answer was the decision (no name on it) decides nothing", async () => {
        const subject = await build()
        const keep = { kind: "keep_document", factId: "f1", value: null }
        const all = subject.truthGateOf(rowOf(), [answered("a", keep), answered("b", { kind: "pick", factId: "f2", value: "x" })])
        expect(Object.fromEntries(all.confirmedBy)).toEqual({ h1: FOUNDER_NAME_VI })

        const one = subject.truthGateOf(rowOf(), [answered("a", keep), pointOf("still-open")])
        expect(one.confirmedBy.size).toBe(0)

        const old = pointOf("old", { status: "resolved", resolution: "manual", params: { sourceId: "doc", answer: JSON.stringify(keep) } })
        expect(subject.truthGateOf(rowOf(), [old]).decided.size).toBe(0)
    })

    it("a critique that is not done says why, with what it has read so far", async () => {
        const subject = await build()
        const gate = subject.truthGateOf(rowNotDone("credits", ["h1"], 7), [])
        expect(gate).toMatchObject({ state: "not_done", reason: "credits", waitingPassages: 7 })
        expect([...gate.reviewed]).toEqual(["h1"])
    })
})

describe("critique-truth-gate.policy: ONLY a produced kind holds (owner 2026-11-12: contradictions between data, and text addressed to an AI)", () => {
    it("the three contradiction kinds of the rules and the model's text addressed to an AI hold; every other open point is listed and holds NOTHING (D5)", async () => {
        const subject = await build()
        const gate = subject.truthGateOf(rowOf(), [
            pointOf("p-inside", { ruleKey: "shop.inside_contradiction", factIds: ["f1", "f2"], params: { group: "inside", shopKind: "inside_contradiction", sourceId: "doc", namesAll: "true", choices: "[{}]" } }),
            pointOf("p-other", { ruleKey: "shop.other_document", severity: "medium", factIds: ["f3", "w1"], params: { group: "other_document", shopKind: "other_document", sourceId: "doc", namesAll: "true", choices: "[{}]" } }),
            pointOf("p-ai", { ruleKey: "shop.addressed_to_ai", origin: "ai", hashes: ["h2"], params: { group: "not_shop_word", shopKind: "addressed_to_ai", sourceId: "doc", choices: "[]" } }),
            oldPoint("o-typo", "typo", "rule", ["h1"]),
            oldPoint("o-vague", "vague", "ai", ["h2"]),
            oldPoint("o-template", "template", "rule", ["h1"]),
            oldPoint("o-stale", "stale_date", "ai", ["h2"]),
            oldPoint("o-hearsay", "hearsay", "ai", ["h2"]),
            oldPoint("o-arithmetic", "arithmetic", "ai", ["h1"]),
            // An old verdict of the deleted verification, and a contradiction the OLD model critic read: neither is produced now.
            oldPoint("o-verdict", "shop_contradiction", "ai", ["h1"], { verdictOf: "f-old" }),
            oldPoint("o-model-shop", "shop_contradiction", "ai", ["h1"]),
            // A rule-raised text-addressed-to-AI point of the old line rule.
            oldPoint("o-rule-ai", "addressed_to_ai", "rule", ["h1"]),
        ])

        expect(gate.findings.map((one) => [one.id, one.holds])).toEqual([
            ["p-inside", true],
            ["p-other", true],
            ["p-ai", true],
            ["o-typo", false],
            ["o-vague", false],
            ["o-template", false],
            ["o-stale", false],
            ["o-hearsay", false],
            ["o-arithmetic", false],
            ["o-verdict", false],
            ["o-model-shop", false],
            ["o-rule-ai", false],
        ])
        // Only the model's flag (no choice, no truth named) holds its passage whole; the old points hold no passage at all.
        expect([...gate.held]).toEqual(["h2"])
    })
})

describe("critique-truth-gate.policy: the minimal set of passages the model reads", () => {
    it("exempts only an INTERNAL document's passages triage judged data or none; never a rule passage, an unjudged passage or a public one", async () => {
        const subject = await build()
        const exempt = subject.exemptPassageIds([
            { id: "data", visibility: "internal", triage: "data" },
            { id: "none", visibility: "internal", triage: "none" },
            { id: "rule", visibility: "internal", triage: "rule" },
            { id: "unjudged", visibility: "internal", triage: null },
            { id: "public-data", visibility: "public", triage: "data" },
            { id: "unknown", visibility: null, triage: "none" },
        ])
        expect([...exempt]).toEqual(["data", "none"])
    })
})

describe("critique-truth-gate.policy: a point holds only the truths it names", () => {
    const naming = (id: string, factIds: ReadonlyArray<string>, hashes: ReadonlyArray<string>, more: Readonly<Record<string, string>>): DossierFindingEntity =>
        pointOf(id, { factIds: [...factIds], hashes, params: { group: "shop", shopKind: "shop_contradiction", sourceId: "doc", ...more } })

    it("a point that names its truths holds those only; a roll-up (no choice) that cannot name them all holds its passages whole", async () => {
        const subject = await build()
        const gate = subject.truthGateOf(rowOf(), [
            naming("p-named", ["f-a", "t-a"], ["h1"], { namesAll: "true", choices: "[{}]" }),
            naming("p-line", [], ["h2"], { namesAll: "false", choices: "[{}]" }),
            naming("p-whole", [], ["h3"], { namesAll: "false", choices: "[]" }),
        ])

        expect([...gate.held]).toEqual(["h3"])
        expect(gate.findings.map((one) => [one.id, one.holds, one.namesAll, one.factIds])).toEqual([
            ["p-named", true, true, ["f-a", "t-a"]],
            ["p-line", true, false, []],
            ["p-whole", true, false, []],
        ])
    })

    it("a contradiction another document raised about a waiting truth of this one holds that truth here too, and nothing else of this document; an old point of another document holds nothing", async () => {
        const subject = await build()
        const elsewhere = pointOf("p-foreign", { factIds: ["mine", "theirs"], hashes: ["h9"], params: { group: "other_document", shopKind: "other_document", sourceId: "other", namesAll: "true", choices: "[{}]" }, ruleKey: "shop.other_document", severity: "medium" })
        const stale = oldPoint("o-foreign", "hearsay", "ai", ["h8"], { sourceId: "other" })
        const gate = subject.truthGateOf(rowOf(), [], [elsewhere, stale])

        expect(gate.findings).toEqual([{ id: "p-foreign", group: "other_document", kind: "other_document", severity: "medium", holds: true, hashes: [], factIds: ["mine", "theirs"], namesAll: true }])
        expect(gate.held.size).toBe(0)
        // Once that question is answered or closed, it holds nothing.
        const closed = pointOf("p-foreign", { factIds: ["mine"], status: "resolved", resolution: "manual" })
        expect(subject.truthGateOf(rowOf(), [], [closed]).findings).toEqual([])
    })
})

describe("critique-truth-gate.policy: an answer that keeps a truth answers that kind of question wherever it is asked", () => {
    const twin = pointOf("p-twin", { hashes: ["h2"], factIds: ["asked", "t1"], params: { group: "shop", shopKind: "shop_contradiction", sourceId: "doc", namesAll: "true", choices: "[{}]" } })
    const kept = (factId: string | null): DossierFindingEntity =>
        answered("p-answered", { kind: "keep_document", factId, value: null }, { hashes: ["h2"], factIds: ["asked", "t1"] })

    it("the twin point of the same kind no longer names the kept truth; a question of another kind still holds it", async () => {
        const subject = await build()
        const other = pointOf("p-other", {
            hashes: ["h2"],
            ruleKey: "shop.inside_contradiction",
            factIds: ["asked", "f2"],
            params: { group: "inside", shopKind: "inside_contradiction", sourceId: "doc", namesAll: "true", choices: "[{}]" },
        })
        const gate = subject.truthGateOf(rowOf(), [twin, kept("asked"), other])

        expect([...gate.decided.keys()]).toEqual(["asked"])
        expect(gate.findings.map((one) => [one.id, one.factIds])).toEqual([
            ["p-twin", ["t1"]],
            ["p-other", ["asked", "f2"]],
        ])
    })

    it("an answer that names no truth decides nothing and frees nothing", async () => {
        const subject = await build()
        const gate = subject.truthGateOf(rowOf(), [twin, kept(null)])

        expect(gate.decided.size).toBe(0)
        expect(gate.findings.map((one) => [one.id, one.factIds])).toEqual([["p-twin", ["asked", "t1"]]])
    })
})
