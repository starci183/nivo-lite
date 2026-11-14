import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { OBJECT_STORAGE, OBJECT_STORAGE_ERROR_CODES, ObjectStorageError } from "@starci/object-storage"
import type { ObjectStorage } from "@starci/object-storage"
import { createMemoryObjectStorage } from "@starci/object-storage/testing"
import type { MemoryObjectStorage } from "@starci/object-storage/testing"
import { Secret } from "@modules/platform/config"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { STORAGE_OPTIONS } from "./object-storage.decorators"
import { StorageFilesService } from "./object-storage-files.service"
import {
    FILE_LINK_MAX_SECONDS,
    FILE_LINK_SECONDS,
    isRecordFileKeyOf,
    isStagedKeyOf,
    linkSecondsOf,
    recordFileFolderOf,
    recordFileKeyOf,
    stagedKeyOf,
} from "./object-storage-files.policy"
import type { RecordFileSpot } from "./object-storage-files.policy"
import type { ObjectStorageOptions } from "./object-storage.options"
import { TestWorldError, TestWorldErrorCode } from "@tests/world/test-world.error"

const options: ObjectStorageOptions = {
    endpoint: "https://academy-minio.test:9000",
    region: "us-east-1",
    accessKey: new Secret("a"),
    secretKey: new Secret("b"),
    bucketPrefix: "nivo",
    publicUrl: "https://minio.example.org",
    timeoutMs: 1000,
}

const WS = "11111111-1111-4111-8111-111111111111"
const RECORD = "0b9f1c2e-6d1a-4f0e-9a37-000000000001"
const OBJECT = "5c1d3e2a-0f4b-4c6d-8e9f-0a1b2c3d4e5f"
const SPOT: RecordFileSpot = { workspaceId: WS, type: "fixture.project", recordId: RECORD, field: "cover" }

const build = async (storage: ObjectStorage) => {
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            StorageFilesService,
            { provide: OBJECT_STORAGE, useValue: storage },
            { provide: STORAGE_OPTIONS, useValue: options },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { logger, service: moduleRef.get(StorageFilesService) }
}

describe("the key law of record files", () => {
    it("files an object under its workspace, record type, record and field", () => {
        expect(recordFileFolderOf(SPOT)).toBe(`${WS}/fixture.project/${RECORD}/cover/`)
        expect(recordFileKeyOf(SPOT, OBJECT)).toBe(`${WS}/fixture.project/${RECORD}/cover/${OBJECT}`)
        expect(isRecordFileKeyOf(SPOT, recordFileKeyOf(SPOT, OBJECT))).toBe(true)
    })

    it("refuses a key of another workspace, record, field or depth", () => {
        const key = recordFileKeyOf(SPOT, OBJECT)
        expect(isRecordFileKeyOf({ ...SPOT, workspaceId: "22222222-2222-4222-8222-222222222222" }, key)).toBe(false)
        expect(isRecordFileKeyOf({ ...SPOT, recordId: "0b9f1c2e-6d1a-4f0e-9a37-000000000002" }, key)).toBe(false)
        expect(isRecordFileKeyOf({ ...SPOT, field: "voice" }, key)).toBe(false)
        expect(isRecordFileKeyOf(SPOT, `${key}/more`)).toBe(false)
        expect(isRecordFileKeyOf(SPOT, `${recordFileFolderOf(SPOT)}../x`)).toBe(false)
    })

    it("stages a tool's object under its workspace only", () => {
        expect(stagedKeyOf(WS, OBJECT)).toBe(`${WS}/staged/${OBJECT}`)
        expect(isStagedKeyOf(WS, stagedKeyOf(WS, OBJECT))).toBe(true)
        expect(isStagedKeyOf("22222222-2222-4222-8222-222222222222", stagedKeyOf(WS, OBJECT))).toBe(false)
    })

    it("keeps a link short by default and bounds an asked one to seven days", () => {
        expect(FILE_LINK_SECONDS).toBe(3600)
        expect(FILE_LINK_MAX_SECONDS).toBe(604_800)
        expect(linkSecondsOf(undefined)).toBe(FILE_LINK_SECONDS)
        expect(linkSecondsOf(604_800)).toBe(604_800)
        expect(linkSecondsOf(10 * FILE_LINK_MAX_SECONDS)).toBe(FILE_LINK_MAX_SECONDS)
        expect(linkSecondsOf(0)).toBe(1)
    })
})

describe("StorageFilesService over the in-memory store", () => {
    let memory: MemoryObjectStorage

    beforeEach(() => {
        memory = createMemoryObjectStorage()
    })

    it("signs an upload of the exact type and size into the records bucket, and the store holds only that", async () => {
        const { service } = await build(memory)
        const key = recordFileKeyOf(SPOT, OBJECT)

        const signed = await service.signedUpload(key, "image/png", 4)
        if (signed.kind !== "ok") throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { what: "not signed" } })

        expect(signed.value.key).toBe(key)
        expect(await memory.upload(signed.value.url, new Uint8Array([1, 2, 3, 4, 5]), "image/png")).toBe(403)
        expect(await memory.upload(signed.value.url, new Uint8Array([1, 2, 3, 4]), "image/jpeg")).toBe(403)
        expect(await memory.upload(signed.value.url, new Uint8Array([1, 2, 3, 4]), "image/png")).toBe(200)
        expect(memory.store.buckets.get("nivo-records")?.has(key)).toBe(true)
        expect(await service.head(key)).toEqual({ kind: "ok", value: { size: 4, mime: "image/png" } })
    })

    it("answers NOT_FOUND for an object that is not there", async () => {
        const { service } = await build(memory)

        expect(await service.head(recordFileKeyOf(SPOT, OBJECT))).toEqual({
            kind: "refused",
            code: OBJECT_STORAGE_ERROR_CODES.ObjectNotFound,
        })
        expect((await service.read(recordFileKeyOf(SPOT, OBJECT))).kind).toBe("refused")
    })

    it("writes, reads, links and removes an object", async () => {
        const { service } = await build(memory)
        const key = stagedKeyOf(WS, OBJECT)

        expect(await service.write(key, new Uint8Array([7, 8]), "audio/mpeg")).toEqual({ kind: "ok", value: null })
        const read = await service.read(key)
        expect(read.kind === "ok" ? [...read.value.bytes] : null).toEqual([7, 8])
        const link = await service.signedLink(key, 60, "voice.mp3")
        expect(link.kind === "ok" ? link.value.url : "").toContain("nivo-records")
        expect(await service.remove(key)).toEqual({ kind: "ok", value: null })
        expect((await service.head(key)).kind).toBe("refused")
    })

    it("logs and answers UNAVAILABLE when the store is down", async () => {
        const { service, logger } = await build(memory)
        memory.store.down = true

        expect(await service.head(stagedKeyOf(WS, OBJECT))).toEqual({
            kind: "refused",
            code: OBJECT_STORAGE_ERROR_CODES.Unavailable,
        })
        expect(logger.error).toHaveBeenCalled()
    })

    it("answers NOT_FOUND for a key the store refuses", async () => {
        const storage = mock<ObjectStorage>()
        storage.presignPut.mockRejectedValue(new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.KeyInvalid))
        const { service } = await build(storage)

        expect(await service.signedUpload("bad key", "image/png", 1)).toEqual({
            kind: "refused",
            code: OBJECT_STORAGE_ERROR_CODES.ObjectNotFound,
        })
    })
})
