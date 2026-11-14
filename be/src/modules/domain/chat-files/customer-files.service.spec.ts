import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { StorageAssetsPort, StorageObjectsPort } from "@modules/integrations/object-storage"
import { REMOTE_FILES } from "@modules/integrations/remote-files"
import type { RemoteFileRequest, RemoteFiles } from "@modules/integrations/remote-files"
import { LOGGER } from "@modules/platform/logging"
import { ok } from "@modules/platform/primitives"
import type { Logger } from "@modules/platform/logging"
import { CHAT_FILES_ASSETS, CHAT_FILES_STORAGE } from "./chat-files.decorators"
import { ChatFilesLogEvent } from "./chat-files.log-events"
import { CustomerFilesService } from "./customer-files.service"

// D-MX-4 (live IMG, 2026-11-11): Zalo's `user_send_image` stored only "[image] <caption>" with `files` null, so no step saw
// the picture. The picture is now read once from the channel's address and kept in the shop's own store; the line keeps the shop's
// address, which never expires.

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
const ZALO_URL = "https://photo-zalo.test/abc.jpg"

const build = async (withAssets = true) => {
    const logger = mock<Logger>()
    const remote = mock<RemoteFiles>()
    const storage = mock<StorageObjectsPort>()
    const assets = mock<StorageAssetsPort>()
    assets.upload.mockResolvedValue({ error: null })
    const moduleRef = await Test.createTestingModule({
        providers: [
            CustomerFilesService,
            { provide: LOGGER, useValue: logger },
            { provide: REMOTE_FILES, useValue: remote },
            { provide: CHAT_FILES_STORAGE, useValue: storage },
            ...(withAssets ? [{ provide: CHAT_FILES_ASSETS, useValue: assets }] : []),
        ],
    }).compile()
    return { service: moduleRef.get(CustomerFilesService), logger, remote, storage, assets }
}

const answering = (bytes: Buffer | null, contentType = "image/jpeg", status = 200) =>
    (request: RemoteFileRequest) =>
        Promise.resolve({
            status,
            contentType,
            location: undefined,
            length: bytes?.length ?? 0,
            bytes: bytes !== null && request.accepts(contentType) ? bytes : null,
        })

describe("CustomerFilesService.keep", () => {
    it("LIVE IMG: reads the picture once from Zalo, keeps it under a path the message decides, the line gets the shop's address", async () => {
        const { service, remote, assets } = await build()
        remote.read.mockImplementation(answering(JPEG))

        const [kept] = await service.keep("ws-1", "zalo:m-1", [{ kind: "image", url: ZALO_URL, name: "" }])

        expect(remote.read).toHaveBeenCalledWith(expect.objectContaining({ url: ZALO_URL, maxBytes: 10 * 1024 * 1024 }))
        const path = String(assets.upload.mock.calls[0]?.[1])
        expect(path).toMatch(/^ws-1\/chat\/customer\/[0-9a-f]{32}-0\.jpg$/u)
        expect(assets.upload).toHaveBeenCalledWith("media", path, JPEG, "image/jpeg")
        expect(kept).toEqual({ id: path, url: `chat-file:${path}`, name: path.slice(path.lastIndexOf("/") + 1), contentType: "image/jpeg" })
        expect(kept?.url).not.toContain("zalo")
    })

    it("writes the same object when the same message is heard again (a redelivery or a retried job)", async () => {
        const { service, remote, assets } = await build()
        remote.read.mockImplementation(answering(JPEG))

        await service.keep("ws-1", "zalo:m-1", [{ kind: "image", url: ZALO_URL, name: "" }])
        await service.keep("ws-1", "zalo:m-1", [{ kind: "image", url: ZALO_URL, name: "" }])

        expect(assets.upload.mock.calls[0]?.[1]).toBe(assets.upload.mock.calls[1]?.[1])
    })

    it("keeps a picture it could not read on the line with no address, and logs why", async () => {
        const { service, remote, logger } = await build()
        remote.read
            .mockImplementationOnce(answering(null, "image/jpeg", 404))
            .mockImplementationOnce(answering(Buffer.from("<html>"), "text/html"))
            .mockRejectedValueOnce(new Error("timeout"))

        const kept = await service.keep("ws-1", "zalo:m-2", [
            { kind: "image", url: ZALO_URL, name: "" },
            { kind: "image", url: ZALO_URL, name: "" },
            { kind: "file", url: ZALO_URL, name: "a.pdf" },
        ])

        expect(kept.map((file) => [file.url, file.contentType])).toEqual([
            ["", "image/*"],
            ["", "image/*"],
            ["", "application/octet-stream"],
        ])
        expect(logger.warn).toHaveBeenCalledWith(ChatFilesLogEvent.CustomerFileNotKept, expect.any(Object))
    })

    it("keeps nothing when the app has no whole-file store, and reads nothing", async () => {
        const { service, remote } = await build(false)

        const kept = await service.keep("ws-1", "zalo:m-3", [{ kind: "image", url: ZALO_URL, name: "" }])

        expect(kept.map((file) => file.url)).toEqual([""])
        expect(remote.read).not.toHaveBeenCalled()
    })
})

describe("CustomerFilesService.bytesOf", () => {
    it("reads a kept file of the workspace, and never one of another workspace or an address that is not the shop's", async () => {
        const { service, storage } = await build()
        storage.download.mockResolvedValue(ok({ bytes: JPEG, contentType: "image/jpeg" }))

        await expect(service.bytesOf("ws-1", "chat-file:ws-1/chat/customer/k-0.jpg")).resolves.toEqual({
            contentType: "image/jpeg",
            bytes: JPEG,
        })
        await expect(service.bytesOf("ws-1", "chat-file:ws-2/chat/customer/k-0.jpg")).resolves.toBeNull()
        await expect(service.bytesOf("ws-1", ZALO_URL)).resolves.toBeNull()
        expect(storage.download).toHaveBeenCalledTimes(1)
    })
})
