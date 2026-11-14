import { workInScope } from "@modules/platform/logging"
import {
    answered,
    brief,
    buildCriticSubject,
    pointWith,
    scripted,
    sectionsOf,
    uploadAndReview,
    v1Facts,
    v2Facts,
} from "@tests/fixtures/builders/dossier-review-critic.builder"
import { NOW, OWNER, SRC, V1, V2, V3, W, WS } from "@tests/fixtures/builders/dossier-review-world.builder"
import fx from "./document-critic.acceptance.fixtures.json"
import type { CritiqueTry } from "./document-critic.port"
import { DOSSIER_REVIEW_MESSAGES } from "./messages/dossier-review.messages"

/**
 * ACCEPTANCE of the shop-document critic over the brain test documents (`tiem-hoa-quy-dinh.md` v1 and v2), through the REAL services
 * (`DocumentCriticService`, `DocumentCritiqueReadService`) and the real policies, on the in-memory world of `dossier-review-world.builder`
 * with a SCRIPTED critic model (no real model call). Owner 2026-11-12: documents are trusted; the critique raises only
 * CONTRADICTIONS between data (the rules) and text ADDRESSED TO AN AI (the model's security read). The scripted model answers of the
 * fixtures are the OLD critic's kinds (vague, missing, stale date, typo, a contradiction read by the model): every one is dropped.
 */

describe("shop-document critic: the first upload of tiem-hoa-quy-dinh v1 (acceptance)", () => {
    it("v1 (first upload): only the two contradictions between data become points (one key given two values, a value against the truth in force); a blank, a vague or past-dated line and every model finding of an old kind make NO point; only the passages under those two points are withheld from customers", async () => {
        const subject = await buildCriticSubject()
        const scopes: Array<unknown> = []
        subject.script.push((bundle) => {
            scopes.push(workInScope())
            return answered(scripted(bundle, fx.v1Answer))
        })
        const view = await uploadAndReview(subject, V1, v1Facts)
        // The critique's model call is booked to the document as the `critique` step of its own work kind.
        expect(scopes).toEqual([
            expect.objectContaining({ kind: "document_critique", ref: `source:${SRC}`, stepKey: "critique" }),
        ])

        expect(subject.world.chunks).toHaveLength(8)
        expect(subject.model.critique).toHaveBeenCalledTimes(1)
        // The security read: the changed passages and nothing else (every kind of document is read the same way).
        const [bundle] = subject.bundles
        expect(bundle?.firstUpload).toBe(true)
        expect(bundle?.changed).toHaveLength(8)
        expect(bundle).toMatchObject({ context: [], facts: [], shop: [], known: [] })
        expect(bundle?.nature).toBeUndefined()

        const by = (words: string): string => brief(pointWith(view.points, words))
        // Data against data: D1 two values for one key in ONE document, D5 another value than the truth in force.
        expect(by(W.fee30)).toBe("rule:inside:inside_contradiction:high:open") // D1
        expect(by(W.basketTruth)).toBe("rule:shop:shop_contradiction:high:open") // D5 (needs the seeded value in force: step 0b)
        expect(view.points).toHaveLength(2)
        expect(view.counts).toEqual({ open: 2, high: 2, answered: 0, skipped: 0, gone: 0 })
        // Nothing of the blank, the open-ended rule, the past dates, the missing price or the model's own contradictions.
        expect(view.points.some((point) => point.origin === "ai")).toBe(false)

        const d1 = pointWith(view.points, W.fee30)
        expect(d1.choices.map((choice) => [choice.answer.kind, choice.answer.factId])).toEqual([
            ["pick", "f-ship30"],
            ["pick", "f-ship25"],
        ])
        expect(d1.factIds).toEqual(["f-ship25", "f-ship30"])
        expect(d1.line).toBe(DOSSIER_REVIEW_MESSAGES.vi["critic.inside.line"]?.replace("{{label}}", fx.insideLabel))
        const d5 = pointWith(view.points, W.basketTruth)
        expect(d5.factIds).toEqual(["f-basket", "t-basket"])
        expect(d5.choices.map((choice) => [choice.answer.kind, choice.answer.factId])).toEqual([
            ["keep_document", "f-basket"],
            ["keep_shop", "t-basket"],
        ])

        // `attempts` counts the runs in a row without progress (D-V-1): a done critique counts none.
        expect(view.review).toEqual(expect.objectContaining({ state: "done", reason: null, attempts: 0 }))
        // Held: the two fee passages (D1) and the price list (D5). Served: everything else, the vague and past-dated lines included.
        const ready = (words: string): boolean => subject.world.chunkWith(words).customerReady
        expect([ready(W.fee30), ready(W.fee25), ready(W.basket)]).toEqual([false, false, false])
        expect([ready(W.intro), ready(W.rush), ready(W.payment), ready(W.hours), ready(W.loyalEndShort)]).toEqual([true, true, true, true, true])
        expect(view.serving).toEqual({
            state: "partly",
            withheldPassages: 3,
            totalPassages: 8,
            heldPassages: 3,
            unreviewedPassages: 0,
            reasons: ["open_points"],
        })
    })
})

