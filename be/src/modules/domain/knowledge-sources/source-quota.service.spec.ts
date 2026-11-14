import { Test } from "@nestjs/testing"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { EntitlementsService } from "@modules/domain/billing"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { StorageObjectsPort } from "@modules/integrations/object-storage"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { KnowledgeSourcesError, KnowledgeSourcesErrorCode } from "./errors/knowledge-sources.error"
import { BRAIN_AREA_BYTES, BRAIN_DOCUMENTS_BYTES, MAX_UPLOAD_BYTES } from "./knowledge-sources.contracts"
import { KNOWLEDGE_STORAGE } from "./knowledge-sources.decorators"
import { KnowledgeSourcesLogEvent } from "./knowledge-sources.log-events"
import type { NormalizedSource } from "./source-input.policy"
import { KnowledgeSourceEntity } from "./persistence/entities"
import { SourceQuotaService } from "./source-quota.service"
import { HASH_STATEMENT, advisoryLockAnswers } from "@tests/fixtures/builders/advisory-lock.builder"

const WS = "11111111-1111-4111-8111-111111111111"
const MB = 1024 * 1024
const LIMIT = BRAIN_DOCUMENTS_BYTES
const AREA = BRAIN_AREA_BYTES
const PATH = `${WS}/u/menu.pdf`
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
    const entitlements = mock<EntitlementsService>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            SourceQuotaService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: KNOWLEDGE_STORAGE, useValue: storage },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: EntitlementsService, useValue: entitlements },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(SourceQuotaService), members, storage, entitlements, logger }
}
/** The aggregate per area: what the internal and the public area hold (an absent area holds nothing). */
const holding = (em: MockEntityManager, internal: number | undefined, publicBytes?: number) =>
    queueQueryBuilders(em, [
        {
            getRawMany: [
                ...(internal === undefined ? [] : [{ visibility: "internal", used: String(internal), documents: "2" }]),
                ...(publicBytes === undefined
                    ? []
                    : [{ visibility: "public", used: String(publicBytes), documents: "1" }]),
            ],
        },
    ])

