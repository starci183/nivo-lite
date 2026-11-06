import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { EntitlementsService } from "@modules/domain/billing"
import type { StorageObjectsPort } from "@modules/integrations/object-storage"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { ok, refused } from "@modules/platform/primitives"
import { In } from "typeorm"
import { chatFileAttachmentOf, chatFileAttachmentRowsOf } from "@tests/fixtures/builders/chat-files.builder"
import { OfficeFileAttachmentEntity } from "./persistence/entities"
import { CHAT_FILE_MAX_BYTES } from "./chat-file.policy"
import { CHAT_FILES_STORAGE } from "./chat-files.decorators"
import { ChatFilesService } from "./chat-files.service"
import { ChatFilesErrorCode } from "./errors/chat-files.error"

const SCOPE = { workspaceId: "ws-1" }
const OBJECT_ID = "0f8fad5b-d9cb-469f-a165-70867728950e"
const PATH = `ws-1/chat/office/${OBJECT_ID}.png`
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])

const build = async () => {
    const em = mockEntityManager()
    const storage = mock<StorageObjectsPort>()
    const entitlements = mock<EntitlementsService>()
    const catalog = mock<MessageCatalog>({ get: jest.fn((key: string) => key) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChatFilesService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CHAT_FILES_STORAGE, useValue: storage },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: EntitlementsService, useValue: entitlements },
        ],
    }).compile()
    return { em, storage, entitlements, catalog, service: moduleRef.get(ChatFilesService) }
}

describe("ChatFilesService", () => {
    it("issues no address for a file over the limit", async () => {
        const { service, storage } = await build()
        await expect(
            service.requestUpload(SCOPE, { contentType: "image/png", sizeBytes: CHAT_FILE_MAX_BYTES + 1 }),
        ).rejects.toMatchObject({ code: ChatFilesErrorCode.FileInvalid })
        expect(storage.signedUpload).not.toHaveBeenCalled()
    })

    it("refuses a path outside the Office folder before touching the store", async () => {
        const { service, storage } = await build()
        await expect(service.verify(SCOPE, `ws-2/chat/office/${OBJECT_ID}.png`, "a.png")).rejects.toMatchObject({
            code: ChatFilesErrorCode.PathInvalid,
        })
        expect(storage.sizeOf).not.toHaveBeenCalled()
    })

    it("takes the type from the bytes", async () => {
        const { service, storage } = await build()
        storage.sizeOf.mockResolvedValue(ok(PNG.length))
        storage.download.mockResolvedValue(ok({ bytes: PNG, contentType: "application/pdf" }))
        await expect(service.verify(SCOPE, PATH, "a.png")).resolves.toEqual({
            path: PATH,
            name: "a.png",
            contentType: "image/png",
            sizeBytes: PNG.length,
        })
    })

    it("removes an object larger than the limit without reading it", async () => {
        const { service, storage } = await build()
        storage.sizeOf.mockResolvedValue(ok(CHAT_FILE_MAX_BYTES + 1))
        storage.remove.mockResolvedValue(ok(1))
        await expect(service.verify(SCOPE, PATH, "a.png")).rejects.toMatchObject({
            code: ChatFilesErrorCode.FileInvalid,
        })
        expect(storage.download).not.toHaveBeenCalled()
        expect(storage.remove).toHaveBeenCalledWith("media", [PATH])
    })

    it("removes an object whose bytes are no accepted type", async () => {
        const { service, storage } = await build()
        storage.sizeOf.mockResolvedValue(ok(3))
        storage.download.mockResolvedValue(ok({ bytes: Uint8Array.from([1, 2, 3]), contentType: "image/png" }))
        storage.remove.mockResolvedValue(ok(1))
        await expect(service.verify(SCOPE, PATH, "a.png")).rejects.toMatchObject({
            code: ChatFilesErrorCode.FileInvalid,
        })
        expect(storage.remove).toHaveBeenCalledWith("media", [PATH])
    })

    it("treats an upload that never landed as a wrong path", async () => {
        const { service, storage } = await build()
        storage.sizeOf.mockResolvedValue(refused("OBJECT_STORAGE_NOT_FOUND"))
        await expect(service.verify(SCOPE, PATH, "a.png")).rejects.toMatchObject({
            code: ChatFilesErrorCode.PathInvalid,
        })
    })

    it("has no bytes for a message without a file", async () => {
        const { service, em } = await build()
        em.findOne.mockResolvedValue(null)
        await expect(service.storedOf("ws-1", "m-1")).resolves.toBeNull()
    })
})