describe("shop-document critic: the second version of tiem-hoa-quy-dinh v2 (acceptance)", () => {
    it("v2 (one paragraph changed): ONE model call that reads only the changed passage; answered and skipped points keep their state; an identical re-upload costs no call", async () => {
        const subject = await buildCriticSubject()
        subject.script.push((bundle) => answered(scripted(bundle, fx.v1Answer)))
        const first = await uploadAndReview(subject, V1, v1Facts)
        // The founder answers D1 (the 30.000 value) and skips D5, before the new version.
        const d1 = pointWith(first.points, W.fee30)
        const d5 = pointWith(first.points, W.basketTruth)
        await subject.read.recordAnswer(WS, d1.id, {
            answer: { kind: "pick", factId: "f-ship30", value: W.pick30 },
            proposalFactId: "f-ship30",
            by: OWNER,
            note: null,
        })
        await subject.read.skip(WS, d5.id, OWNER, W.skipReason)
        expect(subject.world.chunkWith(W.fee30).customerReady).toBe(true)
        expect(subject.world.chunkWith(W.basket).customerReady).toBe(true)
        const passagesBefore = subject.world.chunks.map((chunk) => chunk.id)

        subject.script.push((bundle) => answered(scripted(bundle, fx.v2Answer)))
        const second = await uploadAndReview(subject, V2, v2Facts)

        // The index kept 7 of 8 passages; the critic read ONE.
        expect(subject.world.chunks.map((chunk) => chunk.id).filter((id) => passagesBefore.includes(id))).toHaveLength(7)
        expect(subject.model.critique).toHaveBeenCalledTimes(2)
        const bundle = subject.bundles[1]
        expect(bundle?.firstUpload).toBe(false)
        expect(bundle?.changed.map((item) => item.text)).toEqual([expect.stringContaining(fx.newRush)])
        expect(bundle?.context).toEqual([])

        const state = (words: string): string => pointWith(second.points, words).state
        expect(state(W.fee30)).toBe("answered") // D1 kept its answer
        expect(state(W.basketTruth)).toBe("skipped") // D5 kept its skip
        expect(second.points).toHaveLength(2)
        expect(second.counts).toEqual({ open: 0, high: 0, answered: 1, skipped: 1, gone: 0 })
        expect(subject.world.chunkWith(fx.newRush).customerReady).toBe(true)

        // The same text again: nothing changed, no call, the critique stays done.
        const third = await uploadAndReview(subject, V2, v2Facts)
        expect(subject.model.critique).toHaveBeenCalledTimes(2)
        expect(third.review.state).toBe("done")
        expect(third.counts).toEqual(second.counts)
    })
})

describe("shop-document critic: three failed tries (acceptance)", () => {
    it("three failed tries: the critique is NOT done (reason model), shown honestly; the changed passage stays withheld from customers, the reviewed ones stay served; a release serves nothing unreviewed", async () => {
        const subject = await buildCriticSubject()
        subject.script.push(() => answered([]))
        await uploadAndReview(subject, V2, v1Facts)
        expect(subject.world.chunkWith(W.payment).customerReady).toBe(true)

        const view = await uploadAndReview(subject, V3, v1Facts)
        expect(subject.model.critique).toHaveBeenCalledTimes(4)
        // The three tries are the calls above; `attempts` counts runs without progress (D-V-1): nothing new was reviewed, so 1.
        expect(view.review).toEqual(expect.objectContaining({ state: "not_done", reason: "model", attempts: 1 }))
        expect(subject.world.chunkWith(W.cod).customerReady).toBe(false)
        expect(subject.world.chunkWith(fx.newRush).customerReady).toBe(true)

        // The founder releases this version although its critique could not finish: the passage that only waited for review is
        // NOT served (the security read comes before anything reaches customers), nor one under an open contradiction point.
        const before = await subject.read.view(WS, SRC, ["open"])
        expect(before?.serving.reasons).toEqual(["open_points", "unreviewed"])
        expect(before?.serving.unreviewedPassages).toBe(1)
        const released = await subject.read.release(WS, SRC, OWNER)
        expect(subject.world.chunkWith(W.cod).customerReady).toBe(false)
        expect(subject.world.chunkWith(W.basket).customerReady).toBe(false)
        expect(released).toMatchObject({ state: "partly", unreviewedPassages: 1, reasons: ["open_points", "unreviewed"] })
        expect(released?.heldPassages).toBeGreaterThan(0)

        // Its review finishes clean: the critic re-gates at the end of the critique and the passage is served.
        subject.script.push(() => answered([]))
        await subject.critic.request(WS, SRC)
        await subject.critic.runWaiting(WS)
        expect(subject.world.chunkWith(W.cod).customerReady).toBe(true)
        expect(subject.world.chunkWith(W.basket).customerReady).toBe(false)

        // Answering the point is what frees its passage: the gate is set again at once.
        const open = (await subject.read.view(WS, SRC, ["open"]))?.points ?? []
        await subject.read.skip(WS, pointWith(open, W.basketTruth).id, OWNER, W.skipReason)
        expect(subject.world.chunkWith(W.basket).customerReady).toBe(true)
    })
})

