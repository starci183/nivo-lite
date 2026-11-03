import { resolve } from "node:path"
import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { EntitlementsService } from "@modules/domain/billing"
import type { StorageAssetsPort } from "@modules/integrations/object-storage"
import { HTTP_CLIENT } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CHAT_FILES_ASSETS, CHAT_FILES_IMPORT_ROOT, CHAT_FILES_READER } from "./chat-files.decorators"
import { ChatFilesLogEvent } from "./chat-files.log-events"
import type { InboundFileReader } from "./inbound-file.reader"
import { InboundFilesService } from "./inbound-files.service"
import { AgentMessageAttachmentEntity } from "./persistence/entities"

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])
const ROOT = "/work/.starciwork"
const remote = { url: "https://cdn.test/a.png", localPath: "", name: "" }
const local = { url: "", localPath: "receipts/b.png", name: "b.png" }

const build = async () => {
    const http = mock<HttpClient>()
    http.request.mockResolvedValue({ status: 200, headers: { "content-type": "image/png" }, body: PNG })
    const assets = mock<StorageAssetsPort>()
    assets.upload.mockResolvedValue({ error: null })
    const reader = mock<InboundFileReader>()
    reader.read.mockResolvedValue(PNG)
    const logger = mock<Logger>()
    const entitlements = mock<EntitlementsService>()
    entitlements.requireStorageFor.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            InboundFilesService,
            { provide: HTTP_CLIENT, useValue: http },
            { provide: CHAT_FILES_ASSETS, useValue: assets },
            { provide: CHAT_FILES_IMPORT_ROOT, useValue: ROOT },
            { provide: CHAT_FILES_READER, useValue: reader },
            { provide: LOGGER, useValue: logger },
            { provide: EntitlementsService, useValue: entitlements },
        ],
    }).compile()
    return { service: moduleRef.get(InboundFilesService), http, assets, reader, logger, entitlements }
}

describe("InboundFilesService download from an address", () => {
    it("downloads with a deadline, without following a redirect, and proves the type from the bytes", async () => {
        const { service, http } = await build()

        const file = await service.download(remote, false)

        expect(http.request).toHaveBeenCalledWith({
            method: "GET",
            url: "https://cdn.test/a.png",
            read: "bytes",
            redirect: "manual",
            timeoutMs: 15_000,
        })
        expect(file).toMatchObject({ contentType: "image/png", name: "a.png", sourceUrl: "https://cdn.test/a.png" })
        expect(file?.bytes.length).toBe(PNG.length)
    })

    it("keeps the name the sender gave", async () => {
        const { service } = await build()

        await expect(service.download({ ...remote, name: "receipt.png" }, false)).resolves.toMatchObject({ name: "receipt.png" })
    })

    it.each([
        ["an address that is not https", { ...remote, url: "http://cdn.test/a.png" }],
        ["an internal address", { ...remote, url: "https://localhost/a.png" }],
        ["nothing to read", { url: "", localPath: "", name: "" }],
        ["a local path from a source that is not an import", local],
    ])("skips %s without a request", async (_name, source) => {
        const { service, http, logger } = await build()

        await expect(service.download(source, false)).resolves.toBeNull()

        expect(http.request).not.toHaveBeenCalled()
        expect(logger.warn).toHaveBeenCalledWith(ChatFilesLogEvent.InboundSkipped, expect.objectContaining({ reason: "unreadable" }))
    })

    it.each([
        ["a failed request", () => Promise.reject(new Error("timeout"))],
        ["a redirect", () => Promise.resolve({ status: 302, headers: { location: "https://elsewhere.test" }, body: Buffer.alloc(0) })],
        ["a body that is not bytes", () => Promise.resolve({ status: 200, headers: {}, body: "text" })],
        ["a page", () => Promise.resolve({ status: 200, headers: { "content-type": "text/html" }, body: PNG })],
        ["an empty body", () => Promise.resolve({ status: 200, headers: {}, body: Buffer.alloc(0) })],
        ["a body over the limit", () => Promise.resolve({ status: 200, headers: {}, body: Buffer.alloc(10 * 1024 * 1024 + 1, 0x89) })],
        ["bytes that are not a picture", () => Promise.resolve({ status: 200, headers: {}, body: Buffer.from("<html></html>") })],
    ])("skips %s", async (_name, answer) => {
        const { service, http, logger } = await build()
        http.request.mockImplementation(answer)

        await expect(service.download(remote, false)).resolves.toBeNull()

        expect(logger.warn).toHaveBeenCalledWith(ChatFilesLogEvent.InboundSkipped, { reason: "unreadable", host: "cdn.test", local: false })
    })

    it("accepts an answer that declares no headers at all", async () => {
        const { service, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: PNG })

        await expect(service.download(remote, false)).resolves.not.toBeNull()
    })
})

