import { Test } from "@nestjs/testing"
import { KnowledgeSourcesErrorCode } from "./errors/knowledge-sources.error"
import { BRAIN_AREA_BYTES, BRAIN_DOCUMENTS_BYTES, MAX_UPLOAD_BYTES } from "./knowledge-sources.contracts"
import { areaVerdict, areasUsageOf, megabytesOf, quotaVerdict, rawBytesOf } from "./source-quota.policy"
import type { NormalizedSource } from "./source-input.policy"

const MB = 1024 * 1024
const LIMIT = BRAIN_DOCUMENTS_BYTES
const SUBJECT = Symbol("source-quota.policy")
type Subject = { megabytesOf: typeof megabytesOf; quotaVerdict: typeof quotaVerdict; rawBytesOf: typeof rawBytesOf }
const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { megabytesOf, quotaVerdict, rawBytesOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}
const sourceOf = (kind: NormalizedSource["kind"], content: string): NormalizedSource => ({
    kind,
    title: "t",
    content,
    storagePath: null,
    sourceUrl: null,
    topic: null,
    tags: [],
    module: null,
    installationId: null,
    visibility: "internal",
    origin: null,
})

describe("megabytesOf", () => {
    it("prints one decimal", async () => {
        const subject = await buildSubject()
        expect(subject.megabytesOf(48.4 * MB)).toBe("48.4")
        expect(subject.megabytesOf(0)).toBe("0.0")
    })
})

describe("rawBytesOf", () => {
    it("counts the file, the bytes of pasted text, and nothing for a link", async () => {
        const subject = await buildSubject()
        expect(subject.rawBytesOf(sourceOf("file", ""), 1234)).toBe(1234)
        expect(subject.rawBytesOf(sourceOf("text", "\u00e9"), 0)).toBe(2)
        expect(subject.rawBytesOf(sourceOf("faq", "ab"), 0)).toBe(2)
        expect(subject.rawBytesOf(sourceOf("url", "https://a.b"), 0)).toBe(0)
    })
})

describe("quotaVerdict", () => {
    it("admits what fits, up to the last byte", async () => {
        const subject = await buildSubject()
        expect(subject.quotaVerdict(LIMIT / 2, LIMIT / 4)).toEqual({ kind: "ok", value: LIMIT / 2 + LIMIT / 4 })
        expect(subject.quotaVerdict(BRAIN_DOCUMENTS_BYTES - 1, 1)).toEqual({
            kind: "ok",
            value: BRAIN_DOCUMENTS_BYTES,
        })
    })

    it("refuses a file over the single-document limit", async () => {
        const subject = await buildSubject()
        expect(subject.quotaVerdict(0, MAX_UPLOAD_BYTES + 1)).toMatchObject({
            kind: "refused",
            code: KnowledgeSourcesErrorCode.FileTooLarge,
            params: { max: megabytesOf(MAX_UPLOAD_BYTES) },
        })
    })

    it("refuses what would pass the workspace allowance and says how much is used and left", async () => {
        const subject = await buildSubject()
        expect(subject.quotaVerdict(LIMIT - 1.6 * MB, 2 * MB)).toEqual({
            kind: "refused",
            code: KnowledgeSourcesErrorCode.QuotaExceeded,
            params: {
                size: "2.0",
                used: megabytesOf(LIMIT - 1.6 * MB),
                left: "1.6",
                limit: megabytesOf(LIMIT),
                fileBytes: 2 * MB,
                usedBytes: LIMIT - 1.6 * MB,
                leftBytes: LIMIT - (LIMIT - 1.6 * MB),
                limitBytes: LIMIT,
            },
        })
    })

    it("never reports a negative remainder", async () => {
        const subject = await buildSubject()
        expect(subject.quotaVerdict(BRAIN_DOCUMENTS_BYTES + MB, 1)).toMatchObject({ params: { left: "0.0" } })
    })
})

describe("the Second Brain documents limit (owner: 10 MB since 2026-11-12, every workspace, not the plan's storage)", () => {
    it("is 10 MB, and one document is never larger than it", () => {
        expect(BRAIN_DOCUMENTS_BYTES).toBe(10 * MB)
        expect(MAX_UPLOAD_BYTES).toBeLessThanOrEqual(BRAIN_DOCUMENTS_BYTES)
        expect(quotaVerdict(LIMIT, 1)).toMatchObject({
            kind: "refused",
            params: { limit: megabytesOf(LIMIT), left: "0.0" },
        })
    })
})

describe("source-quota.policy: the per-area cap refuses with the area's numbers", () => {
    const held = (publicBytes: number, internalBytes: number) =>
        areasUsageOf({ public: { used: publicBytes, count: 1 }, internal: { used: internalBytes, count: 2 } })

    it("holds 5 MB in each area and 10 MB in total", () => {
        expect(BRAIN_AREA_BYTES).toBe(5 * MB)
        expect(BRAIN_DOCUMENTS_BYTES).toBe(2 * BRAIN_AREA_BYTES)
        expect(MAX_UPLOAD_BYTES).toBe(BRAIN_AREA_BYTES)
    })

    it("admits a laundry price list that fits its area, whatever the other area holds", () => {
        expect(areaVerdict(held(4 * MB, 5 * MB), "public", MB)).toEqual({ kind: "ok", value: 5 * MB })
    })

    it("refuses the public area with the public area's used / left / limit", () => {
        expect(areaVerdict(held(4.5 * MB, 0), "public", MB)).toEqual({
            kind: "refused",
            code: KnowledgeSourcesErrorCode.PublicAreaFull,
            params: {
                area: "public",
                size: "1.0",
                used: "4.5",
                left: "0.5",
                limit: "5.0",
                fileBytes: MB,
                usedBytes: 4.5 * MB,
                leftBytes: 0.5 * MB,
                limitBytes: 5 * MB,
            },
        })
    })

    it("refuses the internal area with the internal area's numbers, never the public one's", () => {
        expect(areaVerdict(held(0, 4.8 * MB), "internal", 0.5 * MB)).toMatchObject({
            kind: "refused",
            code: KnowledgeSourcesErrorCode.InternalAreaFull,
            params: { area: "internal", usedBytes: 4.8 * MB, limitBytes: 5 * MB },
        })
    })

    it("refuses one document larger than an area as too large, before any area count", () => {
        expect(areaVerdict(held(0, 0), "internal", 5 * MB + 1)).toMatchObject({
            kind: "refused",
            code: KnowledgeSourcesErrorCode.FileTooLarge,
        })
    })

    it("says what each area has left, never below zero", () => {
        expect(held(6 * MB, MB)).toEqual({
            public: { usedBytes: 6 * MB, limitBytes: 5 * MB, leftBytes: 0, count: 1 },
            internal: { usedBytes: MB, limitBytes: 5 * MB, leftBytes: 4 * MB, count: 2 },
        })
    })
})
