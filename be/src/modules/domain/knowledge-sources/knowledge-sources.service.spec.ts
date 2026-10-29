import { row, summary, readable } from "@tests/fixtures/builders/knowledge-sources.builder"
import { Test } from "@nestjs/testing"
import { Brackets, In } from "typeorm"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { FakeClock, builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import type { InstallationRecord } from "@modules/domain/module-installations"
import { EntitlementsService } from "@modules/domain/billing"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { StorageObjectsPort } from "@modules/integrations/object-storage"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { IDS } from "@modules/platform/ids"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { EVENT_BUS } from "@modules/platform/event-bus"
import type { EventBus } from "@modules/platform/event-bus"
import { KnowledgeQueue } from "@modules/queues/knowledge"
import { KnowledgeSourcesErrorCode } from "./errors/knowledge-sources.error"
import { StoredNote } from "./knowledge-sources.contracts"
import type { AddSourceInput } from "./knowledge-sources.contracts"
import { KNOWLEDGE_STORAGE } from "./knowledge-sources.decorators"
import { KnowledgeSourcesLogEvent } from "./knowledge-sources.log-events"
import { KnowledgeSourcesService } from "./knowledge-sources.service"
import { KnowledgeSourceEntity } from "./persistence/entities"
import { NOW } from "./source-input.policy"

const WS = "11111111-1111-4111-8111-111111111111"
const AT = "2026-10-12T10:00:00.000Z"
const codes = KnowledgeSourcesErrorCode
const job = { sourceId: "s1", workspaceId: WS }
const missing = { code: codes.SourceNotFound }
const listRowOf = builder<KnowledgeSourceEntity>({ ...row, createdAt: new Date("2026-10-11T10:00:00.000Z") })
const readableRowOf = builder({
    id: "shared",
    title: "T",
    topic: null,
    kind: "text",
    visibility: "public",
    content: "c" as string | null,
    module: null as string | null,
    installationId: null as string | null,
    updatedAt: AT,
})
const KEY = { id: "s1", workspaceId: WS }
const touched = (changes: object) => [{ ...changes, updatedAt: NOW }]
const instance = { id: "i1", workspaceId: WS, moduleKey: "chatbot" }
const inputOf = builder<AddSourceInput>({ kind: "text", title: "Hours", content: "Open 8 to 21" })
/** A manager that hands out one fake statement per createQueryBuilder call, in order. */
const withStatements = (em: MockEntityManager, ...answers: Array<QueryBuilderAnswers>) => ({
    em,
    fakes: queueQueryBuilders(em, answers),
})
const build = async (em: MockEntityManager) => {
    const members = mock<WorkspaceMembersService>()
    const queue = mock<KnowledgeQueue>()
    const bus = mock<EventBus>()
    bus.publish.mockResolvedValue(undefined)
    const storage = mock<StorageObjectsPort>()
    const logger = mock<Logger>()
    const entitlements = mock<EntitlementsService>()
    const installations = mock<InstallationRecordsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            KnowledgeSourcesService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(AT) },
            { provide: KNOWLEDGE_STORAGE, useValue: storage },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: KnowledgeQueue, useValue: queue },
            { provide: EVENT_BUS, useValue: bus },
            { provide: EntitlementsService, useValue: entitlements },
            { provide: LOGGER, useValue: logger },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: IDS, useValue: { next: () => "uuid-1" } },
        ],
    }).compile()
    return { service: moduleRef.get(KnowledgeSourcesService), members, queue, bus, storage, logger, installations }
}
describe("KnowledgeSourcesService", () => {
    it("counts documents allowed for each audience and defaults an absent count to zero", async () => {
        const { em, fakes } = withStatements(mockEntityManager(), { getCount: 3 }, { getCount: 3 }, { getCount: 0 })
        const { service } = await build(em)
        const scope = { workspaceId: WS, module: "chatbot", installationId: null, audience: "customer" as const }
        await expect(service.countReadable(scope, "internal")).resolves.toBe(0)
        await expect(service.countReadable(scope, "public")).resolves.toBe(3)
        await expect(service.countReadable({ ...scope, audience: "internal" }, "internal")).resolves.toBe(3)
        await expect(service.countReadable({ ...scope, audience: "internal" }, "public")).resolves.toBe(0)
        expect(em.createQueryBuilder).toHaveBeenCalledTimes(3)
        expect(fakes[0]?.callsOf("where")).toEqual([[{ workspaceId: WS, status: In(["ready", "extracting_facts"]) }]])
        expect(fakes[0]?.callsOf("andWhere")).toEqual([
            [expect.any(Brackets)],
            [expect.any(Brackets)],
            [{ visibility: "public" }],
            [{ visibility: "public" }],
        ])
        expect(fakes[1]?.callsOf("andWhere")).toEqual([
            [expect.any(Brackets)],
            [expect.any(Brackets)],
            [{ visibility: "internal" }],
        ])
    })
})

