import { row, summary } from "@tests/fixtures/builders/knowledge-sources.builder"
import { Test } from "@nestjs/testing"
import { In } from "typeorm"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import {
    FakeClock,
    builder,
    fakeIds,
    fakeTransaction,
    mock,
    mockEntityManager,
    recordingEventBus,
} from "@starci/jest-preset"
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
import { KnowledgeSourceIndexedEvent } from "@modules/events/api"
import { KnowledgeQueue } from "@modules/queues/knowledge"
import { KnowledgeSourcesErrorCode } from "./errors/knowledge-sources.error"
import { StoredNote } from "./knowledge-sources.contracts"
import type { AddSourceInput, ReindexInput, UpdateSourceInput } from "./knowledge-sources.contracts"
import { KNOWLEDGE_STORAGE } from "./knowledge-sources.decorators"
import { KnowledgeSourcesLogEvent } from "./knowledge-sources.log-events"
import { KnowledgeSourcesService } from "./knowledge-sources.service"
import { KnowledgeSourceEntity } from "./persistence/entities"
import { NOW } from "./source-input.policy"
import { SourceQuotaService } from "./source-quota.service"

const WS = "11111111-1111-4111-8111-111111111111"
const AT = "2026-10-12T10:00:00.000Z"
const UPLOAD_ID = "00000000-0000-4000-8000-000000000001"
const codes = KnowledgeSourcesErrorCode
const job = { sourceId: "s1", workspaceId: WS }
const missing = { code: codes.SourceNotFound }
const listRowOf = builder<KnowledgeSourceEntity>({ ...row, createdAt: new Date("2026-10-11T10:00:00.000Z") })
const KEY = { id: "s1", workspaceId: WS }
/** A matcher for an object holding at least these fields, typed unknown so it nests inside an expected object. */
const matching = (fields: object): unknown => expect.objectContaining(fields)
const touched = (changes: object) => [{ ...changes, updatedAt: NOW }]
/** Asserts that the manager updated the source `KEY` with these changes and the instant of the write. */
const updated = (em: MockEntityManager, changes: object) =>
    expect(em.update).toHaveBeenCalledWith(KnowledgeSourceEntity, KEY, ...touched(changes))
/** A transaction whose insert answers the new source `s1`. */
const insertedTx = () =>
    fakeTransaction(mockEntityManager({ insert: [KnowledgeSourceEntity, { identifiers: [{ id: "s1" }] }] }))
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
    const bus = recordingEventBus()
    const storage = mock<StorageObjectsPort>()
    const logger = mock<Logger>()
    const entitlements = mock<EntitlementsService>()
    const installations = mock<InstallationRecordsService>()
    const quota = mock<SourceQuotaService>()
    quota.measure.mockResolvedValue(12)
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
            { provide: SourceQuotaService, useValue: quota },
            { provide: IDS, useValue: fakeIds() },
        ],
    }).compile()
    const service = moduleRef.get(KnowledgeSourcesService)
    return { service, members, queue, bus, storage, logger, installations, quota }
}
describe("KnowledgeSourcesService addSource", () => {
    it("authorizes the manager and atomically writes the source with its indexing job", async () => {
        const tx = insertedTx()
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
            sizeBytes: 12,
            createdBy: "u1",
        })
        expect(queue.enqueueIndex).toHaveBeenCalledWith(job, expect.anything())
        expect(tx.commits).toBe(1)
    })

    it("keeps a document for one agent instance and takes the module of its type", async () => {
        const tx = insertedTx()
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

    it.each<readonly [string, ReindexInput, object]>([
        ["replaces its text when new text is given", { sourceId: "s1", content: " new " }, { content: "new" }],
        ["keeps the text when none is given", { sourceId: "s1" }, {}],
    ])("queues the source again and %s", async (_name, input, changes) => {
        const tx = fakeTransaction(mockEntityManager({ update: [KnowledgeSourceEntity, { affected: 1 }] }))
        const { service, queue } = await build(tx.em)
        await expect(service.reindexSource("u1", WS, input)).resolves.toEqual({ id: "s1" })
        updated(tx.em, { status: "queued", progress: 0, error: null, ...changes })
        expect(queue.enqueueIndex).toHaveBeenCalledWith(expect.anything(), expect.anything(), Date.parse(AT))
    })

    it("refuses an unknown source and an empty text", async () => {
        const tx = fakeTransaction(mockEntityManager({ update: [KnowledgeSourceEntity, { affected: 0 }] }))
        const { service } = await build(tx.em)
        await expect(service.reindexSource("u1", WS, { sourceId: "s1" })).rejects.toMatchObject(missing)
        await expect(service.reindexSource("u1", WS, { sourceId: "s1", content: " " })).rejects.toMatchObject({
            code: codes.ContentEmpty,
        })
    })

    it.each<readonly [string, UpdateSourceInput, object]>([
        [
            "changes the metadata of the source",
            { sourceId: "s1", title: "T", tags: ["a"], visibility: "public" },
            { title: "T", tags: ["a"], visibility: "public" },
        ],
        ["keeps the tags when none are given", { sourceId: "s1" }, {}],
    ])("%s", async (_name, input, changes) => {
        const em = mockEntityManager({ update: [KnowledgeSourceEntity, { affected: 1 }] })
        const { service } = await build(em)
        await service.updateSource("u1", WS, input)
        updated(em, changes)
    })

    it("refuses an unknown source", async () => {
        const { service } = await build(mockEntityManager({ update: [KnowledgeSourceEntity, { affected: 0 }] }))
        await expect(service.updateSource("u1", WS, { sourceId: "s1" })).rejects.toMatchObject(missing)
    })

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
        const signed = { path: `${WS}/${UPLOAD_ID}/my_file.pdf`, token: "t", signedUrl: "https://s.test/u" }
        storage.signedUpload.mockResolvedValue({ kind: "ok", value: signed })
        await expect(service.createUpload("u1", WS, "my file.pdf")).resolves.toEqual(signed)
        expect(storage.signedUpload).toHaveBeenCalledWith("knowledge-uploads", `${WS}/${UPLOAD_ID}/my_file.pdf`)
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
        updated(em, { status: "reading", error: null, progress: 5 })
        updated(em, { status: "indexing", content: "text", title: "Title", progress: 20 })
    })

    it("moves the progress bar inside 0 to 100", async () => {
        const em = mockEntityManager({ update: [KnowledgeSourceEntity, { affected: 1 }] })
        const { service } = await build(em)
        await service.advance(WS, "s1", 42.4)
        await service.advance(WS, "s1", -3)
        await service.advance(WS, "s1", 140)
        updated(em, { progress: 42 })
        updated(em, { progress: 0 })
        updated(em, { progress: 100 })
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

    it("records the stored passages, publishes knowledge_source_indexed and moves on in one transaction", async () => {
        const tx = fakeTransaction(mockEntityManager({ update: [KnowledgeSourceEntity, { affected: 1 }] }))
        const { service, queue, bus } = await build(tx.em)
        await service.finishIndexing(WS, "s1", StoredNote.KeywordOnly, 3)
        updated(tx.em, { error: StoredNote.KeywordOnly, chunkCount: 3, progress: 80 })
        expect(queue.enqueueFacts).not.toHaveBeenCalled()
        expect(bus.eventsOf(KnowledgeSourceIndexedEvent)).toEqual([
            expect.objectContaining({ payload: matching({ ...job, indexedAt: Date.parse(AT) }) }),
        ])
        expect(bus.allInTransaction).toBe(true)
        updated(tx.em, { status: "extracting_facts", progress: 85 })
        expect(tx.commits).toBe(1)
    })
})

