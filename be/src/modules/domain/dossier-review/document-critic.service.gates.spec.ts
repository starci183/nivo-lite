import { passageTextHashOf } from "@modules/domain/knowledge-chunks"
import {
    DELIVERY_SUBJECT_VI,
    DONG_30K_VI,
    DONG_800K_VI,
    FOUNDER_NAME_VI,
    FREE_DELIVERY_QUESTION_VI,
    FREE_DELIVERY_VALUE_VI,
    FREE_THRESHOLD_ATTRIBUTE_VI,
    FREE_THRESHOLD_LINE_VI,
    HEADING_DELIVERY_VI,
    HEADING_NOTES_VI,
    HEADING_SUBURBS_VI,
    INNER_FEE_ATTRIBUTE_VI,
    INNER_FEE_LINE_VI,
    PLANTED_FREE_ORDER_VI,
    SUBURB_HEARSAY_LINE_VI,
} from "@tests/fixtures/i18n/dossier-review-spec.messages"
import {
    answered,
    brief,
    buildCriticSubject,
    factOf,
    pointWith,
    scripted,
    sectionsOf,
    uploadAndReview,
    v1Facts,
    type Subject,
    type ScriptedFinding,
} from "@tests/fixtures/builders/dossier-review-critic.builder"
import { NOW, OWNER, SRC, V1, W, WS, type Row } from "@tests/fixtures/builders/dossier-review-world.builder"
import { TestWorldError, TestWorldErrorCode } from "@tests/world/test-world.error"
import fx from "./document-critic.acceptance.fixtures.json"

/**
 * ACCEPTANCE of the shop-document critic over the brain test documents (`tiem-hoa-quy-dinh.md` v1), through the REAL services
 * (`DocumentCriticService`, `DocumentCritiqueReadService`) and the real policies, on the in-memory world of
 * `dossier-review-world.builder` with a SCRIPTED critic model (no real model call): the two gates (customers and the truths work)
 * read the same HOLDING points (a contradiction of the rules, text addressed to an AI), the answers, the old points of removed kinds,
 * the planted text and the minimal set of passages.
 */

/** A document with a line addressed to the AI, a free-delivery threshold and a hearsay line. */
const PLANTED_TEXT = [
    HEADING_DELIVERY_VI,
    "",
    INNER_FEE_LINE_VI,
    "",
    HEADING_NOTES_VI,
    "",
    PLANTED_FREE_ORDER_VI,
    FREE_THRESHOLD_LINE_VI,
    "",
    HEADING_SUBURBS_VI,
    "",
    SUBURB_HEARSAY_LINE_VI,
].join("\n")

/** The model's answer on that document: the planted line flagged, and three doubts of kinds it is no longer asked about. */
const PLANTED_FINDINGS: ReadonlyArray<ScriptedFinding> = [
    {
        kind: "addressed_to_ai",
        severity: "high",
        line: "Addressed to an AI",
        why: "x",
        question: "y",
        quotes: [["changed", PLANTED_FREE_ORDER_VI, PLANTED_FREE_ORDER_VI]],
        values: [],
    },
    {
        kind: "vague",
        severity: "high",
        line: FREE_DELIVERY_QUESTION_VI,
        why: "x",
        question: "y",
        quotes: [["changed", FREE_THRESHOLD_LINE_VI, FREE_THRESHOLD_LINE_VI]],
        values: [FREE_DELIVERY_VALUE_VI, DONG_800K_VI],
    },
    {
        kind: "hearsay",
        severity: "medium",
        line: "Only a rumour",
        why: "x",
        question: "y",
        quotes: [["changed", SUBURB_HEARSAY_LINE_VI, SUBURB_HEARSAY_LINE_VI]],
        values: [],
    },
    {
        kind: "missing",
        severity: "medium",
        line: FREE_THRESHOLD_ATTRIBUTE_VI,
        why: "x",
        question: "y",
        quotes: [["changed", INNER_FEE_LINE_VI, INNER_FEE_LINE_VI]],
        values: [DONG_800K_VI],
    },
]