describe("KnowledgeSourcesService addSource", () => {
    it("authorizes the manager and atomically writes the source with its indexing job", async () => {
        const tx = fakeTransaction(
            mockEntityManager({ insert: [KnowledgeSourceEntity, { identifiers: [{ id: "s1" }] }] }),
        )
        const { service, members, queue } = await build(tx.em)
        await expect(service.addSource("u1", WS, inputOf({ tags: ["a"], topic: "Open" }))).resolves.toEqual({
            id: "s1",
        })
        expect(members.require).toHaveBeenCalledWith("u1", WS, ["owner", "manager"])
        expect(tx.em.insert).toHaveBeenCalledWith(KnowledgeSourceEntity, {
            workspaceId: WS,
            module: null,
            installationId: null,
            kind: "text",
            topic: "Open",
            tags: ["a"],
            visibility: "internal",
            title: "Hours",
            content: "Open 8 to 21",
            status: "queued",
            progress: 0,
            storagePath: null,
            sourceUrl: null,
            origin: null,
            createdBy: "u1",
        })
        expect(queue.enqueueIndex).toHaveBeenCalledWith(job, expect.anything())
        expect(tx.commits).toBe(1)
    })

    it("keeps a document for one agent instance and takes the module of its type", async () => {
        const tx = fakeTransaction(
            mockEntityManager({ insert: [KnowledgeSourceEntity, { identifiers: [{ id: "s1" }] }] }),
        )
        const { service, installations } = await build(tx.em)
        installations.find.mockResolvedValue(mock<InstallationRecord>(instance))
        await service.addSource("u1", WS, inputOf({ installationId: "i1", module: "sales" }))
        expect(installations.find).toHaveBeenCalledWith(WS, "i1")
        expect(tx.em.insert).toHaveBeenCalledWith(
            KnowledgeSourceEntity,
            expect.objectContaining({ module: "chatbot", installationId: "i1" }),
        )
    })

    it("refuses an agent instance of another workspace", async () => {
        const { service, queue, installations } = await build(mockEntityManager())
        installations.find.mockResolvedValue(null)
        await expect(service.addSource("u1", WS, inputOf({ installationId: "i9" }))).rejects.toMatchObject({
            code: codes.InstanceUnknown,
        })
        expect(queue.enqueueIndex).not.toHaveBeenCalled()
    })

    it("refuses input that does not pass the checks, before it writes anything", async () => {
        const em = mockEntityManager()
        const { service } = await build(em)
        await expect(service.addSource("u1", WS, inputOf({ kind: "audio" }))).rejects.toMatchObject({
            code: codes.SourceKindUnknown,
        })
        expect(em.insert).not.toHaveBeenCalled()
    })

    it("fails when the insert answers no row", async () => {
        const tx = fakeTransaction(mockEntityManager({ insert: [KnowledgeSourceEntity, { identifiers: [] }] }))
        const { service, queue } = await build(tx.em)
        await expect(service.addSource("u1", WS, inputOf())).rejects.toMatchObject(missing)
        expect(queue.enqueueIndex).not.toHaveBeenCalled()
        expect(tx.rollbacks).toBe(1)
    })
})

describe("KnowledgeSourcesService addSource", () => {
    it("does not write for a caller who is not a manager", async () => {
        const em = mockEntityManager()
        const { service, members } = await build(em)
        const refusal = new Error("role")
        members.require.mockRejectedValue(refusal)
        await expect(service.addSource("u1", WS, inputOf())).rejects.toBe(refusal)
        expect(em.insert).not.toHaveBeenCalled()
    })
})