describe("KnowledgeSourcesService the stages a worker moves a source through", () => {
    it("closes a source as failed with a stored code", async () => {
        const em = mockEntityManager({ update: [KnowledgeSourceEntity, { affected: 1 }] })
        const { service } = await build(em)
        await service.fail(WS, "s1", "CODE")
        updated(em, { status: "failed", error: "CODE" })
    })

    it("waits for credits after storing the passages without vectors", async () => {
        const em = mockEntityManager({ update: [KnowledgeSourceEntity, { affected: 1 }] })
        const { service } = await build(em)
        await service.blockIndexing(WS, "s1", StoredNote.NoCreditsForIndex, 60)
        updated(em, {
            status: "blocked_credits",
            error: StoredNote.NoCreditsForIndex,
            chunkCount: 60,
            progress: 80,
        })
    })

    it("marks a source ready, or waiting for credits to read its facts", async () => {
        const em = mockEntityManager({ update: [KnowledgeSourceEntity, { affected: 1 }] })
        const { service } = await build(em)
        await service.ready(WS, "s1", null)
        await service.ready(WS, "s1", StoredNote.KeywordOnly)
        await service.blockFacts(WS, "s1", StoredNote.NoCreditsForFacts)
        updated(em, { status: "ready", progress: 100 })
        updated(em, { status: "ready", progress: 100, error: StoredNote.KeywordOnly })
        updated(em, { status: "blocked_credits", error: StoredNote.NoCreditsForFacts })
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
            select: matching({ id: true, updatedAt: true }),
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

    it("narrows the list to one origin when asked", async () => {
        const em = mockEntityManager({ find: [KnowledgeSourceEntity, [listRowOf()]] })
        const { service } = await build(em)
        await expect(service.list("u1", WS, undefined, "google_drive")).resolves.toEqual([summary])
        expect(em.find).toHaveBeenCalledWith(
            KnowledgeSourceEntity,
            expect.objectContaining({ where: { workspaceId: WS, origin: "google_drive" } }),
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
            select: matching({ id: true, content: true }),
            where: { workspaceId: WS, id: "s1" },
        })
    })

    it("refuses detail when the source does not belong to the workspace", async () => {
        const em = mockEntityManager({ findOne: [KnowledgeSourceEntity, null] })
        const { service } = await build(em)
        await expect(service.detail("u1", WS, "s1")).rejects.toMatchObject(missing)
    })
})