describe("SourceQuotaService usage", () => {
    it("answers the bytes the workspace holds, in total and per area, and the Second Brain limits, to any member", async () => {
        const em = mockEntityManager()
        const fakes = holding(em, 3 * MB, MB)
        const { service, members } = await build(em)
        await expect(service.usage("u1", WS)).resolves.toEqual({
            usedBytes: 4 * MB,
            limitBytes: LIMIT,
            count: 3,
            areas: {
                public: { usedBytes: MB, limitBytes: AREA, leftBytes: AREA - MB, count: 1 },
                internal: { usedBytes: 3 * MB, limitBytes: AREA, leftBytes: AREA - 3 * MB, count: 2 },
            },
        })
        expect(members.require).toHaveBeenCalledWith("u1", WS)
        expect(fakes[0]?.callsOf("where")).toEqual([["ks.workspaceId = :workspaceId", { workspaceId: WS }]])
        expect(fakes[0]?.callsOf("groupBy")).toEqual([["ks.visibility"]])
    })

    it("answers the Second Brain's limits whatever the plan, and never reads the plan's storage for them", async () => {
        const em = mockEntityManager()
        holding(em, 4 * MB)
        const { service, entitlements } = await build(em)
        await expect(service.usage("u1", WS)).resolves.toMatchObject({ usedBytes: 4 * MB, limitBytes: LIMIT })
        expect(entitlements.storageLimitOf).not.toHaveBeenCalled()
    })

    it("counts nothing for a workspace with no row to sum", async () => {
        const em = mockEntityManager()
        holding(em, undefined)
        const { service } = await build(em)
        await expect(service.usage("u1", WS)).resolves.toMatchObject({
            usedBytes: 0,
            areas: { public: { usedBytes: 0, leftBytes: AREA }, internal: { usedBytes: 0, leftBytes: AREA } },
        })
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

describe("SourceQuotaService admit: the per-area cap refuses with the area's numbers", () => {
    it("takes the workspace lock, then lets into an area what fits up to its last byte", async () => {
        const em = mockEntityManager({ query: advisoryLockAnswers })
        holding(em, AREA / 2)
        const { service } = await build(em)
        await expect(service.admit(em, WS, AREA / 2, "internal")).resolves.toBeUndefined()
        expect(em.query).toHaveBeenCalledWith(HASH_STATEMENT, [`knowledge-sources:${WS}`, 0])
    })

    it("refuses what would pass the area's allowance and says what that area has used and left", async () => {
        const em = mockEntityManager({ query: advisoryLockAnswers })
        holding(em, 0, AREA - 1.6 * MB)
        const { service } = await build(em)
        await expect(service.admit(em, WS, 2 * MB, "public")).rejects.toMatchObject({
            code: codes.PublicAreaFull,
            params: { area: "public", size: "2.0", left: "1.6", usedBytes: AREA - 1.6 * MB, limitBytes: AREA },
        })
    })

    it("fills one area to the byte and refuses one byte over it while the other area is empty, though the plan has room", async () => {
        const exact = mockEntityManager({ query: advisoryLockAnswers })
        holding(exact, AREA - MB, 0)
        const fits = await build(exact)
        await expect(fits.service.admit(exact, WS, MB, "internal")).resolves.toBeUndefined()

        const over = mockEntityManager({ query: advisoryLockAnswers })
        holding(over, AREA, 0)
        const full = await build(over)
        await expect(full.service.admit(over, WS, 1, "internal")).rejects.toMatchObject({
            code: codes.InternalAreaFull,
            params: { area: "internal", usedBytes: AREA, leftBytes: 0, limitBytes: AREA },
        })
        expect(full.entitlements.requireStorageFor).not.toHaveBeenCalled()
    })

    it("admits into the public area what the full internal area could not take", async () => {
        const em = mockEntityManager({ query: advisoryLockAnswers })
        holding(em, AREA, 0)
        const { service } = await build(em)
        await expect(service.admit(em, WS, MB, "public")).resolves.toBeUndefined()
    })
})

describe("SourceQuotaService admitMove", () => {
    const rowOf = (id: string, sizeBytes: number, visibility: string): KnowledgeSourceEntity =>
        Object.assign(new KnowledgeSourceEntity(), { id, sizeBytes, visibility })

    it("counts the moving document with its parts against the area it enters, under the lock, with that area's numbers", async () => {
        const em = mockEntityManager({
            query: advisoryLockAnswers,
            find: [KnowledgeSourceEntity, [rowOf("s1", 2 * MB, "internal"), rowOf("p2", 0, "internal")]],
        })
        holding(em, 3 * MB, 4 * MB)
        const { service } = await build(em)
        await expect(service.admitMove(em, WS, ["s1", "p2"], "public")).rejects.toMatchObject({
            code: codes.PublicAreaFull,
            params: { area: "public", fileBytes: 2 * MB, usedBytes: 4 * MB, leftBytes: MB, limitBytes: AREA },
        })
        expect(em.query).toHaveBeenCalledWith(HASH_STATEMENT, [`knowledge-sources:${WS}`, 0])
    })

    it("lets a move in that fits, and counts nothing for a document already in that area", async () => {
        const fits = mockEntityManager({
            query: advisoryLockAnswers,
            find: [KnowledgeSourceEntity, [rowOf("s1", MB, "public")]],
        })
        holding(fits, 0, 4 * MB)
        await expect((await build(fits)).service.admitMove(fits, WS, ["s1"], "internal")).resolves.toBeUndefined()

        const same = mockEntityManager({
            query: advisoryLockAnswers,
            find: [KnowledgeSourceEntity, [rowOf("s1", MB, "public")]],
        })
        await expect((await build(same)).service.admitMove(same, WS, ["s1"], "public")).resolves.toBeUndefined()
        expect(same.createQueryBuilder).not.toHaveBeenCalled()
    })
})

describe("SourceQuotaService the checks before an upload", () => {
    it("prechecks a file before its upload with its area's refusal, carrying the bytes the web shows", async () => {
        const em = mockEntityManager()
        holding(em, AREA - 3.9 * MB)
        const { service } = await build(em)
        await expect(service.precheck(WS, 4.2 * MB, "internal")).rejects.toMatchObject({
            code: codes.InternalAreaFull,
            params: { area: "internal", fileBytes: 4.2 * MB, usedBytes: AREA - 3.9 * MB, limitBytes: AREA },
        })
        expect(em.query).not.toHaveBeenCalled()
    })

    it("prechecks against the workspace's whole limit when the page names no area", async () => {
        const em = mockEntityManager()
        holding(em, AREA, AREA - 3.9 * MB)
        const { service } = await build(em)
        await expect(service.precheck(WS, 4.2 * MB)).rejects.toMatchObject({
            code: codes.QuotaExceeded,
            params: { fileBytes: 4.2 * MB, usedBytes: LIMIT - 3.9 * MB, limitBytes: LIMIT },
        })
    })

    it("before an upload: a Pro workspace holding 10 GB of OTHER files may still upload brain documents up to the limit", async () => {
        const em = mockEntityManager()
        holding(em, AREA - 4 * MB)
        const { service, entitlements } = await build(em)
        // The plan check passes (20 GB plan, 10 GB used by chat pictures, media, videos); only the brain's own sum counts for its limit.
        entitlements.requireStorageFor.mockResolvedValue(undefined)
        await expect(service.beforeUpload(WS, 4 * MB, "internal")).resolves.toBeUndefined()
        expect(entitlements.requireStorageFor).toHaveBeenCalledWith(WS, 4 * MB)
    })

    it("before an upload: a plan-full workspace gets the PLAN's refusal first, before the brain's limit is read", async () => {
        const em = mockEntityManager()
        const { service, entitlements } = await build(em)
        const planFull = new Error("BILLING_STORAGE_QUOTA_EXCEEDED")
        entitlements.requireStorageFor.mockRejectedValue(planFull)
        await expect(service.beforeUpload(WS, 1 * MB, "public")).rejects.toBe(planFull)
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("before an upload with no size: the plan check alone (adding the source checks the limit under the lock)", async () => {
        const em = mockEntityManager()
        const { service, entitlements } = await build(em)
        await service.beforeUpload(WS, undefined)
        expect(entitlements.requireStorageFor).toHaveBeenCalledWith(WS, 0)
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("two uploads racing an area: each sums what is stored only AFTER the workspace lock, so the second sees the first", async () => {
        // The lock is taken before the sum (in the writing transaction): the second upload's sum includes the first one's row.
        const first = mockEntityManager({ query: advisoryLockAnswers })
        holding(first, AREA / 2)
        const a = await build(first)
        await expect(a.service.admit(first, WS, AREA / 4, "internal")).resolves.toBeUndefined()
        const second = mockEntityManager({ query: advisoryLockAnswers })
        holding(second, AREA / 2 + AREA / 4)
        const b = await build(second)
        await expect(b.service.admit(second, WS, AREA / 2, "internal")).rejects.toMatchObject({
            code: codes.InternalAreaFull,
        })
        const order = (em: MockEntityManager) => [
            em.query.mock.invocationCallOrder[0] ?? 0,
            em.createQueryBuilder.mock.invocationCallOrder[0] ?? 0,
        ]
        const [lockAt, sumAt] = order(second)
        expect(lockAt).toBeLessThan(sumAt ?? 0)
    })
})

describe("SourceQuotaService discardRefused", () => {
    const refusal = (code: KnowledgeSourcesErrorCode) => new KnowledgeSourcesError({ code })

    it("removes the uploaded object of a file the allowance refused", async () => {
        const { service, storage } = await build(mockEntityManager())
        await service.discardRefused(PATH, refusal(codes.QuotaExceeded))
        await service.discardRefused(PATH, refusal(codes.FileTooLarge))
        await service.discardRefused(PATH, refusal(codes.PublicAreaFull))
        await service.discardRefused(PATH, refusal(codes.InternalAreaFull))
        expect(storage.remove).toHaveBeenCalledTimes(4)
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

describe("SourceQuotaService a new upload of a file", () => {
    const row = (kind: "file" | "text", storagePath: string | null): KnowledgeSourceEntity =>
        Object.assign(new KnowledgeSourceEntity(), {
            id: "s1",
            kind,
            storagePath,
            sizeBytes: AREA / 4,
            visibility: "public",
        })
    const target = { workspaceId: WS, sourceId: "s1" }
    const next = { path: `${WS}/v2/menu.pdf`, bytes: AREA / 4 + MB / 2 }

    it("checks a new upload and answers its size; none when no upload was given", async () => {
        const { service, storage } = await build(mockEntityManager())
        await expect(service.uploadOf(WS, undefined)).resolves.toBeNull()
        storage.sizeOf.mockResolvedValueOnce({ kind: "ok", value: 3 * MB })
        await expect(service.uploadOf(WS, ` ${PATH} `)).resolves.toEqual({ path: PATH, bytes: 3 * MB })
        await expect(service.uploadOf(WS, "other/u/menu.pdf")).rejects.toMatchObject({ code: codes.StoragePathInvalid })
        storage.sizeOf.mockResolvedValueOnce({ kind: "refused", code: "OBJECT_STORAGE_NOT_FOUND" })
        await expect(service.uploadOf(WS, PATH)).rejects.toMatchObject({ code: codes.UploadMissing })
    })

    it("admits only the growth into the file's own area under the lock and answers the columns and the object it replaces", async () => {
        const em = mockEntityManager({
            query: advisoryLockAnswers,
            findOne: [KnowledgeSourceEntity, row("file", PATH)],
        })
        holding(em, AREA, AREA - 1 * MB)
        const { service } = await build(em)
        await expect(service.replacementOf(em, target, next)).resolves.toEqual({
            columns: { storagePath: next.path, sizeBytes: next.bytes, contentHash: null },
            replaced: PATH,
        })
        expect(em.query).toHaveBeenCalledWith(HASH_STATEMENT, [`knowledge-sources:${WS}`, 0])
    })

    it("replaces nothing for the same object or no upload", async () => {
        const em = mockEntityManager({
            query: advisoryLockAnswers,
            findOne: [KnowledgeSourceEntity, row("file", next.path)],
        })
        holding(em, 0)
        const { service } = await build(em)
        await expect(service.replacementOf(em, target, next)).resolves.toMatchObject({ replaced: null })
        await expect(service.replacementOf(em, target, null)).resolves.toEqual({ columns: {}, replaced: null })
    })

    it("refuses a new upload for a note, a gone source, or a file over one document's limit, before it takes the lock", async () => {
        const note = mockEntityManager({
            query: advisoryLockAnswers,
            findOne: [KnowledgeSourceEntity, row("text", null)],
        })
        await expect((await build(note)).service.replacementOf(note, target, next)).rejects.toMatchObject({
            code: codes.NotAFile,
        })
        const gone = mockEntityManager({ query: advisoryLockAnswers, findOne: [KnowledgeSourceEntity, null] })
        await expect((await build(gone)).service.replacementOf(gone, target, next)).rejects.toMatchObject({
            code: codes.SourceNotFound,
        })
        const big = mockEntityManager({
            query: advisoryLockAnswers,
            findOne: [KnowledgeSourceEntity, row("file", PATH)],
        })
        await expect(
            (await build(big)).service.replacementOf(big, target, { ...next, bytes: MAX_UPLOAD_BYTES + 1 }),
        ).rejects.toMatchObject({
            code: codes.FileTooLarge,
        })
        expect([note, gone, big].map((em) => em.query.mock.calls.length)).toEqual([0, 0, 0])
    })

    it("removes the replaced object after the write, never failing on storage, and waits for the announcement", async () => {
        const { service, storage, logger } = await build(mockEntityManager())
        const outage = new Error("down")
        storage.remove.mockRejectedValueOnce(outage)
        await expect(service.settleReplaced(PATH, Promise.resolve())).resolves.toBeUndefined()
        expect(storage.remove).toHaveBeenCalledWith("knowledge-uploads", [PATH])
        expect(logger.error).toHaveBeenCalledWith(KnowledgeSourcesLogEvent.ReplacedObjectKept, outage, { path: PATH })
        await service.settleReplaced(null, Promise.resolve())
        expect(storage.remove).toHaveBeenCalledTimes(1)
    })
})
