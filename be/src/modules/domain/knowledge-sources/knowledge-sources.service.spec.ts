import { row, summary, readable } from "@tests/fixtures/builders/knowledge-sources.builder"
import { Test } from "@nestjs/testing"
import { FakeClock, builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { EntitlementsService } from "@modules/domain/billing"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { SupabaseObjectsPort } from "@modules/integrations/supabase"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { KnowledgeQueue } from "@modules/queues/knowledge"
import { KnowledgeSourcesErrorCode } from "./errors/knowledge-sources.error"
import { StoredNote } from "./knowledge-sources.contracts"
import type { AddSourceInput } from "./knowledge-sources.contracts"
import { KNOWLEDGE_STORAGE } from "./knowledge-sources.decorators"
import { KnowledgeSourcesLogEvent } from "./knowledge-sources.log-events"
import { KnowledgeSourcesService } from "./knowledge-sources.service"
import type { ReadableSourceRow, SourceListRow } from "./persistence/knowledge-sources.rows"
import {
    COUNT_READABLE_SOURCES,
    DELETE_SOURCE,
    INSERT_SOURCE,
    LIST_READABLE_SOURCES,
    LIST_SOURCES,
    MARK_BLOCKED,
    MARK_EXTRACTING,
    MARK_FACTS_BLOCKED,
    MARK_FAILED,
    MARK_INDEXED,
    MARK_INDEXING,
    MARK_READING,
    MARK_READY,
    REQUEUE_FAILED_SOURCE,
    REQUEUE_SOURCE,
    SELECT_INSTALLATION,
    SELECT_NEW_ID,
    SELECT_SOURCE,
    SELECT_SOURCE_DETAIL,
    SET_PROGRESS,
    UPDATE_SOURCE_META,
} from "./persistence/knowledge-sources.sql"
const WS = "11111111-1111-4111-8111-111111111111"
const AT = "2026-10-12T10:00:00.000Z"
const codes = KnowledgeSourcesErrorCode
const job = { sourceId: "s1", workspaceId: WS }
const missing = { code: codes.SourceNotFound }
const listRowOf = builder<SourceListRow>({ ...row, created_at: "2026-10-11T10:00:00.000Z" })
const readableRowOf = builder<ReadableSourceRow>({ ...row, id: "shared", visibility: "public" })
const inputOf = builder<AddSourceInput>({ kind: "text", title: "Hours", content: "Open 8 to 21" })
const build = async (em: MockEntityManager) => {
    const members = mock<WorkspaceMembersService>()
    const queue = mock<KnowledgeQueue>()
    const storage = mock<SupabaseObjectsPort>()
    const logger = mock<Logger>()
    const entitlements = mock<EntitlementsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            KnowledgeSourcesService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(AT) },
            { provide: KNOWLEDGE_STORAGE, useValue: storage },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: KnowledgeQueue, useValue: queue },
            { provide: EntitlementsService, useValue: entitlements },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(KnowledgeSourcesService), members, queue, storage, logger }
}
describe("KnowledgeSourcesService", () => {
    it("counts documents allowed for each audience and defaults an absent count to zero", async () => {
        const em = mockEntityManager({ query: [COUNT_READABLE_SOURCES, [{ count: 3 }]] })
        const { service } = await build(em)
        const scope = { workspaceId: WS, module: "chatbot", installationId: null, audience: "customer" as const }
        await expect(service.countReadable(scope, "internal")).resolves.toBe(0)
        await expect(service.countReadable(scope, "public")).resolves.toBe(3)
        await expect(service.countReadable({ ...scope, audience: "internal" }, "internal")).resolves.toBe(3)
        em.query.mockResolvedValueOnce([])
        await expect(service.countReadable(scope, "public")).resolves.toBe(0)
        expect(em.query).toHaveBeenCalledTimes(3)
        expect(em.query).toHaveBeenCalledWith(COUNT_READABLE_SOURCES, [WS, "chatbot", null, "public"])
        expect(em.query).toHaveBeenCalledWith(COUNT_READABLE_SOURCES, [WS, "chatbot", null, "internal"])
    })
})

