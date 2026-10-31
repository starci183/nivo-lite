import { Test } from "@nestjs/testing"
import { KnowledgeSourcesErrorCode } from "./errors/knowledge-sources.error"
import { MAX_UPLOAD_BYTES, WORKSPACE_SOURCE_BYTES } from "./knowledge-sources.contracts"
import { megabytesOf, quotaVerdict, rawBytesOf } from "./source-quota.policy"
import type { NormalizedSource } from "./source-input.policy"

const MB = 1024 * 1024
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
        expect(subject.quotaVerdict(10 * MB, 5 * MB)).toEqual({ kind: "ok", value: 15 * MB })
        expect(subject.quotaVerdict(WORKSPACE_SOURCE_BYTES - 1, 1)).toEqual({
            kind: "ok",
            value: WORKSPACE_SOURCE_BYTES,
        })
    })

    it("refuses a file over the single-document limit", async () => {
        const subject = await buildSubject()
        expect(subject.quotaVerdict(0, MAX_UPLOAD_BYTES + 1)).toMatchObject({
            kind: "refused",
            code: KnowledgeSourcesErrorCode.FileTooLarge,
            params: { max: "50.0" },
        })
    })

    it("refuses what would pass the workspace allowance and says how much is used and left", async () => {
        const subject = await buildSubject()
        expect(subject.quotaVerdict(48.4 * MB, 2 * MB)).toEqual({
            kind: "refused",
            code: KnowledgeSourcesErrorCode.QuotaExceeded,
            params: { size: "2.0", used: "48.4", left: "1.6", limit: "50.0" },
        })
    })

    it("never reports a negative remainder", async () => {
        const subject = await buildSubject()
        expect(subject.quotaVerdict(WORKSPACE_SOURCE_BYTES + MB, 1)).toMatchObject({ params: { left: "0.0" } })
    })
})