describe("shop-document critic: no credits (acceptance)", () => {
    it("no credits: not done (reason credits) with no call; the first upload stays withheld from customers entirely, the contradiction points are already there", async () => {
        const subject = await buildCriticSubject()
        subject.usage.blockedBy.mockResolvedValue(true)
        const view = await uploadAndReview(subject, V1, v1Facts)
        expect(subject.model.critique).not.toHaveBeenCalled()
        expect(view.review).toEqual(expect.objectContaining({ state: "not_done", reason: "credits" }))
        expect(view.serving).toEqual({
            state: "withheld",
            withheldPassages: 8,
            totalPassages: 8,
            heldPassages: 3,
            unreviewedPassages: 5,
            reasons: ["open_points", "unreviewed"],
        })
        expect(view.counts.open).toBe(2)
    })
})

describe("shop-document critic: a part larger than one call is reviewed to its end (owner 2026-11-11: nothing withheld silently, no daily count)", () => {
    /** 60 distinct sections of about 700 characters: 42,000 characters, three calls of at most 16,000. */
    const LONG = sectionsOf(60)
    const empty = (): CritiqueTry => answered([])

    it("successive calls until every changed passage was reviewed; each call reads its own passages; all served; nothing waits", async () => {
        const subject = await buildCriticSubject()
        subject.script.push(empty, empty, empty, empty, empty)
        // 300 tries finished today: the critic no longer counts the day (only the credit pool decides).
        subject.world.critiques.push({
            id: "old",
            workspaceId: WS,
            sourceId: "other",
            state: "done",
            attempts: 300,
            finishedAt: NOW,
            reviewedHashes: [],
        })
        const view = await uploadAndReview(subject, LONG, () => [])

        const calls = subject.bundles.length
        expect(calls).toBeGreaterThanOrEqual(3)
        const read = subject.bundles.flatMap((bundle) => bundle.changed.map((item) => item.text))
        // Every passage is read exactly once over the calls.
        expect(new Set(read).size).toBe(read.length)
        expect(read).toHaveLength(subject.world.chunks.length)
        for (const bundle of subject.bundles) {
            expect(bundle.changed.reduce((sum, item) => sum + item.text.length, 0)).toBeLessThanOrEqual(16_000)
            expect(bundle.changed.length).toBeLessThanOrEqual(120)
            expect(bundle.firstUpload).toBe(true)
        }
        expect(view.review).toMatchObject({ state: "done", reason: null, waitingPassages: 0 })
        expect(view.serving).toMatchObject({ state: "served", withheldPassages: 0 })
    })

    it("a later call that fails: not done (reason model), the passages read so far are reviewed and served, the rest are counted as waiting", async () => {
        const subject = await buildCriticSubject()
        subject.script.push(empty)
        const view = await uploadAndReview(subject, LONG, () => [])

        const firstCall = subject.bundles[0]?.changed.length ?? 0
        expect(firstCall).toBeGreaterThan(0)
        expect(view.review.state).toBe("not_done")
        expect(view.review.reason).toBe("model")
        expect(view.review.waitingPassages).toBe(subject.world.chunks.length - firstCall)
        expect(view.serving.withheldPassages).toBe(subject.world.chunks.length - firstCall)
        expect(view.serving.state).toBe("partly")
        // Asking again reads only what is left.
        subject.script.push(empty, empty, empty, empty)
        const before = subject.bundles.length
        await subject.critic.request(WS, SRC)
        await subject.critic.runWaiting(WS)
        const again = await subject.read.view(WS, SRC, ["open"])
        expect(again?.review).toMatchObject({ state: "done", waitingPassages: 0 })
        const reread = subject.bundles.slice(before).flatMap((bundle) => bundle.changed.map((item) => item.text))
        expect(reread).toHaveLength(subject.world.chunks.length - firstCall)
    })

    it("the credit pool empties between calls: not done (reason credits), waiting passages counted, no further call", async () => {
        const subject = await buildCriticSubject()
        subject.script.push(empty, empty, empty, empty)
        subject.usage.blockedBy.mockReset()
        subject.usage.blockedBy.mockResolvedValueOnce(false).mockResolvedValue(true)
        const view = await uploadAndReview(subject, LONG, () => [])

        expect(subject.model.critique).toHaveBeenCalledTimes(1)
        expect(view.review).toMatchObject({ state: "not_done", reason: "credits" })
        expect(view.review.waitingPassages).toBe(subject.world.chunks.length - (subject.bundles[0]?.changed.length ?? 0))
    })
})
