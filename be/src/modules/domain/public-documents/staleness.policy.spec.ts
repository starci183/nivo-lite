import { Test } from "@nestjs/testing"
import type { SourceState } from "@modules/domain/knowledge-sources"
import { changedSourceIds, hasChanged, reviewedSourcesOf, changedReviewSourceIds } from "./staleness.policy"

const SUBJECT = Symbol("staleness.policy")
interface Subject {
    hasChanged: typeof hasChanged
    changedSourceIds: typeof changedSourceIds
    reviewedSourcesOf: typeof reviewedSourcesOf
    changedReviewSourceIds: typeof changedReviewSourceIds
}
const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: SUBJECT, useValue: { hasChanged, changedSourceIds, reviewedSourcesOf, changedReviewSourceIds } },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const recorded = { sourceId: "s1", title: "Delivery policy", contentHash: "h1" }
const state = (over: Partial<SourceState>): SourceState => ({
    id: "s1",
    title: "Delivery policy",
    visibility: "internal",
    status: "ready",
    contentHash: "h1",
    ...over,
})

describe("hasChanged", () => {
    it.each<readonly [string, SourceState | undefined, boolean]>([
        ["the same hash", state({}), false],
        ["a new hash", state({ contentHash: "h2" }), true],
        ["a text being read again", state({ contentHash: null, status: "indexing" }), false],
        ["a source that is gone", undefined, true],
        ["a source that became public", state({ visibility: "public" }), true],
    ])("%s", async (_name, current, changed) => {
        const subject = await buildSubject()

        expect(subject.hasChanged(recorded, current)).toBe(changed)
    })
})

describe("changedSourceIds", () => {
    it("names the recorded sources that changed or went", async () => {
        const subject = await buildSubject()
        const second = { sourceId: "s2", title: "Returns policy", contentHash: "k1" }
        const third = { sourceId: "s3", title: "Other", contentHash: "m1" }

        expect(
            subject.changedSourceIds([recorded, second, third], [state({}), state({ id: "s2", contentHash: "k2" })]),
        ).toEqual(new Set(["s2", "s3"]))
    })

    it("names none when nothing is recorded", async () => {
        const subject = await buildSubject()

        expect(subject.changedSourceIds([], [state({})])).toEqual(new Set())
    })
})

describe("reviewed source baseline", () => {
    it("acknowledges a new known source hash without rewriting the earlier draft provenance", async () => {
        const subject = await buildSubject()
        const current = state({ contentHash: "h2" })
        const review = subject.reviewedSourcesOf([recorded], [current])

        expect(review).toEqual([{ ...recorded, contentHash: "h2", current }])
        expect(recorded.contentHash).toBe("h1")
        expect([...subject.changedReviewSourceIds(review, [current])]).toEqual([])
        expect([...subject.changedReviewSourceIds(review, [state({ contentHash: "h3" })])]).toEqual(["s1"])
        expect([...subject.changedReviewSourceIds(review, [state({ contentHash: null, status: "indexing" })])]).toEqual(
            [],
        )
    })

    it("can acknowledge an absent source while still detecting its later return or audience change", async () => {
        const subject = await buildSubject()
        const absent = subject.reviewedSourcesOf([recorded], [])

        expect(absent[0]?.current).toBeNull()
        expect([...subject.changedReviewSourceIds(absent, [])]).toEqual([])
        expect([...subject.changedReviewSourceIds(absent, [state({})])]).toEqual(["s1"])
        const present = subject.reviewedSourcesOf([recorded], [state({})])
        expect([...subject.changedReviewSourceIds(present, [])]).toEqual(["s1"])
        expect([...subject.changedReviewSourceIds(present, [state({ visibility: "public" })])]).toEqual(["s1"])
    })
})
