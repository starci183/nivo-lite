import {
    answered,
    buildCriticSubject,
    rowOf,
    sectionsOf,
    uploadAndReview,
    v1Facts,
} from "@tests/fixtures/builders/dossier-review-critic.builder"
import { NOW, SRC, V1, WS } from "@tests/fixtures/builders/dossier-review-world.builder"
import type { CritiqueTry } from "./document-critic.port"
import { DossierReviewError, DossierReviewErrorCode } from "./errors/dossier-review.error"

/**
 * ACCEPTANCE of the shop-document critic over the brain test documents (`tiem-hoa-quy-dinh.md` v1 and v2, deliberate defects D1-D6),
 * through the REAL services (`DocumentCriticService`, `DocumentCritiqueReadService`) and the real policies, on the in-memory world of
 * `dossier-review-world.builder` with a SCRIPTED critic model (no real model call): the isolation per document and the resumable,
 * bounded tries of the security read (the one model call left).
 */

describe("shop-document critic: isolated per document (D-N-3; owner 2026-11-11: it must hold on a large corpus)", () => {
    const empty = (): CritiqueTry => answered([])


    it("D-N-3: only a WAITING critique is taken; a not_done one is asked for again through the request, and runs with no reason left on it", async () => {
        const subject = await buildCriticSubject()
        await uploadAndReview(subject, V1, v1Facts)
        expect(rowOf(subject)).toMatchObject({ state: "not_done", reason: "model" })
        const calls = subject.bundles.length

        // Another run of the workspace that picked the same row a moment ago: the critique is not its to take.
        await expect(subject.critic.critique(WS, SRC)).resolves.toMatchObject({ state: "skipped" })
        expect(rowOf(subject)).toMatchObject({ state: "not_done", reason: "model" })
        expect(subject.bundles).toHaveLength(calls)

        // Asked again: it waits, then runs; while the model reads, the row is running with NO reason (the table's check).
        const seen: Array<unknown> = []
        subject.script.push(() => {
            seen.push([rowOf(subject).state, rowOf(subject).reason])
            return answered([])
        })
        await subject.critic.request(WS, SRC)
        await subject.critic.runWaiting(WS)
        expect(seen).toEqual([["running", null]])
        expect(rowOf(subject)).toMatchObject({ state: "done", reason: null })
    })

    it("D-N-3: one document whose critique fails never ends the batch: the next document of the workspace is still critiqued", async () => {
        const subject = await buildCriticSubject()
        subject.world.upload(V1)
        subject.world.facts = v1Facts(subject.world)
        subject.world.critiques.push({ id: "bad", workspaceId: WS, sourceId: "bad-source", state: "waiting", reason: null, reviewedHashes: [], requestedAt: NOW })
        await subject.critic.request(WS, SRC)
        subject.script.push(empty)
        const real = subject.critic.critique.bind(subject.critic)
        jest.spyOn(subject.critic, "critique").mockImplementation((workspaceId, sourceId) =>
            sourceId === "bad-source"
                ? Promise.reject(new DossierReviewError({ code: DossierReviewErrorCode.CriticNotFound }))
                : real(workspaceId, sourceId),
        )

        await expect(subject.critic.runWaiting(WS)).resolves.toBe(1)
        expect(rowOf(subject)).toMatchObject({ state: "done", reason: null })
    })
})

describe("shop-document critic: resumable, and a try is never the one before it sent again (D-N-2, D-N-4)", () => {
    /** 60 distinct sections of about 700 characters: 42,000 characters, three calls of at most 16,000. */
    const LONG = sectionsOf(60)
    const empty = (): CritiqueTry => answered([])
    const failed = (reason: "unreadable" | "cut" | "unavailable") => (): CritiqueTry => ({ ok: false, reason })


    it("D-N-2: an unreadable answer is asked again ONCE, told what was wrong; unreadable again ends the tries at two calls, never three identical ones", async () => {
        const subject = await buildCriticSubject()
        subject.script.push(failed("unreadable"), failed("unreadable"), empty)
        const view = await uploadAndReview(subject, V1, v1Facts)

        expect(subject.model.critique).toHaveBeenCalledTimes(2)
        expect(jest.mocked(subject.model.critique).mock.calls.map(([, after]) => after)).toEqual([undefined, "unreadable"])
        // The two tries are the calls above; `attempts` counts runs without progress (D-V-1): no passage was reviewed, so 1.
        expect(view.review).toEqual(expect.objectContaining({ state: "not_done", reason: "model", attempts: 1 }))
    })

    it("D-N-2: an answer cut at the token cap is asked again over HALF the passages; the rest are read by the next call; the document ends done", async () => {
        const subject = await buildCriticSubject()
        subject.script.push(failed("cut"), empty, empty, empty, empty, empty, empty)
        const view = await uploadAndReview(subject, LONG, () => [])

        const [cut, half] = subject.bundles
        expect(half?.changed.length).toBeLessThan(cut?.changed.length ?? 0)
        expect(half?.changed.map((item) => item.text)).toEqual(cut?.changed.slice(0, half?.changed.length).map((item) => item.text))
        // Every passage was read by a call that answered, exactly once.
        const read = subject.bundles.slice(1).flatMap((bundle) => bundle.changed.map((item) => item.text))
        expect(new Set(read).size).toBe(read.length)
        expect(read).toHaveLength(subject.world.chunks.length)
        expect(view.review).toMatchObject({ state: "done", reason: null, waitingPassages: 0 })
    })

    it("a critique that dies in the middle keeps what its finished calls read: asked again it reads only the rest (nothing is paid for twice)", async () => {
        const subject = await buildCriticSubject()
        subject.script.push(empty, () => {
            throw new DossierReviewError({ code: DossierReviewErrorCode.CriticNotFound })
        })
        await uploadAndReview(subject, LONG, () => [])
        const first = subject.bundles[0]?.changed.length ?? 0
        expect(rowOf(subject)).toMatchObject({ state: "not_done", reason: "model" })
        expect(rowOf(subject).reviewedHashes).toHaveLength(first)

        subject.script.push(empty, empty, empty, empty, empty)
        await subject.critic.request(WS, SRC)
        await subject.critic.runWaiting(WS)
        const again = subject.bundles.slice(2).flatMap((bundle) => bundle.changed.map((item) => item.text))
        const before = new Set(subject.bundles[0]?.changed.map((item) => item.text))
        expect(again.some((text) => before.has(text))).toBe(false)
        expect(again).toHaveLength(subject.world.chunks.length - first)
        expect(rowOf(subject)).toMatchObject({ state: "done", reason: null })
    })
})