describe("KnowledgeSourcesService retrySource", () => {
    it("queues a failed source again with the retry instant", async () => {
        const tx = fakeTransaction(mockEntityManager({ update: [KnowledgeSourceEntity, { affected: 1 }] }))
        const { service, queue } = await build(tx.em)
        await expect(service.retrySource("u1", WS, "s1")).resolves.toEqual({ id: "s1" })
        expect(tx.em.update).toHaveBeenCalledWith(
            KnowledgeSourceEntity,
            { ...KEY, status: In(["failed", "blocked_credits"]) },
            ...touched({ status: "queued", progress: 0, error: null }),
        )
        expect(queue.enqueueIndex).toHaveBeenCalledWith(job, expect.anything(), Date.parse(AT))
    })

    it("leaves a source that is not failed or blocked as it is", async () => {
        const tx = fakeTransaction(mockEntityManager({ update: [KnowledgeSourceEntity, { affected: 0 }] }))
        const { service, queue } = await build(tx.em)
        await expect(service.retrySource("u1", WS, "s1")).resolves.toEqual({ id: "s1" })
        expect(queue.enqueueIndex).not.toHaveBeenCalled()
    })
})

describe("KnowledgeSourcesService reindexSource", () => {
    it("queues the source again, replacing its text when new text is given", async () => {
        const tx = fakeTransaction(mockEntityManager({ update: [KnowledgeSourceEntity, { affected: 1 }] }))
        const { service, queue } = await build(tx.em)
        await expect(service.reindexSource("u1", WS, { sourceId: "s1", content: " new " })).resolves.toEqual({
            id: "s1",
        })
        expect(tx.em.update).toHaveBeenCalledWith(
            KnowledgeSourceEntity,
            KEY,
            ...touched({ status: "queued", progress: 0, error: null, content: "new" }),
        )
        expect(queue.enqueueIndex).toHaveBeenCalledWith(expect.anything(), expect.anything(), Date.parse(AT))
    })

    it("keeps the text when none is given", async () => {
        const tx = fakeTransaction(mockEntityManager({ update: [KnowledgeSourceEntity, { affected: 1 }] }))
        const { service } = await build(tx.em)
        await service.reindexSource("u1", WS, { sourceId: "s1" })
        expect(tx.em.update).toHaveBeenCalledWith(
            KnowledgeSourceEntity,
            KEY,
            ...touched({ status: "queued", progress: 0, error: null }),
        )
    })

    it("refuses an unknown source and an empty text", async () => {
        const tx = fakeTransaction(mockEntityManager({ update: [KnowledgeSourceEntity, { affected: 0 }] }))
        const { service } = await build(tx.em)
        await expect(service.reindexSource("u1", WS, { sourceId: "s1" })).rejects.toMatchObject(missing)
        await expect(service.reindexSource("u1", WS, { sourceId: "s1", content: " " })).rejects.toMatchObject({
            code: codes.ContentEmpty,
        })
    })
})

describe("KnowledgeSourcesService updateSource", () => {
    it("changes the metadata of the source", async () => {
        const em = mockEntityManager({ update: [KnowledgeSourceEntity, { affected: 1 }] })
        const { service } = await build(em)
        await service.updateSource("u1", WS, { sourceId: "s1", title: "T", tags: ["a"], visibility: "public" })
        expect(em.update).toHaveBeenCalledWith(
            KnowledgeSourceEntity,
            KEY,
            ...touched({ title: "T", tags: ["a"], visibility: "public" }),
        )
    })

    it("keeps the tags when none are given", async () => {
        const em = mockEntityManager({ update: [KnowledgeSourceEntity, { affected: 1 }] })
        const { service } = await build(em)
        await service.updateSource("u1", WS, { sourceId: "s1" })
        expect(em.update).toHaveBeenCalledWith(KnowledgeSourceEntity, KEY, ...touched({}))
    })

    it("refuses an unknown source", async () => {
        const { service } = await build(mockEntityManager({ update: [KnowledgeSourceEntity, { affected: 0 }] }))
        await expect(service.updateSource("u1", WS, { sourceId: "s1" })).rejects.toMatchObject(missing)
    })
})