describe("KnowledgeSourcesService addSource", () => {
    it("authorizes the manager and atomically writes the source with its indexing job", async () => {
        const tx = fakeTransaction(mockEntityManager({ query: [INSERT_SOURCE, [{ id: "s1" }]] }))
        const { service, members, queue } = await build(tx.em)
        await expect(service.addSource("u1", WS, inputOf({ tags: ["a"], topic: "Open" }))).resolves.toEqual({
            id: "s1",
        })
        expect(members.require).toHaveBeenCalledWith("u1", WS, ["owner", "manager"])
        expect(tx.em.query).toHaveBeenCalledWith(INSERT_SOURCE, [
            WS,
            null,
            null,
            "text",
            "Open",
            ["a"],
            "internal",
            "Hours",
            "Open 8 to 21",
            null,
            null,
            null,
            "u1",
        ])
        expect(queue.enqueueIndex).toHaveBeenCalledWith(job, expect.anything())
        expect(tx.commits).toBe(1)
    })

    it("keeps a document for one agent instance and takes the module of its type", async () => {
        const tx = fakeTransaction(
            mockEntityManager({
                query: [
                    [SELECT_INSTALLATION, [{ id: "i1", module_key: "chatbot" }]],
                    [INSERT_SOURCE, [{ id: "s1" }]],
                ],
            }),
        )
        const { service } = await build(tx.em)
        await service.addSource("u1", WS, inputOf({ installationId: "i1", module: "sales" }))
        expect(tx.em.query).toHaveBeenCalledWith(INSERT_SOURCE, expect.arrayContaining(["chatbot", "i1"]))
    })

    it("refuses an agent instance of another workspace", async () => {
        const { service, queue } = await build(mockEntityManager({ query: [SELECT_INSTALLATION, []] }))
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
        expect(em.query).not.toHaveBeenCalled()
    })

    it("fails when the insert answers no row", async () => {
        const tx = fakeTransaction(mockEntityManager({ query: [INSERT_SOURCE, []] }))
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
        expect(em.query).not.toHaveBeenCalled()
    })
})

describe("KnowledgeSourcesService retrySource", () => {
    it("queues a failed source again with the retry instant", async () => {
        const tx = fakeTransaction(mockEntityManager({ query: [REQUEUE_FAILED_SOURCE, [{ id: "s1" }]] }))
        const { service, queue } = await build(tx.em)
        await expect(service.retrySource("u1", WS, "s1")).resolves.toEqual({ id: "s1" })
        expect(queue.enqueueIndex).toHaveBeenCalledWith(job, expect.anything(), Date.parse(AT))
    })

    it("leaves a source that is not failed or blocked as it is", async () => {
        const tx = fakeTransaction(mockEntityManager({ query: [REQUEUE_FAILED_SOURCE, []] }))
        const { service, queue } = await build(tx.em)
        await expect(service.retrySource("u1", WS, "s1")).resolves.toEqual({ id: "s1" })
        expect(queue.enqueueIndex).not.toHaveBeenCalled()
    })
})

describe("KnowledgeSourcesService reindexSource", () => {
    it("queues the source again, replacing its text when new text is given", async () => {
        const tx = fakeTransaction(mockEntityManager({ query: [REQUEUE_SOURCE, [{ id: "s1" }]] }))
        const { service, queue } = await build(tx.em)
        await expect(service.reindexSource("u1", WS, { sourceId: "s1", content: " new " })).resolves.toEqual({
            id: "s1",
        })
        expect(tx.em.query).toHaveBeenCalledWith(REQUEUE_SOURCE, ["s1", WS, "new"])
        expect(queue.enqueueIndex).toHaveBeenCalledWith(expect.anything(), expect.anything(), Date.parse(AT))
    })

    it("keeps the text when none is given", async () => {
        const tx = fakeTransaction(mockEntityManager({ query: [REQUEUE_SOURCE, [{ id: "s1" }]] }))
        const { service } = await build(tx.em)
        await service.reindexSource("u1", WS, { sourceId: "s1" })
        expect(tx.em.query).toHaveBeenCalledWith(REQUEUE_SOURCE, ["s1", WS, null])
    })

    it("refuses an unknown source and an empty text", async () => {
        const tx = fakeTransaction(mockEntityManager({ query: [REQUEUE_SOURCE, []] }))
        const { service } = await build(tx.em)
        await expect(service.reindexSource("u1", WS, { sourceId: "s1" })).rejects.toMatchObject(missing)
        await expect(service.reindexSource("u1", WS, { sourceId: "s1", content: " " })).rejects.toMatchObject({
            code: codes.ContentEmpty,
        })
    })
})

