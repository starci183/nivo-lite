import { resolve } from "node:path"
import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { EntitlementsService } from "@modules/domain/billing"
import type { StorageAssetsPort } from "@modules/integrations/object-storage"
import { HTTP_CLIENT } from "@modules/platform/http"
import type { HttpClient, HttpResponse } from "@modules/platform/http"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import {
    CHAT_FILES_ASSETS,
    CHAT_FILES_IMPORT_ROOT,
    CHAT_FILES_READER,
    CHAT_FILES_RESOLVER,
} from "./chat-files.decorators"
import { ChatFilesLogEvent } from "./chat-files.log-events"
import type { InboundFileReader } from "./inbound-file.reader"
import type { HostResolver } from "./inbound-file.resolver"
import { InboundFilesService } from "./inbound-files.service"
import { AgentMessageAttachmentEntity } from "./persistence/entities"

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([1, 0, 0, 0]), Buffer.from("WEBPVP8 ")])
const HEIC = Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, ...Buffer.from("heic"), 0, 0])
const GIF = Buffer.from("GIF89a....")
const ROOT = "/work/.starciwork"
const PUBLIC_ADDRESS = { address: "203.0.113.7", family: 4 as const }
/** The shape of a live `user_send_image` attachment: the address has no query and no extension, and the event names no file. */
const LIVE = "https://photo-stal-34.zdn.vn/jpg/aaaa/bbbb"
const THUMB = "https://photo-stal-34.zdn.vn/jpg/aaaa/thumb"
const remote = { url: LIVE, thumbnailUrl: "", localPath: "", name: "" }
const local = { url: "", thumbnailUrl: "", localPath: "receipts/b.png", name: "b.png" }

const answer = (status: number, body: Buffer | string | undefined, headers: Record<string, string> = {}): HttpResponse => ({
    status,
    headers,
    body,
})

const build = async () => {
    const http = mock<HttpClient>()
    http.request.mockResolvedValue(answer(200, PNG, { "content-type": "image/png" }))
    const assets = mock<StorageAssetsPort>()
    assets.upload.mockResolvedValue({ error: null })
    const reader = mock<InboundFileReader>()
    reader.read.mockResolvedValue(PNG)
    const resolver = mock<HostResolver>()
    resolver.resolve.mockResolvedValue([PUBLIC_ADDRESS])
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
            { provide: CHAT_FILES_RESOLVER, useValue: resolver },
            { provide: LOGGER, useValue: logger },
            { provide: EntitlementsService, useValue: entitlements },
        ],
    }).compile()
    return { service: moduleRef.get(InboundFilesService), http, assets, reader, resolver, logger, entitlements }
}

describe("InboundFilesService download from an address", () => {
    it("asks the way a browser asks for a picture, at the address it checked, and does not follow redirects by itself", async () => {
        const { service, http, resolver } = await build()

        await service.download(remote, false, "m-1")

        expect(resolver.resolve).toHaveBeenCalledWith("photo-stal-34.zdn.vn")
        expect(http.request).toHaveBeenCalledWith({
            method: "GET",
            url: LIVE,
            headers: expect.objectContaining({
                accept: expect.stringContaining("image/*"),
                "user-agent": expect.stringContaining("Mozilla/5.0"),
            }),
            read: "bytes",
            redirect: "manual",
            pin: PUBLIC_ADDRESS,
            timeoutMs: 15_000,
        })
    })

    it("stores a picture whose address has no extension under the id of the message and the type the bytes prove", async () => {
        const { service, http } = await build()
        http.request.mockResolvedValue(answer(200, WEBP, { "content-type": "application/octet-stream" }))

        const file = await service.download(remote, false, "ab12-CD_3")

        expect(file).toMatchObject({ contentType: "image/webp", name: "ab12-CD_3.webp", sourceUrl: LIVE })
        expect(file?.bytes.length).toBe(WEBP.length)
    })

    it("names the second picture of a message after its place, and keeps a name the sender gave", async () => {
        const { service } = await build()

        await expect(service.download(remote, false, "m-1", 1)).resolves.toMatchObject({ name: "m-1-2.png" })
        await expect(service.download({ ...remote, name: "receipt.png" }, false, "m-1")).resolves.toMatchObject({
            name: "receipt.png",
        })
    })

    it("believes the bytes, not the type the server declared", async () => {
        const { service, http } = await build()
        http.request.mockResolvedValue(answer(200, PNG, { "content-type": "image/jpeg" }))

        await expect(service.download(remote, false, "m-1")).resolves.toMatchObject({ contentType: "image/png" })
    })

    it("accepts an answer that declares no headers at all", async () => {
        const { service, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: PNG })

        await expect(service.download(remote, false, "m-1")).resolves.not.toBeNull()
    })
})