describe("KnowledgeSourcesService removeSource", () => {
    it("deletes the source and answers its title", async () => {
        const { em, fakes } = withStatements(mockEntityManager(), { execute: { raw: [{ title: "Menu" }] } })
        const { service } = await build(em)
        await expect(service.removeSource("u1", WS, "s1")).resolves.toEqual({ title: "Menu" })
        expect(fakes[0]?.callsOf("where")).toEqual([[KEY]])
        expect(fakes[0]?.callsOf("returning")).toEqual([["title"]])
    })

    it("refuses an unknown source", async () => {
        const { em } = withStatements(mockEntityManager(), { execute: { raw: [] } })
        const { service } = await build(em)
        await expect(service.removeSource("u1", WS, "s1")).rejects.toMatchObject(missing)
    })
})

describe("KnowledgeSourcesService createUpload", () => {
    it("answers the signed address of a safe object path in the workspace folder", async () => {
        const { service, storage } = await build(mockEntityManager())
        const signed = { path: `${WS}/uuid-1/my_file.pdf`, token: "t", signedUrl: "https://s.test/u" }
        storage.signedUpload.mockResolvedValue({ kind: "ok", value: signed })
        await expect(service.createUpload("u1", WS, "my file.pdf")).resolves.toEqual(signed)
        expect(storage.signedUpload).toHaveBeenCalledWith("knowledge-uploads", `${WS}/uuid-1/my_file.pdf`)
    })

    it("refuses an empty name and a storage that cannot sign", async () => {
        const { service, storage } = await build(mockEntityManager())
        storage.signedUpload.mockResolvedValue({ kind: "refused", code: "OBJECT_STORAGE_UNAVAILABLE" })
        await expect(service.createUpload("u1", WS, " ")).rejects.toMatchObject({ code: codes.FileNameRequired })
        await expect(service.createUpload("u1", WS, "a.pdf")).rejects.toMatchObject({
            code: codes.UploadUnavailable,
        })
    })
})

describe("KnowledgeSourcesService requestReembed", () => {
    it("queues the re-embedding with the given model after proving the caller manages the workspace", async () => {
        const tx = fakeTransaction(mockEntityManager())
        const { service, members, queue } = await build(tx.em)
        await service.requestReembed("u1", WS, "m1")
        expect(members.require).toHaveBeenCalledWith("u1", WS, ["owner", "manager"])
        expect(queue.enqueueReembed).toHaveBeenCalledWith({ workspaceId: WS, model: "m1" }, expect.anything())
        expect(tx.commits).toBe(1)
    })
})

describe("KnowledgeSourcesService continueReembed", () => {
    it("queues the follow-up of a re-embedding with the instant of the continuation", async () => {
        const tx = fakeTransaction(mockEntityManager())
        const { service, queue } = await build(tx.em)
        await service.continueReembed(WS, "m1")
        expect(queue.enqueueReembed).toHaveBeenCalledWith(
            { workspaceId: WS, model: "m1" },
            expect.anything(),
            Date.parse(AT),
        )
    })
})

describe("KnowledgeSourcesService readUpload", () => {
    it("answers the bytes and content type of the object", async () => {
        const { service, storage } = await build(mockEntityManager())
        storage.download.mockResolvedValue({
            kind: "ok",
            value: { bytes: new Uint8Array([1]), contentType: "application/pdf" },
        })
        await expect(service.readUpload(`${WS}/u/a.pdf`)).resolves.toEqual({
            bytes: new Uint8Array([1]),
            contentType: "application/pdf",
        })
        expect(storage.download).toHaveBeenCalledWith("knowledge-uploads", `${WS}/u/a.pdf`)
    })

    it("answers null for an object that is not in storage", async () => {
        const { service, storage } = await build(mockEntityManager())
        storage.download.mockResolvedValue({ kind: "refused", code: "OBJECT_STORAGE_NOT_FOUND" })
        await expect(service.readUpload("p")).resolves.toBeNull()
    })

    it("throws for any other storage failure so the queue retries", async () => {
        const { service, storage } = await build(mockEntityManager())
        storage.download.mockResolvedValue({ kind: "refused", code: "OBJECT_STORAGE_UNAVAILABLE" })
        await expect(service.readUpload("p")).rejects.toMatchObject({ code: codes.UploadUnavailable })
    })
})