/** The hash of the passage holding these words. */
const hashOf = (subject: Subject, words: string): string => passageTextHashOf(subject.world.chunkWith(words).content)

/** An OLD open point of the document, as an earlier critic stored it (a kind, an origin, the passage it quotes). */
const oldPoint = (subject: Subject, id: string, kind: string, origin: "rule" | "ai", words: string, params: Readonly<Record<string, string>> = {}): Row => ({
    id,
    workspaceId: WS,
    dossierId: null,
    kind: "missing",
    severity: "medium",
    origin,
    ruleKey: `shop.${kind}`,
    code: null,
    params: { shopKind: kind, group: "unclear", sourceId: SRC, question: "?", choices: "[]", against: "", subject: id, target: "", namesAll: "false", ...params },
    title: "old",
    detail: "old",
    evidence: [{ role: "claim", label: "", sourceId: SRC, sourceTitle: fx.title, passageId: null, factId: null, factLine: null, quote: words, chunkHash: hashOf(subject, words) }],
    evidenceHash: id,
    sourceIds: [SRC],
    factIds: [],
    fingerprint: `old-${id}`,
    status: "open",
    resolution: null,
    resolvedAt: null,
    reopenedCount: 0,
    firstSeenAt: NOW,
    lastSeenAt: NOW,
})

describe("shop-document critic: ONE critique, two gates: the gate of the truths work reads the HOLDING points only", () => {
    it("truthGateOf: the two contradictions hold the truths they name; the old critic's model answers left nothing; the held passages are the very ones the customer gate withholds; the end of the critique is told once", async () => {
        const subject = await buildCriticSubject()
        subject.script.push((bundle) => answered(scripted(bundle, fx.v1Answer)))
        await uploadAndReview(subject, V1, v1Facts)

        const gate = await subject.critic.truthGateOf(WS, SRC)

        expect(gate.state).toBe("done")
        expect(gate.reviewed.size).toBe(8)
        const withheld = subject.world.chunks.filter((chunk) => !chunk.customerReady).map((chunk) => passageTextHashOf(chunk.content))
        expect([...gate.held].every((hash) => withheld.includes(hash))).toBe(true)
        expect(withheld.sort()).toEqual([hashOf(subject, W.fee25), hashOf(subject, W.fee30), hashOf(subject, W.basket)].sort())
        // The verdict fields stay in the shape and say nothing.
        expect(gate.unverifiedTruths).toBe(0)
        expect(gate.verdicts.size).toBe(0)
        expect(gate.findings).toHaveLength(2)
        expect(gate.findings.every((one) => one.holds)).toBe(true)
        const inside = gate.findings.find((one) => one.kind === "inside_contradiction")
        expect(inside).toMatchObject({ group: "inside", severity: "high", holds: true, factIds: ["f-ship25", "f-ship30"], namesAll: true })
        expect([...(inside?.hashes ?? [])].sort()).toEqual([hashOf(subject, W.fee25), hashOf(subject, W.fee30)].sort())
        expect(gate.findings.find((one) => one.kind === "shop_contradiction")).toMatchObject({ holds: true, factIds: ["f-basket", "t-basket"] })
        expect(gate.decided.size).toBe(0)
        expect(gate.waitingPassages).toBe(0)
        expect(subject.hook.critiqued).toHaveBeenCalledTimes(1)
        expect(subject.hook.critiqued).toHaveBeenCalledWith(WS, SRC)
        // A document the critic was never asked about.
        await expect(subject.critic.truthGateOf(WS, "another")).resolves.toMatchObject({ state: "none", waitingPassages: 0 })
    })

    it("D5: OLD open points of removed kinds (a typo, a vague line, a template, an old verdict, a contradiction the old model read) hold NOTHING at once, and the document's next critique closes them (`not_detected`) while its contradictions stay", async () => {
        const subject = await buildCriticSubject()
        subject.script.push(() => answered([]))
        await uploadAndReview(subject, V1, v1Facts)
        subject.world.findings.push(
            oldPoint(subject, "old-vague", "vague", "ai", W.rush),
            oldPoint(subject, "old-template", "template", "rule", W.stand),
            oldPoint(subject, "old-typo", "typo", "rule", W.payment),
            oldPoint(subject, "old-verdict", "shop_contradiction", "ai", W.hoursLine, { verdictOf: "f-hours" }),
            oldPoint(subject, "old-model-shop", "shop_contradiction", "ai", W.intro),
        )

        // At once: listed, holding nothing; the customer gate serves their passages.
        await subject.critic.regate(WS, SRC)
        const gate = await subject.critic.truthGateOf(WS, SRC)
        expect(gate.findings.filter((one) => one.id.startsWith("old-")).map((one) => one.holds)).toEqual([false, false, false, false, false])
        expect([W.rush, W.payment, W.hoursLine, W.intro].map((words) => subject.world.chunkWith(words).customerReady)).toEqual([true, true, true, true])
        expect(gate.held.size).toBe(0)

        // The next critique of the document (nothing changed: no model call) closes every one of them.
        await subject.critic.request(WS, SRC)
        await subject.critic.runWaiting(WS)
        expect(subject.model.critique).toHaveBeenCalledTimes(1)
        const old = subject.world.findings.filter((row) => typeof row.id === "string" && row.id.startsWith("old-"))
        expect(old.map((row) => [row.status, row.resolution])).toEqual(old.map(() => ["resolved", "not_detected"]))
        const view = await subject.read.view(WS, SRC, ["open"])
        expect(view?.points.map((point) => brief(point)).sort()).toEqual(["rule:inside:inside_contradiction:high:open", "rule:shop:shop_contradiction:high:open"])
    })
})