describe("KnowledgeSourcesService updateSource", () => {
    it("changes the metadata of the source", async () => {
        const em = mockEntityManager({ query: [UPDATE_SOURCE_META, [{ id: "s1" }]] })
        const { service } = await build(em)
        await service.updateSource("u1", WS, { sourceId: "s1", title: "T", tags: ["a"], visibility: "public" })
        expect(em.query).toHaveBeenCalledWith(UPDATE_SOURCE_META, ["s1", WS, "T", null, ["a"], null, "public"])
    })

    it("keeps the tags when none are given", async () => {
        const em = mockEntityManager({ query: [UPDATE_SOURCE_META, [{ id: "s1" }]] })
        const { service } = await build(em)
        await service.updateSource("u1", WS, { sourceId: "s1" })
        expect(em.query).toHaveBeenCalledWith(UPDATE_SOURCE_META, ["s1", WS, null, null, null, null, null])
    })

    it("refuses an unknown source", async () => {
        const { service } = await build(mockEntityManager({ query: [UPDATE_SOURCE_META, []] }))
        await expect(service.updateSource("u1", WS, { sourceId: "s1" })).rejects.toMatchObject(missing)
    })
})

describe("KnowledgeSourcesService removeSource", () => {
    it("deletes the source and answers its title", async () => {
        const { service } = await build(mockEntityManager({ query: [DELETE_SOURCE, [{ title: "Menu" }]] }))
        await expect(service.removeSource("u1", WS, "s1")).resolves.toEqual({ title: "Menu" })
    })

    it("refuses an unknown source", async () => {
        const { service } = await build(mockEntityManager({ query: [DELETE_SOURCE, []] }))
        await expect(service.removeSource("u1", WS, "s1")).rejects.toMatchObject(missing)
    })
})

describe("KnowledgeSourcesService createUpload", () => {
    it("answers the signed address of a safe object path in the workspace folder", async () => {
        const { service, storage } = await build(mockEntityManager({ query: [SELECT_NEW_ID, [{ id: "uuid-1" }]] }))
        const signed = { path: `${WS}/uuid-1/my_file.pdf`, token: "t", signedUrl: "https://s.test/u" }
        storage.signedUpload.mockResolvedValue({ kind: "ok", value: signed })
        await expect(service.createUpload("u1", WS, "my file.pdf")).resolves.toEqual(signed)
        expect(storage.signedUpload).toHaveBeenCalledWith("knowledge-uploads", `${WS}/uuid-1/my_file.pdf`)
    })

    it("refuses an empty name and a storage that cannot sign", async () => {
        const { service, storage } = await build(mockEntityManager({ query: [SELECT_NEW_ID, [{ id: "uuid-1" }]] }))
        storage.signedUpload.mockResolvedValue({ kind: "refused", code: "SUPABASE_PROVIDER_UNAVAILABLE" })
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
        storage.download.mockResolvedValue({ kind: "refused", code: "SUPABASE_OBJECT_NOT_FOUND" })
        await expect(service.readUpload("p")).resolves.toBeNull()
    })

    it("throws for any other storage failure so the queue retries", async () => {
        const { service, storage } = await build(mockEntityManager())
        storage.download.mockResolvedValue({ kind: "refused", code: "SUPABASE_PROVIDER_UNAVAILABLE" })
        await expect(service.readUpload("p")).rejects.toMatchObject({ code: codes.UploadUnavailable })
    })
})