describe("KnowledgeSourcesService sourceOf", () => {
    it("answers the source as the jobs read it, or null when it is gone", async () => {
        const found = await build(mockEntityManager({ findOne: [KnowledgeSourceEntity, row] }))
        const gone = await build(mockEntityManager({ findOne: [KnowledgeSourceEntity, null] }))
        await expect(found.service.sourceOf(WS, "s1")).resolves.toMatchObject({ id: "s1", workspaceId: WS })
        await expect(gone.service.sourceOf(WS, "s1")).resolves.toBeNull()
    })
})

describe("KnowledgeSourcesService the stages a worker moves a source through", () => {
    it("starts reading, stores the text and moves to indexing", async () => {
        const em = mockEntityManager({ update: [KnowledgeSourceEntity, { affected: 1 }] })
        const { service } = await build(em)
        await service.begin(WS, "s1")
        await service.startIndexing(WS, "s1", "text", "Title")
        expect(em.update).toHaveBeenCalledWith(
            KnowledgeSourceEntity,
            KEY,
            ...touched({ status: "reading", error: null, progress: 5 }),
        )
        expect(em.update).toHaveBeenCalledWith(
            KnowledgeSourceEntity,
            KEY,
            ...touched({ status: "indexing", content: "text", title: "Title", progress: 20 }),
        )
    })

    it("moves the progress bar inside 0 to 100", async () => {
        const em = mockEntityManager({ update: [KnowledgeSourceEntity, { affected: 1 }] })
        const { service } = await build(em)
        await service.advance(WS, "s1", 42.4)
        await service.advance(WS, "s1", -3)
        await service.advance(WS, "s1", 140)
        expect(em.update).toHaveBeenCalledWith(KnowledgeSourceEntity, KEY, ...touched({ progress: 42 }))
        expect(em.update).toHaveBeenCalledWith(KnowledgeSourceEntity, KEY, ...touched({ progress: 0 }))
        expect(em.update).toHaveBeenCalledWith(KnowledgeSourceEntity, KEY, ...touched({ progress: 100 }))
    })

    it("never fails the job when the progress bar cannot move", async () => {
        const em = mockEntityManager({ update: [KnowledgeSourceEntity, { affected: 1 }] })
        const { service, logger } = await build(em)
        em.update.mockRejectedValue(new Error("db"))
        await expect(service.advance(WS, "s1", 10)).resolves.toBeUndefined()
        expect(logger.error).toHaveBeenCalledWith(KnowledgeSourcesLogEvent.ProgressFailed, expect.any(Error), {
            sourceId: "s1",
        })
    })

    it("closes a source as failed with a stored code", async () => {
        const em = mockEntityManager({ update: [KnowledgeSourceEntity, { affected: 1 }] })
        const { service } = await build(em)
        await service.fail(WS, "s1", "CODE")
        expect(em.update).toHaveBeenCalledWith(
            KnowledgeSourceEntity,
            KEY,
            ...touched({ status: "failed", error: "CODE" }),
        )
    })

    it("records the stored passages, publishes knowledge_source_indexed and moves on in one transaction", async () => {
        const tx = fakeTransaction(mockEntityManager({ update: [KnowledgeSourceEntity, { affected: 1 }] }))
        const { service, queue, bus } = await build(tx.em)
        await service.finishIndexing(WS, "s1", StoredNote.KeywordOnly, 3)
        expect(tx.em.update).toHaveBeenCalledWith(
            KnowledgeSourceEntity,
            KEY,
            ...touched({ error: StoredNote.KeywordOnly, chunkCount: 3, progress: 80 }),
        )
        expect(queue.enqueueFacts).not.toHaveBeenCalled()
        const key = "s1:" + Date.parse(AT)
        expect(bus.publish).toHaveBeenCalledWith(
            expect.objectContaining({
                eventName: "knowledge_source_indexed",
                payload: { ...job, indexedAt: Date.parse(AT), dedupeKey: key },
            }),
            expect.anything(),
            key,
        )
        expect(tx.em.update).toHaveBeenCalledWith(
            KnowledgeSourceEntity,
            KEY,
            ...touched({ status: "extracting_facts", progress: 85 }),
        )
        expect(tx.commits).toBe(1)
    })

    it("waits for credits after storing the passages without vectors", async () => {
        const em = mockEntityManager({ update: [KnowledgeSourceEntity, { affected: 1 }] })
        const { service } = await build(em)
        await service.blockIndexing(WS, "s1", StoredNote.NoCreditsForIndex, 60)
        expect(em.update).toHaveBeenCalledWith(
            KnowledgeSourceEntity,
            KEY,
            ...touched({
                status: "blocked_credits",
                error: StoredNote.NoCreditsForIndex,
                chunkCount: 60,
                progress: 80,
            }),
        )
    })
})