describe("InboundFilesService redirects", () => {
    it("follows a redirect to another address after checking that address like the first", async () => {
        const { service, http, resolver } = await build()
        http.request
            .mockResolvedValueOnce(answer(302, "", { location: "https://cdn-2.zdn.vn/p/1" }))
            .mockResolvedValueOnce(answer(200, PNG, { "content-type": "image/png" }))

        const file = await service.download(remote, false, "m-1")

        expect(file).toMatchObject({ contentType: "image/png", sourceUrl: LIVE })
        expect(resolver.resolve).toHaveBeenNthCalledWith(2, "cdn-2.zdn.vn")
        expect(http.request).toHaveBeenNthCalledWith(2, expect.objectContaining({ url: "https://cdn-2.zdn.vn/p/1" }))
    })

    it("follows a relative location", async () => {
        const { service, http } = await build()
        http.request
            .mockResolvedValueOnce(answer(301, "", { location: "/jpg/final" }))
            .mockResolvedValueOnce(answer(200, PNG, {}))

        await service.download(remote, false, "m-1")

        expect(http.request).toHaveBeenNthCalledWith(2, expect.objectContaining({ url: "https://photo-stal-34.zdn.vn/jpg/final" }))
    })

    it.each([
        ["an address that is not https", "http://cdn-2.zdn.vn/p/1"],
        ["an address of an IP", "https://10.0.0.5/p/1"],
        ["an internal name", "https://db.internal/p/1"],
    ])("stops at a redirect to %s", async (_name, location) => {
        const { service, http, logger } = await build()
        http.request.mockResolvedValue(answer(302, "", { location }))

        await expect(service.download(remote, false, "m-1")).resolves.toBeNull()

        expect(http.request).toHaveBeenCalledTimes(1)
        expect(logger.warn).toHaveBeenCalledWith(ChatFilesLogEvent.InboundSkipped, expect.objectContaining({ reason: "blocked", hops: 1 }))
    })

    it("stops at a redirect to a name that resolves to a private address", async () => {
        const { service, http, resolver } = await build()
        http.request.mockResolvedValue(answer(302, "", { location: "https://sneaky.example.test/x" }))
        resolver.resolve
            .mockResolvedValueOnce([PUBLIC_ADDRESS])
            .mockResolvedValueOnce([PUBLIC_ADDRESS, { address: "192.168.1.5", family: 4 }])

        await expect(service.download(remote, false, "m-1")).resolves.toBeNull()

        expect(http.request).toHaveBeenCalledTimes(1)
    })

    it("stops at a first address that does not resolve", async () => {
        const { service, http, resolver } = await build()
        resolver.resolve.mockResolvedValue([])

        await expect(service.download(remote, false, "m-1")).resolves.toBeNull()

        expect(http.request).not.toHaveBeenCalled()
    })

    it("follows at most three redirects", async () => {
        const { service, http, logger } = await build()
        http.request.mockImplementation((request) => Promise.resolve(answer(302, "", { location: `${request.url}x` })))

        await expect(service.download(remote, false, "m-1")).resolves.toBeNull()

        expect(http.request).toHaveBeenCalledTimes(4)
        expect(logger.warn).toHaveBeenCalledWith(
            ChatFilesLogEvent.InboundSkipped,
            expect.objectContaining({ reason: "unreadable", status: 302, hops: 3 }),
        )
    })

    it("gives up on a redirect that names no location", async () => {
        const { service, http } = await build()
        http.request.mockResolvedValue(answer(302, "", {}))

        await expect(service.download(remote, false, "m-1")).resolves.toBeNull()

        expect(http.request).toHaveBeenCalledTimes(1)
    })
})