describe("InboundFilesService download from a manual import", () => {
    it("reads a file inside the import folder", async () => {
        const { service, reader } = await build()

        const file = await service.download(local, true)

        expect(reader.read).toHaveBeenCalledWith(resolve(ROOT, "receipts", "b.png"), 10 * 1024 * 1024)
        expect(file).toMatchObject({ contentType: "image/png", name: "b.png", sourceUrl: "receipts/b.png" })
    })

    it("skips a path that leaves the import folder and a file that is missing", async () => {
        const { service, reader, logger } = await build()

        await expect(service.download({ ...local, localPath: "../../etc/passwd" }, true)).resolves.toBeNull()
        reader.read.mockResolvedValue(null)
        await expect(service.download(local, true)).resolves.toBeNull()

        expect(reader.read).toHaveBeenCalledTimes(1)
        expect(logger.warn).toHaveBeenCalledWith(ChatFilesLogEvent.InboundSkipped, { reason: "unreadable", host: "", local: true })
    })
})

describe("InboundFilesService keep", () => {
    const scope = { workspaceId: "ws-1", conversationId: "conv-1" }
    const file = { bytes: new Uint8Array(PNG), contentType: "image/png", name: "a.png", sourceUrl: "https://cdn.test/a.png" }

    it("writes the file to the private store of the conversation and records it on the message with where it came from", async () => {
        const { service, assets, entitlements } = await build()
        const tx = fakeTransaction(mockEntityManager({ insert: [AgentMessageAttachmentEntity, { identifiers: [], generatedMaps: [], raw: [] }] }))

        await expect(service.keep(scope, file, "zalo:m-1", "msg-1", tx.em)).resolves.toBe(true)

        expect(entitlements.requireStorageFor).toHaveBeenCalledWith("ws-1", PNG.length)
        const [bucket, path, body, type] = assets.upload.mock.calls[0] ?? []
        expect(bucket).toBe("media")
        expect(path).toMatch(/^ws-1\/chat\/conv-1\/[0-9a-f-]{36}\.png$/u)
        expect(Buffer.isBuffer(body)).toBe(true)
        expect(type).toBe("image/png")
        expect(tx.em.insert).toHaveBeenCalledWith(AgentMessageAttachmentEntity, {
            workspaceId: "ws-1",
            conversationId: "conv-1",
            messageId: "msg-1",
            path,
            name: "a.png",
            contentType: "image/png",
            sizeBytes: PNG.length,
            sourceUrl: "https://cdn.test/a.png",
            sourceRef: "zalo:m-1",
        })
    })

    it("leaves the file out, and says so, when the plan has no room", async () => {
        const { service, assets, entitlements, logger } = await build()
        entitlements.requireStorageFor.mockRejectedValue(new Error("quota"))
        const tx = fakeTransaction(mockEntityManager())

        await expect(service.keep(scope, file, "zalo:m-1", "msg-1", tx.em)).resolves.toBe(false)

        expect(assets.upload).not.toHaveBeenCalled()
        expect(logger.warn).toHaveBeenCalledWith(ChatFilesLogEvent.InboundSkipped, { reason: "plan", contentType: "image/png", sizeBytes: PNG.length })
    })

    it("leaves the file out, and records nothing, when the store refuses it", async () => {
        const { service, assets, logger } = await build()
        assets.upload.mockResolvedValue({ error: new Error("denied") })
        const tx = fakeTransaction(mockEntityManager())

        await expect(service.keep(scope, file, "zalo:m-1", "msg-1", tx.em)).resolves.toBe(false)

        expect(tx.em.insert).not.toHaveBeenCalled()
        expect(logger.warn).toHaveBeenCalledWith(ChatFilesLogEvent.InboundSkipped, expect.objectContaining({ reason: "store" }))
    })
})