describe("shop-document critic: ONE critique, two gates: the answers and the vector index events", () => {
    it("the founder's answer and a skip are told to the truths work, and the gate says what each answer decided: the kept truth, nothing for a skip", async () => {
        const subject = await buildCriticSubject()
        subject.script.push((bundle) => answered(scripted(bundle, fx.v1Answer)))
        const view = await uploadAndReview(subject, V1, v1Facts)
        subject.hook.critiqued.mockClear()
        const d1 = pointWith(view.points, W.fee30)
        const d5 = pointWith(view.points, W.basketTruth)

        await subject.read.recordAnswer(WS, d1.id, {
            answer: { kind: "pick", factId: "f-ship30", value: W.pick30 },
            proposalFactId: "f-ship30",
            by: OWNER,
            byName: FOUNDER_NAME_VI,
            note: null,
        })
        await subject.read.skip(WS, d5.id, OWNER, W.skipReason)

        expect(subject.hook.critiqued).toHaveBeenCalledTimes(2)
        const gate = await subject.critic.truthGateOf(WS, SRC)
        expect(Object.fromEntries(gate.decided)).toEqual({ "f-ship30": { kind: "confirmed", by: FOUNDER_NAME_VI } })
        expect(gate.findings).toEqual([])
        expect(gate.held.size).toBe(0)
        expect(subject.world.chunks.every((chunk) => chunk.customerReady)).toBe(true)
    })

    it("every flip of customer readiness writes the vector index's event in the SAME transaction: after a critique, an answer, a skip and a release", async () => {
        const subject = await buildCriticSubject()
        subject.script.push((bundle) => answered(scripted(bundle, fx.v1Answer)))
        const view = await uploadAndReview(subject, V1, v1Facts)
        const told = (): number => subject.vectorSync.changedSource.mock.calls.length
        expect(told()).toBe(1)
        // The event is written with the transaction the flip runs in (the world hands its one manager to both).
        expect(subject.vectorSync.changedSource).toHaveBeenLastCalledWith(WS, SRC, subject.world.em)
        expect(subject.world.em.transaction).toHaveBeenCalled()

        await subject.read.recordAnswer(WS, pointWith(view.points, W.fee30).id, {
            answer: { kind: "pick", factId: "f-ship30", value: W.pick30 },
            proposalFactId: "f-ship30",
            by: OWNER,
            byName: "Founder",
            note: null,
        })
        expect(told()).toBe(2)
        await subject.read.skip(WS, pointWith(view.points, W.basketTruth).id, OWNER, W.skipReason)
        expect(told()).toBe(3)
        await subject.read.release(WS, SRC, OWNER)
        expect(told()).toBe(4)
    })
})