describe("InboundFilesService a file that is left out", () => {
    it.each([
        ["an address that is not https", { ...remote, url: "http://cdn.test/a" }, "blocked"],
        ["an internal address", { ...remote, url: "https://localhost/a" }, "blocked"],
        ["an address that is no address", { ...remote, url: "not a url" }, "blocked"],
        ["nothing to read", { url: "", thumbnailUrl: "", localPath: "", name: "" }, "unreadable"],
        ["a local path from a source that is not an import", local, "unreadable"],
    ])("skips %s without a request", async (_name, source, reason) => {
        const { service, http, logger } = await build()

        await expect(service.download(source, false, "m-1")).resolves.toBeNull()

        expect(http.request).not.toHaveBeenCalled()
        expect(logger.warn).toHaveBeenCalledWith(ChatFilesLogEvent.InboundSkipped, expect.objectContaining({ reason }))
    })

    it.each([
        ["a failed request", () => Promise.reject(new Error("timeout")), 0, "", 0],
        ["a not-found answer", () => Promise.resolve(answer(404, "", { "content-type": "text/html" })), 404, "text/html", 0],
        ["a body that is not bytes", () => Promise.resolve(answer(200, "text", { "content-type": "image/png" })), 200, "image/png", 0],
        ["a page", () => Promise.resolve(answer(200, PNG, { "content-type": "text/html" })), 200, "text/html", PNG.length],
        ["an empty body", () => Promise.resolve(answer(200, Buffer.alloc(0), {})), 200, "", 0],
        [
            "a body over the limit",
            () => Promise.resolve(answer(200, Buffer.alloc(10 * 1024 * 1024 + 1, 0x89), { "content-type": "image/png" })),
            200,
            "image/png",
            10 * 1024 * 1024 + 1,
        ],
    ])("logs the status, the content type and the length when it meets %s", async (_name, reply, status, contentType, length) => {
        const { service, http, logger } = await build()
        http.request.mockImplementation(reply)

        await expect(service.download(remote, false, "m-1")).resolves.toBeNull()

        expect(logger.warn).toHaveBeenCalledWith(ChatFilesLogEvent.InboundSkipped, {
            reason: "unreadable",
            host: "photo-stal-34.zdn.vn",
            status,
            contentType,
            length,
            hops: 0,
            local: false,
        })
    })

    it("never logs the address, only its host", async () => {
        const { service, http, logger } = await build()
        http.request.mockResolvedValue(answer(403, "", {}))

        await service.download({ ...remote, url: `${LIVE}?sig=top-secret` }, false, "m-1")

        expect(JSON.stringify(logger.warn.mock.calls)).not.toContain("top-secret")
        expect(JSON.stringify(logger.warn.mock.calls)).not.toContain("/jpg/aaaa")
    })

    it.each([
        ["a HEIC picture", HEIC],
        ["a GIF", GIF],
    ])("skips %s as an unsupported type", async (_name, bytes) => {
        const { service, http, logger } = await build()
        http.request.mockResolvedValue(answer(200, bytes, { "content-type": "image/heic" }))

        await expect(service.download(remote, false, "m-1")).resolves.toBeNull()

        expect(logger.warn).toHaveBeenCalledWith(
            ChatFilesLogEvent.InboundSkipped,
            expect.objectContaining({ reason: "unsupported_type", length: bytes.length }),
        )
    })

    it("skips bytes that are no picture as unrecognized", async () => {
        const { service, http, logger } = await build()
        http.request.mockResolvedValue(answer(200, Buffer.from("<html></html>"), { "content-type": "image/png" }))

        await expect(service.download(remote, false, "m-1")).resolves.toBeNull()

        expect(logger.warn).toHaveBeenCalledWith(ChatFilesLogEvent.InboundSkipped, expect.objectContaining({ reason: "unrecognized" }))
    })
})