describe("ChatFilesService.requestUpload", () => {
    const facts = { contentType: "image/png", sizeBytes: PNG.length }

    it("allocates and signs a private path after proving the workspace storage allowance", async () => {
        const { service, em, storage, entitlements } = await build()
        entitlements.requireStorageFor.mockResolvedValue(undefined)
        em.query.mockResolvedValue([{ gen_random_uuid: OBJECT_ID }])
        storage.signedUpload.mockResolvedValue(
            ok({ path: PATH, token: "", signedUrl: "https://files.example.test/upload" }),
        )

        await expect(service.requestUpload(SCOPE, facts)).resolves.toEqual({
            path: PATH,
            signedUrl: "https://files.example.test/upload",
        })
        expect(entitlements.requireStorageFor).toHaveBeenCalledWith("ws-1", PNG.length)
        expect(em.query).toHaveBeenCalledWith('SELECT * FROM "pg_catalog"."gen_random_uuid"()', [])
        expect(storage.signedUpload).toHaveBeenCalledWith("media", PATH, "image/png")
    })

    it("does not allocate or sign anything when the workspace storage allowance is refused", async () => {
        const { service, em, storage, entitlements } = await build()
        const cause = new Error("workspace storage exhausted")
        entitlements.requireStorageFor.mockRejectedValue(cause)
        await expect(service.requestUpload(SCOPE, facts)).rejects.toBe(cause)
        expect(em.query).not.toHaveBeenCalled()
        expect(storage.signedUpload).not.toHaveBeenCalled()
    })

    it("refuses an allocation that answers no identity before asking the object store", async () => {
        const { service, em, storage, entitlements } = await build()
        entitlements.requireStorageFor.mockResolvedValue(undefined)
        em.query.mockResolvedValue([])
        await expect(service.requestUpload(SCOPE, facts)).rejects.toMatchObject({
            code: ChatFilesErrorCode.StorageUnavailable,
        })
        expect(storage.signedUpload).not.toHaveBeenCalled()
    })

    it("keeps a refused signing request visible as unavailable storage", async () => {
        const { service, em, storage, entitlements } = await build()
        entitlements.requireStorageFor.mockResolvedValue(undefined)
        em.query.mockResolvedValue([{ gen_random_uuid: OBJECT_ID }])
        storage.signedUpload.mockResolvedValue(refused("OBJECT_STORAGE_UNAVAILABLE"))
        await expect(service.requestUpload(SCOPE, facts)).rejects.toMatchObject({
            code: ChatFilesErrorCode.StorageUnavailable,
        })
    })
})

describe("ChatFilesService verification failures", () => {
    it("preserves an unavailable size lookup without deleting an object it could not inspect", async () => {
        const { service, storage } = await build()
        storage.sizeOf.mockResolvedValue(refused("OBJECT_STORAGE_UNAVAILABLE"))
        await expect(service.verify(SCOPE, PATH, "a.png")).rejects.toMatchObject({
            code: ChatFilesErrorCode.StorageUnavailable,
        })
        expect(storage.download).not.toHaveBeenCalled()
        expect(storage.remove).not.toHaveBeenCalled()
    })

    it.each([
        ["OBJECT_STORAGE_NOT_FOUND", ChatFilesErrorCode.PathInvalid],
        ["OBJECT_STORAGE_UNAVAILABLE", ChatFilesErrorCode.StorageUnavailable],
    ] as const)("maps a download refusal %s without accepting or removing an unread object", async (code, expected) => {
        const { service, storage } = await build()
        storage.sizeOf.mockResolvedValue(ok(PNG.length))
        storage.download.mockResolvedValue(refused(code))
        await expect(service.verify(SCOPE, PATH, "a.png")).rejects.toMatchObject({ code: expected })
        expect(storage.remove).not.toHaveBeenCalled()
    })
})

describe("ChatFilesService.wordsOf and attach", () => {
    it("keeps written text and resolves only an empty file message through its locale", async () => {
        const { service, catalog } = await build()
        expect(service.wordsOf("  Keep these words  ", "en")).toBe("  Keep these words  ")
        expect(catalog.get).not.toHaveBeenCalled()
        expect(service.wordsOf("   ", "en")).toBe("chatFiles.fileSent")
        expect(catalog.get).toHaveBeenCalledWith("chatFiles.fileSent", {}, "en")
    })

    it("records every checked file field through the caller's message transaction", async () => {
        const { service, em } = await build()
        const tx = mockEntityManager()
        tx.insert.mockResolvedValue({ identifiers: [], generatedMaps: [], raw: [] })
        await expect(
            service.attach(
                SCOPE,
                { path: PATH, name: "a.png", contentType: "image/png", sizeBytes: PNG.length },
                "m-1",
                tx,
            ),
        ).resolves.toBeUndefined()
        expect(tx.insert).toHaveBeenCalledWith(OfficeFileAttachmentEntity, {
            workspaceId: "ws-1",
            messageId: "m-1",
            path: PATH,
            name: "a.png",
            contentType: "image/png",
            sizeBytes: PNG.length,
        })
        expect(em.insert).not.toHaveBeenCalled()
    })
})