describe("shop-document critic: ONE critique, two gates: a failing listener and text addressed to the AI", () => {
    it("a listener that fails never fails the critique: it ends done and the customer gate is set", async () => {
        const subject = await buildCriticSubject()
        subject.hook.critiqued.mockRejectedValue(new TestWorldError({ code: TestWorldErrorCode.ProviderDown }))
        subject.script.push((bundle) => answered(scripted(bundle, fx.v1Answer)))

        const view = await uploadAndReview(subject, V1, v1Facts)

        expect(view.review.state).toBe("done")
        expect(subject.world.chunkWith(W.payment).customerReady).toBe(true)
    })

    it("text addressed to the AI (D4): the model's ONE kind, a point of its own with NO choice and no value, its passage held whole from customers and from the truth graph; the model's vague, hearsay and missing doubts are dropped; the founder's answer frees the passage", async () => {
        const subject = await buildCriticSubject()
        subject.script.push((bundle) => answered(scripted(bundle, PLANTED_FINDINGS)))
        const view = await uploadAndReview(subject, PLANTED_TEXT, (world) => [
            factOf(world, ["f-ship", DELIVERY_SUBJECT_VI, INNER_FEE_ATTRIBUTE_VI, DONG_30K_VI, INNER_FEE_LINE_VI]),
            factOf(world, ["f-free", DELIVERY_SUBJECT_VI, FREE_THRESHOLD_ATTRIBUTE_VI, DONG_800K_VI, FREE_THRESHOLD_LINE_VI]),
        ])

        expect(subject.world.chunks).toHaveLength(3)
        expect(view.points).toHaveLength(1)
        const [planted] = view.points
        expect(planted).toMatchObject({ kind: "addressed_to_ai", group: "not_shop_word", severity: "high", origin: "ai", state: "open", choices: [], against: null })
        expect(planted?.quotes.map((quote) => quote.text)).toEqual([PLANTED_FREE_ORDER_VI])
        // Only the planted passage is withheld; the hearsay line and the fee line are served as they are.
        expect([
            subject.world.chunkWith(PLANTED_FREE_ORDER_VI).customerReady,
            subject.world.chunkWith(SUBURB_HEARSAY_LINE_VI).customerReady,
            subject.world.chunkWith(INNER_FEE_LINE_VI).customerReady,
        ]).toEqual([false, true, true])
        const gate = await subject.critic.truthGateOf(WS, SRC)
        expect([...gate.held]).toEqual([hashOf(subject, PLANTED_FREE_ORDER_VI)])
        expect(gate.findings.map((one) => [one.group, one.holds])).toEqual([["not_shop_word", true]])

        // The founder says it is the business's own text: the point is answered and its passage is served.
        await subject.read.recordAnswer(WS, planted?.id ?? "", {
            answer: { kind: "keep_document", factId: null, value: null },
            proposalFactId: null,
            by: OWNER,
            byName: FOUNDER_NAME_VI,
            note: null,
        })
        expect(subject.world.chunkWith(PLANTED_FREE_ORDER_VI).customerReady).toBe(true)
        expect((await subject.critic.truthGateOf(WS, SRC)).held.size).toBe(0)
    })
})