describe("InboundFilesService the preview", () => {
    it("reads the preview when the full picture cannot be read, and keeps where the full one was", async () => {
        const { service, http } = await build()
        http.request.mockResolvedValueOnce(answer(403, "", {})).mockResolvedValueOnce(answer(200, PNG, {}))

        const file = await service.download({ ...remote, thumbnailUrl: THUMB }, false, "m-1")

        expect(file).toMatchObject({ contentType: "image/png", sourceUrl: LIVE })
        expect(http.request).toHaveBeenNthCalledWith(2, expect.objectContaining({ url: THUMB }))
    })

    it("prefers the full picture and does not ask for the preview when it was read", async () => {
        const { service, http } = await build()

        await service.download({ ...remote, thumbnailUrl: THUMB }, false, "m-1")

        expect(http.request).toHaveBeenCalledTimes(1)
    })

    it("logs the preview's answer when neither can be read", async () => {
        const { service, http, logger } = await build()
        http.request.mockResolvedValue(answer(404, "", {}))

        await expect(service.download({ ...remote, thumbnailUrl: THUMB }, false, "m-1")).resolves.toBeNull()

        expect(http.request).toHaveBeenCalledTimes(2)
        expect(logger.warn).toHaveBeenCalledTimes(1)
    })
})

describe("InboundFilesService download from a manual import", () => {
    it("reads a file inside the import folder", async () => {
        const { service, reader } = await build()

        const file = await service.download(local, true, "m-1")

        expect(reader.read).toHaveBeenCalledWith(resolve(ROOT, "receipts", "b.png"), 10 * 1024 * 1024)
        expect(file).toMatchObject({ contentType: "image/png", name: "b.png", sourceUrl: "receipts/b.png" })
    })

    it("skips a path that leaves the import folder and a file that is missing", async () => {
        const { service, reader, logger } = await build()

        await expect(service.download({ ...local, localPath: "../../etc/passwd" }, true, "m-1")).resolves.toBeNull()
        reader.read.mockResolvedValue(null)
        await expect(service.download(local, true, "m-1")).resolves.toBeNull()

        expect(reader.read).toHaveBeenCalledTimes(1)
        expect(logger.warn).toHaveBeenCalledWith(
            ChatFilesLogEvent.InboundSkipped,
            expect.objectContaining({ reason: "not_found", local: true }),
        )
    })
})

describe("InboundFilesService keep", () => {
    const scope = { workspaceId: "ws-1", conversationId: "conv-1" }
    const file = { bytes: new Uint8Array(PNG), contentType: "image/png", name: "a.png", sourceUrl: LIVE }

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
            sourceUrl: LIVE,
            sourceRef: "zalo:m-1",
        })
    })

    it("leaves the file out, and says so, when the plan has no room", async () => {
        const { service, assets, entitlements, logger } = await build()
        entitlements.requireStorageFor.mockRejectedValue(new Error("quota"))
        const tx = fakeTransaction(mockEntityManager())

        await expect(service.keep(scope, file, "zalo:m-1", "msg-1", tx.em)).resolves.toBe(false)

        expect(assets.upload).not.toHaveBeenCalled()
        expect(logger.warn).toHaveBeenCalledWith(ChatFilesLogEvent.InboundSkipped, {
            reason: "plan",
            contentType: "image/png",
            length: PNG.length,
        })
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