describe("KnowledgeSourcesService sourceOf", () => {
    it("answers the source as the jobs read it, or null when it is gone", async () => {
        const found = await build(mockEntityManager({ query: [SELECT_SOURCE, [row]] }))
        const gone = await build(mockEntityManager({ query: [SELECT_SOURCE, []] }))
        await expect(found.service.sourceOf(WS, "s1")).resolves.toMatchObject({ id: "s1", workspaceId: WS })
        await expect(gone.service.sourceOf(WS, "s1")).resolves.toBeNull()
    })
})

describe("KnowledgeSourcesService the stages a worker moves a source through", () => {
    it("starts reading, stores the text and moves to indexing", async () => {
        const em = mockEntityManager({
            query: [
                [MARK_READING, []],
                [MARK_INDEXING, []],
            ],
        })
        const { service } = await build(em)
        await service.begin(WS, "s1")
        await service.startIndexing(WS, "s1", "text", "Title")
        expect(em.query).toHaveBeenCalledWith(MARK_READING, ["s1", WS])
        expect(em.query).toHaveBeenCalledWith(MARK_INDEXING, ["s1", WS, "text", "Title"])
    })

    it("moves the progress bar inside 0 to 100", async () => {
        const em = mockEntityManager({ query: [SET_PROGRESS, []] })
        const { service } = await build(em)
        await service.advance(WS, "s1", 42.4)
        await service.advance(WS, "s1", -3)
        await service.advance(WS, "s1", 140)
        expect(em.query).toHaveBeenCalledWith(SET_PROGRESS, ["s1", WS, 42])
        expect(em.query).toHaveBeenCalledWith(SET_PROGRESS, ["s1", WS, 0])
        expect(em.query).toHaveBeenCalledWith(SET_PROGRESS, ["s1", WS, 100])
    })

    it("never fails the job when the progress bar cannot move", async () => {
        const em = mockEntityManager({ query: [SET_PROGRESS, []] })
        const { service, logger } = await build(em)
        em.query.mockRejectedValue(new Error("db"))
        await expect(service.advance(WS, "s1", 10)).resolves.toBeUndefined()
        expect(logger.error).toHaveBeenCalledWith(KnowledgeSourcesLogEvent.ProgressFailed, expect.any(Error), {
            sourceId: "s1",
        })
    })

    it("closes a source as failed with a stored code", async () => {
        const em = mockEntityManager({ query: [MARK_FAILED, []] })
        const { service } = await build(em)
        await service.fail(WS, "s1", "CODE")
        expect(em.query).toHaveBeenCalledWith(MARK_FAILED, ["s1", WS, "CODE"])
    })

    it("records the stored passages, queues the facts and moves on in one transaction", async () => {
        const tx = fakeTransaction(
            mockEntityManager({
                query: [
                    [MARK_INDEXED, []],
                    [MARK_EXTRACTING, []],
                ],
            }),
        )
        const { service, queue } = await build(tx.em)
        await service.finishIndexing(WS, "s1", StoredNote.KeywordOnly, 3)
        expect(tx.em.query).toHaveBeenCalledWith(MARK_INDEXED, ["s1", WS, StoredNote.KeywordOnly, 3])
        expect(queue.enqueueFacts).toHaveBeenCalledWith(job, expect.anything(), Date.parse(AT))
        expect(tx.em.query).toHaveBeenCalledWith(MARK_EXTRACTING, ["s1", WS])
        expect(tx.commits).toBe(1)
    })

    it("waits for credits after storing the passages without vectors", async () => {
        const em = mockEntityManager({ query: [MARK_BLOCKED, []] })
        const { service } = await build(em)
        await service.blockIndexing(WS, "s1", StoredNote.NoCreditsForIndex, 60)
        expect(em.query).toHaveBeenCalledWith(MARK_BLOCKED, ["s1", WS, StoredNote.NoCreditsForIndex, 60])
    })
})

