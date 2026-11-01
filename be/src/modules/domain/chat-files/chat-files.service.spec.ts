import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { EntitlementsService } from "@modules/domain/billing"
import type { StorageObjectsPort } from "@modules/integrations/object-storage"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { ok, refused } from "@modules/platform/primitives"
import { CHAT_FILE_MAX_BYTES } from "./chat-file.policy"
import { CHAT_FILES_STORAGE } from "./chat-files.decorators"
import { ChatFilesService } from "./chat-files.service"
import { ChatFilesErrorCode } from "./errors/chat-files.error"

const SCOPE = { workspaceId: "ws-1", conversationId: "conv-1" }
const OBJECT_ID = "0f8fad5b-d9cb-469f-a165-70867728950e"
const PATH = `ws-1/chat/conv-1/${OBJECT_ID}.png`
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])

const build = async () => {
    const em = mockEntityManager()
    const storage = mock<StorageObjectsPort>()
    const entitlements = mock<EntitlementsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChatFilesService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CHAT_FILES_STORAGE, useValue: storage },
            { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>({ get: jest.fn((key: string) => key) }) },
            { provide: EntitlementsService, useValue: entitlements },
        ],
    }).compile()
    return { em, storage, entitlements, service: moduleRef.get(ChatFilesService) }
}

describe("ChatFilesService", () => {
    it("issues no address for a file over the limit", async () => {
        const { service, storage } = await build()
        await expect(
            service.requestUpload(SCOPE, { contentType: "image/png", sizeBytes: CHAT_FILE_MAX_BYTES + 1 }),
        ).rejects.toMatchObject({ code: ChatFilesErrorCode.FileInvalid })
        expect(storage.signedUpload).not.toHaveBeenCalled()
    })

    it("refuses a path outside the conversation before touching the store", async () => {
        const { service, storage } = await build()
        await expect(service.verify(SCOPE, `ws-2/chat/conv-1/${OBJECT_ID}.png`, "a.png")).rejects.toMatchObject({
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
