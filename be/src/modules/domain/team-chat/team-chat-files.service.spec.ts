import { Test } from "@nestjs/testing"
import { FakeClock, fakeIds, mock } from "@starci/jest-preset"
import type { StorageObjectsPort } from "@modules/integrations/object-storage"
import { CLOCK } from "@modules/platform/clock"
import { IDS } from "@modules/platform/ids"
import { TeamChatErrorCode } from "./errors/team-chat.error"
import { TeamChatFilesService } from "./team-chat-files.service"
import { TEAM_CHAT_STORAGE } from "./team-chat.decorators"

const WS = "11111111-1111-4111-8111-111111111111"
const ROOM = "22222222-2222-4222-8222-222222222222"
const FILE_ID = "00000000-0000-4000-8000-000000000001"
const KEY = `${WS}/team-chat/${ROOM}/${FILE_ID}/plan.pdf`
const ASK = { fileName: "plan.pdf", mimeType: "application/pdf", sizeBytes: 1000 }

const build = async (withStorage = true) => {
    const storage = mock<StorageObjectsPort>()
    const clock = new FakeClock("2026-11-06T10:00:00.000Z")
    const moduleRef = withStorage
        ? await Test.createTestingModule({
              providers: [
                  TeamChatFilesService,
                  { provide: IDS, useValue: fakeIds() },
                  { provide: CLOCK, useValue: clock },
                  { provide: TEAM_CHAT_STORAGE, useValue: storage },
              ],
          }).compile()
        : await Test.createTestingModule({
              providers: [
                  TeamChatFilesService,
                  { provide: IDS, useValue: fakeIds() },
                  { provide: CLOCK, useValue: clock },
              ],
          }).compile()
    return { service: moduleRef.get(TeamChatFilesService), storage }
}

describe("TeamChatFilesService requestUpload", () => {
    it("issues the signed address of a key made of the workspace, the room, a fresh id and the name", async () => {
        const { service, storage } = await build()
        storage.signedUpload.mockResolvedValue({
            kind: "ok",
            value: { path: KEY, token: "", signedUrl: "https://put" },
        })
        await expect(service.requestUpload(WS, ROOM, ASK)).resolves.toMatchObject({
            ok: true,
            value: {
                fileKey: KEY,
                uploadUrl: "https://put",
                method: "PUT",
                headers: [{ name: "Content-Type", value: "application/pdf" }],
            },
        })
        expect(storage.signedUpload).toHaveBeenCalledWith("media", KEY, "application/pdf")
    })

    it("refuses a type, a size, a missing store and a store that does not answer, as data", async () => {
        const { service, storage } = await build()
        await expect(
            service.requestUpload(WS, ROOM, { ...ASK, mimeType: "application/x-msdownload" }),
        ).resolves.toEqual({ ok: false, refusal: TeamChatErrorCode.FileTypeNotAllowed })
        await expect(service.requestUpload(WS, ROOM, { ...ASK, sizeBytes: 26 * 1024 * 1024 })).resolves.toEqual({
            ok: false,
            refusal: TeamChatErrorCode.FileTooLarge,
        })
        await expect(service.requestUpload(WS, ROOM, { ...ASK, sizeBytes: 1.5 })).resolves.toEqual({
            ok: false,
            refusal: TeamChatErrorCode.FileTooLarge,
        })
        storage.signedUpload.mockResolvedValue({ kind: "refused", code: "OBJECT_STORAGE_UNAVAILABLE" })
        await expect(service.requestUpload(WS, ROOM, ASK)).resolves.toEqual({
            ok: false,
            refusal: TeamChatErrorCode.StorageUnavailable,
        })
        const bare = await build(false)
        await expect(bare.service.requestUpload(WS, ROOM, ASK)).resolves.toEqual({
            ok: false,
            refusal: TeamChatErrorCode.StorageUnavailable,
        })
    })
})

describe("TeamChatFilesService verify", () => {
    it("keeps the files whose object is within the limit, with the name and type their key carries, and nothing for no key", async () => {
        const { service, storage } = await build()
        storage.sizeOf.mockResolvedValue({ kind: "ok", value: 1234 })
        await expect(service.verify(WS, ROOM, [KEY])).resolves.toEqual({
            ok: true,
            value: [{ fileKey: KEY, name: "plan.pdf", mimeType: "application/pdf", sizeBytes: 1234 }],
        })
        await expect(service.verify(WS, ROOM, [])).resolves.toEqual({ ok: true, value: [] })
    })

    it("refuses a key that is not of the room, a type that is not allowed, an unreadable object and a missing store", async () => {
        const { service, storage } = await build()
        await expect(service.verify(WS, ROOM, ["elsewhere/plan.pdf"])).resolves.toEqual({
            ok: false,
            refusal: TeamChatErrorCode.FileTypeNotAllowed,
        })
        await expect(service.verify(WS, ROOM, [`${WS}/team-chat/${ROOM}/${FILE_ID}/run.exe`])).resolves.toEqual({
            ok: false,
            refusal: TeamChatErrorCode.FileTypeNotAllowed,
        })
        storage.sizeOf.mockResolvedValue({ kind: "refused", code: "OBJECT_STORAGE_NOT_FOUND" })
        await expect(service.verify(WS, ROOM, [KEY])).resolves.toEqual({
            ok: false,
            refusal: TeamChatErrorCode.StorageUnavailable,
        })
        const bare = await build(false)
        await expect(bare.service.verify(WS, ROOM, [KEY])).resolves.toEqual({
            ok: false,
            refusal: TeamChatErrorCode.StorageUnavailable,
        })
    })

    it("removes an object over the limit and refuses", async () => {
        const { service, storage } = await build()
        storage.sizeOf.mockResolvedValue({ kind: "ok", value: 30 * 1024 * 1024 })
        storage.remove.mockResolvedValue({ kind: "ok", value: 1 })
        await expect(service.verify(WS, ROOM, [KEY])).resolves.toEqual({
            ok: false,
            refusal: TeamChatErrorCode.FileTooLarge,
        })
        expect(storage.remove).toHaveBeenCalledWith("media", [KEY])
    })
})

describe("TeamChatFilesService urlsOf", () => {
    it("signs the read addresses by key, and answers none for no key, a missing store or a store that refuses", async () => {
        const { service, storage } = await build()
        storage.signedUrls.mockResolvedValue({ kind: "ok", value: [{ path: KEY, signedUrl: "https://get" }] })
        await expect(service.urlsOf([KEY])).resolves.toEqual(new Map([[KEY, "https://get"]]))
        await expect(service.urlsOf([])).resolves.toEqual(new Map())
        storage.signedUrls.mockResolvedValue({ kind: "refused", code: "OBJECT_STORAGE_UNAVAILABLE" })
        await expect(service.urlsOf([KEY])).resolves.toEqual(new Map())
        const bare = await build(false)
        await expect(bare.service.urlsOf([KEY])).resolves.toEqual(new Map())
    })
})
