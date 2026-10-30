import { Test } from "@nestjs/testing"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { StorageObjectsPort } from "@modules/integrations/object-storage"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { KnowledgeSourcesError, KnowledgeSourcesErrorCode } from "./errors/knowledge-sources.error"
import { KNOWLEDGE_STORAGE } from "./knowledge-sources.decorators"
import type { NormalizedSource } from "./source-input.policy"
import { SourceQuotaService } from "./source-quota.service"

const WS = "11111111-1111-4111-8111-111111111111"
const MB = 1024 * 1024
const PATH = `${WS}/u/menu.pdf`
const LOCK = "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))"
const codes = KnowledgeSourcesErrorCode
const sourceOf = (fields: Partial<NormalizedSource>): NormalizedSource => ({
    kind: "text",
    title: "t",
    content: "abc",
    storagePath: null,
    sourceUrl: null,
    topic: null,
    tags: [],
    module: null,
    installationId: null,
    visibility: "internal",
    origin: null,
    ...fields,
})
const fileOf = sourceOf({ kind: "file", content: "", storagePath: PATH })

const build = async (em: MockEntityManager) => {
    const members = mock<WorkspaceMembersService>()
    const storage = mock<StorageObjectsPort>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            SourceQuotaService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: KNOWLEDGE_STORAGE, useValue: storage },
            { provide: WorkspaceMembersService, useValue: members },
        ],
    }).compile()
    return { service: moduleRef.get(SourceQuotaService), members, storage }
}
const holding = (em: MockEntityManager, used: string | undefined) =>
    queueQueryBuilders(em, [{ getRawOne: used === undefined ? undefined : { used } }])

describe("SourceQuotaService usage", () => {
    it("answers the bytes the workspace holds and its 50 MB allowance to any member", async () => {
        const em = mockEntityManager()
        const fakes = holding(em, String(3 * MB))
        const { service, members } = await build(em)
        await expect(service.usage("u1", WS)).resolves.toEqual({ usedBytes: 3 * MB, limitBytes: 50 * MB })
        expect(members.require).toHaveBeenCalledWith("u1", WS)
        expect(fakes[0]?.callsOf("where")).toEqual([["ks.workspaceId = :workspaceId", { workspaceId: WS }]])
    })

    it("counts nothing for a workspace with no row to sum", async () => {
        const em = mockEntityManager()
        holding(em, undefined)
        const { service } = await build(em)
        await expect(service.usage("u1", WS)).resolves.toMatchObject({ usedBytes: 0 })
    })
})

describe("SourceQuotaService measure", () => {
    it("reads the size of the uploaded object of a file without downloading it", async () => {
        const { service, storage } = await build(mockEntityManager())
        storage.sizeOf.mockResolvedValue({ kind: "ok", value: 5 * MB })
        await expect(service.measure(fileOf)).resolves.toBe(5 * MB)
        expect(storage.sizeOf).toHaveBeenCalledWith("knowledge-uploads", PATH)
    })

    it("counts the bytes of pasted text and nothing for a link, without asking storage", async () => {
        const { service, storage } = await build(mockEntityManager())
        await expect(service.measure(sourceOf({ content: "\u00e9" }))).resolves.toBe(2)
        await expect(service.measure(sourceOf({ kind: "url", content: "https://a.test" }))).resolves.toBe(0)
        expect(storage.sizeOf).not.toHaveBeenCalled()
    })

    it("refuses a file that was never uploaded and a storage that cannot answer", async () => {
        const { service, storage } = await build(mockEntityManager())
        storage.sizeOf.mockResolvedValueOnce({ kind: "refused", code: "OBJECT_STORAGE_NOT_FOUND" })
        await expect(service.measure(fileOf)).rejects.toMatchObject({ code: codes.UploadMissing })
        storage.sizeOf.mockResolvedValueOnce({ kind: "refused", code: "OBJECT_STORAGE_UNAVAILABLE" })
        await expect(service.measure(fileOf)).rejects.toMatchObject({ code: codes.UploadUnavailable })
    })
})

describe("SourceQuotaService admit", () => {
    it("takes the workspace lock, then lets in what fits up to the last byte", async () => {
        const em = mockEntityManager({ query: [LOCK, []] })
        holding(em, String(40 * MB))
        const { service } = await build(em)
        await expect(service.admit(em, WS, 10 * MB)).resolves.toBeUndefined()
        expect(em.query).toHaveBeenCalledWith(LOCK, [`knowledge-sources:${WS}`])
    })

    it("refuses what would pass the allowance and says what is used and left", async () => {
        const em = mockEntityManager({ query: [LOCK, []] })
        holding(em, String(48.4 * MB))
        const { service } = await build(em)
        await expect(service.admit(em, WS, 2 * MB)).rejects.toMatchObject({
            code: codes.QuotaExceeded,
            params: { size: "2.0", used: "48.4", left: "1.6", limit: "50.0" },
        })
    })
})

describe("SourceQuotaService discardRefused", () => {
    const refusal = (code: KnowledgeSourcesErrorCode) => new KnowledgeSourcesError({ code })

    it("removes the uploaded object of a file the allowance refused", async () => {
        const { service, storage } = await build(mockEntityManager())
        await service.discardRefused(PATH, refusal(codes.QuotaExceeded))
        await service.discardRefused(PATH, refusal(codes.FileTooLarge))
        expect(storage.remove).toHaveBeenCalledTimes(2)
        expect(storage.remove).toHaveBeenCalledWith("knowledge-uploads", [PATH])
    })

    it("keeps the object when the add failed for another reason or there is no file", async () => {
        const { service, storage } = await build(mockEntityManager())
        await service.discardRefused(PATH, refusal(codes.SourceNotFound))
        await service.discardRefused(PATH, new Error("db"))
        await service.discardRefused(null, refusal(codes.QuotaExceeded))
        expect(storage.remove).not.toHaveBeenCalled()
    })
})
