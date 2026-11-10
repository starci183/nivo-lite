import { Test } from "@nestjs/testing"
import { FakeClock, fakeIds, fakeTransaction, mock, mockEntityManager, recordingEventBus } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { EntitlementsService } from "@modules/domain/billing"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { StorageObjectsPort } from "@modules/integrations/object-storage"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { EVENT_BUS } from "@modules/platform/event-bus"
import { IDS } from "@modules/platform/ids"
import { KnowledgeQueue } from "@modules/queues/knowledge"
import { KnowledgeSourcesErrorCode } from "./errors/knowledge-sources.error"
import { KnowledgeProgressService } from "./knowledge-progress.service"
import { KNOWLEDGE_STORAGE } from "./knowledge-sources.decorators"
import { KnowledgeSourcesService } from "./knowledge-sources.service"
import { KnowledgeSourceEntity } from "./persistence/entities"
import { NOW } from "./source-input.policy"
import { SourcePartsService } from "./source-parts.service"
import { SourceQuotaService } from "./source-quota.service"

const WS = "11111111-1111-4111-8111-111111111111"
const AT = "2026-11-11T10:00:00.000Z"
const NEXT = { path: `${WS}/v2/bang-gia.xlsx`, bytes: 3500 }
const OLD = `${WS}/v1/bang-gia.xlsx`
const COLUMNS = { storagePath: NEXT.path, sizeBytes: NEXT.bytes, contentHash: null }

const build = async (em: MockEntityManager) => {
    const storage = mock<StorageObjectsPort>()
    const queue = mock<KnowledgeQueue>()
    const quota = mock<SourceQuotaService>()
    const progress = mock<KnowledgeProgressService>()
    progress.announce.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            KnowledgeSourcesService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(AT) },
            { provide: KNOWLEDGE_STORAGE, useValue: storage },
            { provide: WorkspaceMembersService, useValue: mock<WorkspaceMembersService>() },
            { provide: KnowledgeQueue, useValue: queue },
            { provide: EVENT_BUS, useValue: recordingEventBus() },
            { provide: EntitlementsService, useValue: mock<EntitlementsService>() },
            { provide: InstallationRecordsService, useValue: mock<InstallationRecordsService>() },
            { provide: SourceQuotaService, useValue: quota },
            { provide: KnowledgeProgressService, useValue: progress },
            { provide: SourcePartsService, useValue: mock<SourcePartsService>() },
            { provide: IDS, useValue: fakeIds() },
        ],
    }).compile()
    return { service: moduleRef.get(KnowledgeSourcesService), storage, queue, quota, progress }
}

describe("KnowledgeSourcesService a new upload of the same document", () => {
    it("writes the new object with a cleared hash, queues the reading and removes the replaced object after the write", async () => {
        const tx = fakeTransaction(mockEntityManager({ update: [KnowledgeSourceEntity, { affected: 1 }] }))
        const { service, quota, queue, progress } = await build(tx.em)
        quota.uploadOf.mockResolvedValue(NEXT)
        quota.replacementOf.mockResolvedValue({ columns: COLUMNS, replaced: OLD })

        await expect(service.reindexSource("u1", WS, { sourceId: "s1", storagePath: NEXT.path })).resolves.toEqual({
            id: "s1",
        })

        expect(quota.uploadOf).toHaveBeenCalledWith(WS, NEXT.path)
        expect(quota.replacementOf).toHaveBeenCalledWith(expect.anything(), { workspaceId: WS, sourceId: "s1" }, NEXT)
        expect(tx.em.update).toHaveBeenCalledWith(KnowledgeSourceEntity, expect.anything(), {
            status: "queued",
            progress: 0,
            error: null,
            stage: null,
            stageDone: null,
            stageTotal: null,
            ...COLUMNS,
            updatedAt: NOW,
        })
        expect(queue.enqueueIndex).toHaveBeenCalledWith(
            { sourceId: "s1", workspaceId: WS },
            expect.anything(),
            Date.parse(AT),
        )
        expect(quota.settleReplaced).toHaveBeenCalledWith(OLD, expect.any(Promise))
        expect(progress.announce).toHaveBeenCalledWith(WS, "s1")
        expect(tx.commits).toBe(1)
    })

    it("leaves the old object and queues nothing when a worker is on the source", async () => {
        const tx = fakeTransaction(
            mockEntityManager({
                update: [KnowledgeSourceEntity, { affected: 0 }],
                findOne: [
                    KnowledgeSourceEntity,
                    Object.assign(new KnowledgeSourceEntity(), { id: "s1", origin: null }),
                ],
            }),
        )
        const { service, quota, queue } = await build(tx.em)
        quota.uploadOf.mockResolvedValue(NEXT)
        quota.replacementOf.mockResolvedValue({ columns: COLUMNS, replaced: OLD })

        await expect(service.reindexSource("u1", WS, { sourceId: "s1", storagePath: NEXT.path })).resolves.toEqual({
            id: "s1",
        })
        expect(queue.enqueueIndex).not.toHaveBeenCalled()
        expect(quota.settleReplaced).not.toHaveBeenCalled()
    })

    it("lets a refused upload out before anything is written", async () => {
        const tx = fakeTransaction(mockEntityManager())
        const { service, quota } = await build(tx.em)
        quota.uploadOf.mockResolvedValue(NEXT)
        quota.replacementOf.mockRejectedValue(
            Object.assign(new Error("not a file"), { code: KnowledgeSourcesErrorCode.NotAFile }),
        )

        await expect(service.reindexSource("u1", WS, { sourceId: "s1", storagePath: NEXT.path })).rejects.toMatchObject(
            {
                code: KnowledgeSourcesErrorCode.NotAFile,
            },
        )
        expect(tx.em.update).not.toHaveBeenCalled()
    })
})

describe("KnowledgeSourcesService upload door", () => {
    it("refuses an old Office file and a file the browser says is too large before signing anything", async () => {
        const { service, storage } = await build(mockEntityManager())
        await expect(service.createUpload("u1", WS, "bang-gia.xls", "")).rejects.toMatchObject({
            code: KnowledgeSourcesErrorCode.LegacyOffice,
        })
        await expect(
            service.createUpload("u1", WS, "scan.pdf", "application/pdf", 60 * 1024 * 1024),
        ).rejects.toMatchObject({
            code: KnowledgeSourcesErrorCode.FileTooLarge,
            params: { size: 60, max: 50 },
        })
        expect(storage.signedUpload).not.toHaveBeenCalled()
    })

    it("signs a photo of a price list and an HTML page", async () => {
        const { service, storage } = await build(mockEntityManager())
        storage.signedUpload.mockResolvedValue({ kind: "ok", value: { path: "p", token: "t", signedUrl: "u" } })
        await expect(service.createUpload("u1", WS, "bang-gia.JPG", "", 2000)).resolves.toMatchObject({
            contentType: "image/jpeg",
        })
        await expect(service.createUpload("u1", WS, "gioi-thieu.html", "")).resolves.toMatchObject({
            contentType: "text/html",
        })
    })
})