describe("KnowledgeSourcesService the stages a worker moves a source through", () => {
    it("marks a source ready, or waiting for credits to read its facts", async () => {
        const em = mockEntityManager({ update: [KnowledgeSourceEntity, { affected: 1 }] })
        const { service } = await build(em)
        await service.ready(WS, "s1", null)
        await service.ready(WS, "s1", StoredNote.KeywordOnly)
        await service.blockFacts(WS, "s1", StoredNote.NoCreditsForFacts)
        expect(em.update).toHaveBeenCalledWith(
            KnowledgeSourceEntity,
            KEY,
            ...touched({ status: "ready", progress: 100 }),
        )
        expect(em.update).toHaveBeenCalledWith(
            KnowledgeSourceEntity,
            KEY,
            ...touched({ status: "ready", progress: 100, error: StoredNote.KeywordOnly }),
        )
        expect(em.update).toHaveBeenCalledWith(
            KnowledgeSourceEntity,
            KEY,
            ...touched({ status: "blocked_credits", error: StoredNote.NoCreditsForFacts }),
        )
    })
})

describe("KnowledgeSourcesService reading", () => {
    it("lists source summaries for any member with the requested module or all modules", async () => {
        const em = mockEntityManager({ find: [KnowledgeSourceEntity, [listRowOf()]] })
        const { service, members } = await build(em)
        await expect(service.list("u1", WS, "chatbot")).resolves.toEqual([summary])
        await expect(service.list("u1", WS)).resolves.toEqual([summary])
        expect(members.require).toHaveBeenCalledTimes(2)
        expect(members.require).toHaveBeenCalledWith("u1", WS)
        expect(em.find).toHaveBeenNthCalledWith(1, KnowledgeSourceEntity, {
            select: expect.objectContaining({ id: true, updatedAt: true }),
            where: { workspaceId: WS, module: "chatbot" },
            order: { createdAt: "DESC" },
            take: 500,
        })
        expect(em.find).toHaveBeenNthCalledWith(
            2,
            KnowledgeSourceEntity,
            expect.objectContaining({ where: { workspaceId: WS } }),
        )
    })

    it("answers no summaries when the workspace has no sources", async () => {
        const em = mockEntityManager({ find: [KnowledgeSourceEntity, []] })
        const { service } = await build(em)
        await expect(service.list("u1", WS)).resolves.toEqual([])
        expect(em.find).toHaveBeenCalledWith(
            KnowledgeSourceEntity,
            expect.objectContaining({ where: { workspaceId: WS } }),
        )
    })

    it("reads the source with its text after checking workspace membership", async () => {
        const em = mockEntityManager({ findOne: [KnowledgeSourceEntity, listRowOf()] })
        const { service, members } = await build(em)
        await expect(service.detail("u1", WS, "s1")).resolves.toEqual({ ...summary, content: "c" })
        expect(members.require).toHaveBeenCalledWith("u1", WS)
        expect(em.findOne).toHaveBeenCalledWith(KnowledgeSourceEntity, {
            select: expect.objectContaining({ id: true, content: true }),
            where: { workspaceId: WS, id: "s1" },
        })
    })

    it("refuses detail when the source does not belong to the workspace", async () => {
        const em = mockEntityManager({ findOne: [KnowledgeSourceEntity, null] })
        const { service } = await build(em)
        await expect(service.detail("u1", WS, "s1")).rejects.toMatchObject(missing)
    })

    it("allows internal readers shared and matching documents and rejects a different module or instance", async () => {
        const { em, fakes } = withStatements(mockEntityManager(), {
            getRawMany: [
                readableRowOf(),
                readableRowOf({ id: "private", module: "chatbot", installationId: "i1", visibility: "internal" }),
                readableRowOf({ id: "legacy", visibility: "legacy", content: null }),
                readableRowOf({ id: "other-module", module: "sales" }),
                readableRowOf({ id: "other-instance", module: "chatbot", installationId: "i2" }),
            ],
        })
        const { service } = await build(em)
        await expect(
            service.readableFor({ workspaceId: WS, module: "chatbot", installationId: "i1", audience: "internal" }, 8),
        ).resolves.toEqual([
            readable,
            { ...readable, id: "private", visibility: "internal" },
            { ...readable, id: "legacy", visibility: "internal", content: "" },
        ])
        expect(fakes[0]?.callsOf("where")).toEqual([[{ workspaceId: WS, status: In(["ready", "extracting_facts"]) }]])
        expect(fakes[0]?.callsOf("andWhere")).toEqual([[expect.any(Brackets)], [expect.any(Brackets)]])
        expect(fakes[0]?.callsOf("addSelect")).toContainEqual(["ks.updated_at::text", "updatedAt"])
        const conditions: Array<unknown> = []
        const scoped = {
            where: (...args: Array<unknown>) => (conditions.push(args), scoped),
            orWhere: (...args: Array<unknown>) => (conditions.push(args), scoped),
        }
        for (const [brackets] of fakes[0]?.callsOf("andWhere") ?? [])
            if (brackets instanceof Brackets) brackets.whereFactory(scoped as never)
        expect(conditions).toEqual([
            ["ks.module IS NULL"],
            ["ks.module = :module", { module: "chatbot" }],
            ["ks.installationId IS NULL"],
            ["ks.installationId = :installationId", { installationId: "i1" }],
        ])
        expect(fakes[0]?.callsOf("orderBy")).toEqual([["ks.createdAt", "ASC"]])
        expect(fakes[0]?.callsOf("limit")).toEqual([[8]])
    })
})