describe("KnowledgeSourcesService the stages a worker moves a source through", () => {
    it("marks a source ready, or waiting for credits to read its facts", async () => {
        const em = mockEntityManager({
            query: [
                [MARK_READY, []],
                [MARK_FACTS_BLOCKED, []],
            ],
        })
        const { service } = await build(em)
        await service.ready(WS, "s1", null)
        await service.blockFacts(WS, "s1", StoredNote.NoCreditsForFacts)
        expect(em.query).toHaveBeenCalledWith(MARK_READY, ["s1", WS, null])
        expect(em.query).toHaveBeenCalledWith(MARK_FACTS_BLOCKED, ["s1", WS, StoredNote.NoCreditsForFacts])
    })
})

describe("KnowledgeSourcesService reading", () => {
    it("lists source summaries for any member with the requested module or all modules", async () => {
        const em = mockEntityManager({ query: [LIST_SOURCES, [listRowOf()]] })
        const { service, members } = await build(em)
        await expect(service.list("u1", WS, "chatbot")).resolves.toEqual([summary])
        await expect(service.list("u1", WS)).resolves.toEqual([summary])
        expect(members.require).toHaveBeenCalledTimes(2)
        expect(members.require).toHaveBeenCalledWith("u1", WS)
        expect(em.query).toHaveBeenCalledWith(LIST_SOURCES, [WS, "chatbot"])
        expect(em.query).toHaveBeenCalledWith(LIST_SOURCES, [WS, null])
    })

    it("answers no summaries when the workspace has no sources", async () => {
        const em = mockEntityManager({ query: [LIST_SOURCES, []] })
        const { service } = await build(em)
        await expect(service.list("u1", WS)).resolves.toEqual([])
        expect(em.query).toHaveBeenCalledWith(LIST_SOURCES, [WS, null])
    })

    it("reads the source with its text after checking workspace membership", async () => {
        const em = mockEntityManager({ query: [SELECT_SOURCE_DETAIL, [listRowOf()]] })
        const { service, members } = await build(em)
        await expect(service.detail("u1", WS, "s1")).resolves.toEqual({ ...summary, content: "c" })
        expect(members.require).toHaveBeenCalledWith("u1", WS)
        expect(em.query).toHaveBeenCalledWith(SELECT_SOURCE_DETAIL, [WS, "s1"])
    })

    it("refuses detail when the source does not belong to the workspace", async () => {
        const em = mockEntityManager({ query: [SELECT_SOURCE_DETAIL, []] })
        const { service } = await build(em)
        await expect(service.detail("u1", WS, "s1")).rejects.toMatchObject(missing)
        expect(em.query).toHaveBeenCalledWith(SELECT_SOURCE_DETAIL, [WS, "s1"])
    })

    it("allows internal readers shared and matching documents and rejects a different module or instance", async () => {
        const em = mockEntityManager({
            query: [
                LIST_READABLE_SOURCES,
                [
                    readableRowOf(),
                    readableRowOf({
                        id: "private",
                        module: "chatbot",
                        installation_id: "i1",
                        visibility: "internal",
                    }),
                    readableRowOf({ id: "legacy", visibility: "legacy", content: null }),
                    readableRowOf({ id: "other-module", module: "sales" }),
                    readableRowOf({ id: "other-instance", module: "chatbot", installation_id: "i2" }),
                ],
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
        expect(em.query).toHaveBeenCalledWith(LIST_READABLE_SOURCES, [WS, "chatbot", "i1", "internal", 8])
    })
})

describe("KnowledgeSourcesService reading", () => {
    it("allows customer readers only public documents and a shared scope rejects instance documents", async () => {
        const em = mockEntityManager({
            query: [
                LIST_READABLE_SOURCES,
                [
                    readableRowOf(),
                    readableRowOf({ id: "private", visibility: "internal" }),
                    readableRowOf({ id: "instance", installation_id: "i1" }),
                ],
            ],
        })
        const { service } = await build(em)
        await expect(
            service.readableFor({ workspaceId: WS, module: "chatbot", installationId: null, audience: "customer" }, 5),
        ).resolves.toEqual([readable])
        expect(em.query).toHaveBeenCalledWith(LIST_READABLE_SOURCES, [WS, "chatbot", null, "customer", 5])
    })
})
