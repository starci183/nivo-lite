import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { StorageAssetsPort, StorageObjectsPort } from "@modules/integrations/object-storage"
import { REMOTE_FILES } from "@modules/integrations/remote-files"
import type { RemoteFileRequest, RemoteFiles } from "@modules/integrations/remote-files"
import { ERROR_REPORTER, type ErrorReporter } from "@modules/platform/errors"
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
    const errors = mock<ErrorReporter>()
    assets.upload.mockResolvedValue({ error: null })
    const moduleRef = await Test.createTestingModule({
        providers: [
            CustomerFilesService,
            { provide: LOGGER, useValue: logger },
            { provide: REMOTE_FILES, useValue: remote },
            { provide: CHAT_FILES_STORAGE, useValue: storage },
            ...(withAssets ? [{ provide: CHAT_FILES_ASSETS, useValue: assets }] : []),
            { provide: ERROR_REPORTER, useValue: errors },
        ],
    }).compile()
    return { service: moduleRef.get(CustomerFilesService), logger, remote, storage, assets, errors }
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

    // DEF-7 (MX N-01): a picture-only line was stored `{ url: "", name: "", contentType: "image/*" }` and only a warning said why: the
    // line did not say the file was not kept nor why, and nobody was told. Now the reason is on the line and each file is reported.
    it("keeps a file it could not read on the line with no address and WHY in its id, and reports each as an app error", async () => {
        const { service, remote, logger, errors } = await build()
        remote.read
            .mockImplementationOnce(answering(null, "image/jpeg", 404))
            .mockImplementationOnce(answering(Buffer.from("<html>"), "text/html"))
            .mockRejectedValueOnce(new Error("timeout"))

        const kept = await service.keep("ws-1", "zalo:m-2", [
            { kind: "image", url: ZALO_URL, name: "" },
            { kind: "image", url: ZALO_URL, name: "" },
            { kind: "file", url: ZALO_URL, name: "a.pdf" },
        ])

        expect(kept.map((file) => [file.id, file.url, file.contentType])).toEqual([
            ["unread:refused_404:0", "", "image/*"],
            ["unread:refused_200:1", "", "image/*"],
            ["unread:fetch_failed:2", "", "application/octet-stream"],
        ])
        expect(logger.warn).toHaveBeenCalledWith(ChatFilesLogEvent.CustomerFileNotKept, expect.any(Object))
        expect(errors.report.mock.calls.map(([scope, , context]) => [scope, context])).toEqual([
            ["chat_files.customer_file_not_kept", { workspaceId: "ws-1", event: "zalo:m-2", index: 0, reason: "refused_404" }],
            ["chat_files.customer_file_not_kept", { workspaceId: "ws-1", event: "zalo:m-2", index: 1, reason: "refused_200" }],
            ["chat_files.customer_file_not_kept", { workspaceId: "ws-1", event: "zalo:m-2", index: 2, reason: "fetch_failed" }],
        ])
    })

    it("keeps nothing when the app has no whole-file store, and reads nothing", async () => {
        const { service, remote, errors } = await build(false)

        const kept = await service.keep("ws-1", "zalo:m-3", [{ kind: "image", url: ZALO_URL, name: "" }])

        expect(kept.map((file) => [file.id, file.url])).toEqual([["unread:no_store:0", ""]])
        expect(remote.read).not.toHaveBeenCalled()
        expect(errors.report).toHaveBeenCalledTimes(1)
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