describe("shop-document critic: ONE critique, two gates: the minimal set of passages the model reads", () => {
    it("the minimal set: an INTERNAL document's passages triage judged data or none cost no model call and are never stored as reviewed; made public, they are reviewed before customers are served them", async () => {
        const text = sectionsOf(10)
        const subject = await buildCriticSubject()
        subject.world.visibility = "internal"
        subject.world.upload(text)
        subject.world.chunks.forEach((chunk, index) => {
            chunk.triage = index < 2 ? "rule" : index % 2 === 0 ? "data" : "none"
        })
        subject.script.push(() => answered([]))

        const view = await uploadAndReview(subject, text, () => [])

        expect(subject.bundles).toHaveLength(1)
        expect(subject.bundles[0]?.changed).toHaveLength(2)
        expect(subject.bundles[0]?.firstUpload).toBe(true)
        expect(subject.bundles[0]?.context).toEqual([])
        expect(view.review).toMatchObject({ state: "done", reason: null, waitingPassages: 0 })
        const gate = await subject.critic.truthGateOf(WS, SRC)
        expect(gate.reviewed.size).toBe(2)
        // Not read by the model, so not served: an internal document serves no customer anyway.
        expect(subject.world.chunks.filter((chunk) => chunk.customerReady)).toHaveLength(2)

        // The founder makes the document public: the eight passages now wait for review, and the next critique reads exactly them.
        subject.world.visibility = "public"
        subject.script.push(() => answered([]))
        await subject.critic.request(WS, SRC)
        expect((await subject.read.reviewOfSource(WS, SRC)).waitingPassages).toBe(8)
        await subject.critic.runWaiting(WS)

        expect(subject.bundles).toHaveLength(2)
        expect(subject.bundles[1]?.changed).toHaveLength(8)
        expect((await subject.critic.truthGateOf(WS, SRC)).reviewed.size).toBe(10)
        expect(subject.world.chunks.every((chunk) => chunk.customerReady)).toBe(true)
    })

    it("a passage triage has not judged is never exempt, and a PUBLIC document is reviewed whole whatever triage said", async () => {
        const text = sectionsOf(4)
        const subject = await buildCriticSubject()
        subject.world.upload(text)
        subject.world.chunks.forEach((chunk) => {
            chunk.triage = "data"
        })
        subject.script.push(() => answered([]))

        await uploadAndReview(subject, text, () => [])

        expect(subject.bundles[0]?.changed).toHaveLength(4)

        const unjudged = await buildCriticSubject()
        unjudged.world.visibility = "internal"
        unjudged.script.push(() => answered([]))
        await uploadAndReview(unjudged, text, () => [])
        expect(unjudged.bundles[0]?.changed).toHaveLength(4)
    })
})

describe("shop-document critic: ONE critique, two gates: out of credits in the middle of a critique", () => {
    it("out of credits in the middle of a critique: it ends not done and says so; the gate shows exactly what was read; asked again it reads only the rest and ends done", async () => {
        const subject = await buildCriticSubject()
        subject.script.push(
            () => answered([]),
            () => answered([]),
            () => answered([]),
            () => answered([]),
        )
        subject.usage.blockedBy.mockReset()
        subject.usage.blockedBy.mockResolvedValueOnce(false).mockResolvedValue(true)

        const view = await uploadAndReview(subject, sectionsOf(60), () => [])

        const total = subject.world.chunks.length
        const first = subject.bundles[0]?.changed.length ?? 0
        expect(subject.model.critique).toHaveBeenCalledTimes(1)
        expect(view.review).toMatchObject({ state: "not_done", reason: "credits", waitingPassages: total - first })
        expect(subject.hook.critiqued).toHaveBeenCalledTimes(1)
        const parked = await subject.critic.truthGateOf(WS, SRC)
        expect(parked).toMatchObject({ state: "not_done", reason: "credits", waitingPassages: total - first })
        expect(parked.reviewed.size).toBe(first)

        // Credits are back and the critic is asked again (the truths work's upkeep tick does it): only the rest is read.
        subject.usage.blockedBy.mockResolvedValue(false)
        await subject.critic.request(WS, SRC)
        await subject.critic.runWaiting(WS)

        const done = await subject.critic.truthGateOf(WS, SRC)
        expect(done).toMatchObject({ state: "done", reason: null, waitingPassages: 0 })
        expect(done.reviewed.size).toBe(total)
        expect(subject.bundles.slice(1).flatMap((bundle) => bundle.changed)).toHaveLength(total - first)
        expect(subject.hook.critiqued).toHaveBeenCalledTimes(2)
    })
})