describe("KnowledgeSourcesService reading", () => {
    it("allows customer readers only public documents and a shared scope rejects instance documents", async () => {
        const { em, fakes } = withStatements(mockEntityManager(), {
            getRawMany: [
                readableRowOf(),
                readableRowOf({ id: "private", visibility: "internal" }),
                readableRowOf({ id: "instance", installationId: "i1" }),
            ],
        })
        const { service } = await build(em)
        await expect(
            service.readableFor({ workspaceId: WS, module: "chatbot", installationId: null, audience: "customer" }, 5),
        ).resolves.toEqual([readable])
        expect(fakes[0]?.callsOf("andWhere")).toEqual([
            [expect.any(Brackets)],
            [expect.any(Brackets)],
            [{ visibility: "public" }],
        ])
    })
})

describe("KnowledgeSourcesService briefsOf", () => {
    it("answers the kind, title and topic of the sources of the workspace", async () => {
        const em = mockEntityManager({ find: [KnowledgeSourceEntity, [listRowOf({ topic: "hours" })]] })
        const { service } = await build(em)

        await expect(service.briefsOf(WS, ["s1"])).resolves.toEqual([
            { id: "s1", kind: "text", title: "T", topic: "hours" },
        ])
        expect(em.find).toHaveBeenCalledWith(KnowledgeSourceEntity, {
            select: { id: true, kind: true, title: true, topic: true },
            where: { workspaceId: WS, id: In(["s1"]) },
            take: 1,
        })
    })

    it("reads nothing for no ids", async () => {
        const em = mockEntityManager()
        const { service } = await build(em)

        await expect(service.briefsOf(WS, [])).resolves.toEqual([])
        expect(em.find).not.toHaveBeenCalled()
    })
})