describe("ChatFilesService.viewsOf", () => {
    it("does not query or sign when the caller requests no messages", async () => {
        const { service, em, storage } = await build()
        await expect(service.viewsOf("ws-1", [])).resolves.toEqual([])
        expect(em.find).not.toHaveBeenCalled()
        expect(storage.signedUrls).not.toHaveBeenCalled()
    })

    it("does not sign when the scoped messages have no attachments", async () => {
        const { service, em, storage } = await build()
        em.find.mockResolvedValue([])
        await expect(service.viewsOf("ws-1", ["m-1"])).resolves.toEqual([])
        expect(storage.signedUrls).not.toHaveBeenCalled()
    })

    it("keeps signed attachments in stable order and omits an object the signer no longer holds", async () => {
        const { service, em, storage } = await build()
        const rows = chatFileAttachmentRowsOf()
        em.find.mockResolvedValue(rows)
        storage.signedUrls.mockResolvedValue(ok([{ path: PATH, signedUrl: "https://files.example.test/read" }]))
        await expect(service.viewsOf("ws-1", ["m-1", "m-2"])).resolves.toEqual([
            {
                id: "attachment-1",
                messageId: "m-1",
                name: "a.png",
                contentType: "image/png",
                url: "https://files.example.test/read",
            },
        ])
        expect(em.find).toHaveBeenCalledWith(OfficeFileAttachmentEntity, {
            where: { workspaceId: "ws-1", messageId: In(["m-1", "m-2"]) },
            order: { createdAt: "ASC", id: "ASC" },
            take: 200,
        })
        expect(storage.signedUrls).toHaveBeenCalledWith(
            "media",
            rows.map((row) => row.path),
            3600,
        )
    })

    it("fails the read when the object store cannot sign its existing attachments", async () => {
        const { service, em, storage } = await build()
        em.find.mockResolvedValue([chatFileAttachmentOf()])
        storage.signedUrls.mockResolvedValue(refused("OBJECT_STORAGE_UNAVAILABLE"))
        await expect(service.viewsOf("ws-1", ["m-1"])).rejects.toMatchObject({
            code: ChatFilesErrorCode.StorageUnavailable,
        })
    })
})

describe("ChatFilesService stored content", () => {
    it("returns no stored file when an attachment's bytes are no longer available", async () => {
        const { service, em, storage } = await build()
        em.findOne.mockResolvedValue(chatFileAttachmentOf())
        storage.download.mockResolvedValue(refused("OBJECT_STORAGE_NOT_FOUND"))
        await expect(service.storedOf("ws-1", "m-1")).resolves.toBeNull()
        expect(storage.download).toHaveBeenCalledWith("media", PATH)
    })

    it("returns the first scoped attachment's identity, bytes and saved read", async () => {
        const { service, em, storage } = await build()
        em.findOne.mockResolvedValue(chatFileAttachmentOf())
        storage.download.mockResolvedValue(ok({ bytes: PNG, contentType: "image/png" }))
        await expect(service.storedOf("ws-1", "m-1")).resolves.toEqual({
            id: "attachment-1",
            name: "a.png",
            contentType: "image/png",
            bytes: PNG,
            read: null,
        })
        expect(em.findOne).toHaveBeenCalledWith(OfficeFileAttachmentEntity, {
            where: { workspaceId: "ws-1", messageId: "m-1" },
            order: { createdAt: "ASC", id: "ASC" },
        })
    })

    it("keeps an exact read on the addressed workspace attachment", async () => {
        const { service, em } = await build()
        const read = { isTransfer: true, amountVnd: 3500000, recipient: "Shop", paidAt: "10:00" }
        em.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] })
        await expect(service.keepRead("ws-1", "attachment-1", read)).resolves.toBeUndefined()
        expect(em.update).toHaveBeenCalledWith(
            OfficeFileAttachmentEntity,
            { id: "attachment-1", workspaceId: "ws-1" },
            { read },
        )
    })
})
