import { StorageError } from "@supabase/storage-js"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SupabaseErrorCode } from "./errors/supabase.error"
import type { SupabaseAdminClient } from "./supabase.client"
import { SUPABASE_ADMIN_CLIENT } from "./supabase.decorators"
import { SupabaseLogEvent } from "./supabase.log-events"
import { SupabaseObjectsService } from "./supabase-objects.service"

type Bucket = ReturnType<SupabaseAdminClient["storage"]["from"]>

const build = async () => {
    const bucket = mock<Bucket>()
    const storage = mock<SupabaseAdminClient["storage"]>()
    storage.from.mockReturnValue(bucket)
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            SupabaseObjectsService,
            { provide: SUPABASE_ADMIN_CLIENT, useValue: mock<SupabaseAdminClient>({ storage }) },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(SupabaseObjectsService), bucket, storage, logger }
}

const failure = (message: string, extra: object = {}) => ({
    data: null,
    error: Object.assign(new StorageError(message), extra),
})

describe("SupabaseObjectsService", () => {
    describe("signedUpload", () => {
        it("answers the path, token and address Storage signed", async () => {
            const { service, bucket, storage } = await build()
            bucket.createSignedUploadUrl.mockResolvedValue({
                data: { path: "ws/1/a.pdf", token: "t", signedUrl: "https://s.test/u" },
                error: null,
            })

            await expect(service.signedUpload("knowledge-uploads", "ws/1/a.pdf")).resolves.toEqual({
                kind: "ok",
                value: { path: "ws/1/a.pdf", token: "t", signedUrl: "https://s.test/u" },
            })

            expect(storage.from).toHaveBeenCalledWith("knowledge-uploads")
        })

        it("reports an unavailable provider and logs the cause", async () => {
            const { service, bucket, logger } = await build()
            const refused = failure("down")
            bucket.createSignedUploadUrl.mockResolvedValue(refused)

            await expect(service.signedUpload("b", "p")).resolves.toMatchObject({
                kind: "refused",
                code: SupabaseErrorCode.ProviderUnavailable,
            })

            expect(logger.error).toHaveBeenCalledWith(SupabaseLogEvent.StorageFailed, refused.error, { bucket: "b" })
        })
    })

    describe("download", () => {
        it("answers the bytes and the content type", async () => {
            const { service, bucket } = await build()
            bucket.download.mockResolvedValue({ data: new Blob(["abc"], { type: "text/plain" }), error: null })

            const result = await service.download("b", "p")

            expect(result).toMatchObject({ kind: "ok", value: { contentType: "text/plain" } })
            expect(result.kind === "ok" ? Buffer.from(result.value.bytes).toString() : "").toBe("abc")
        })

        it.each([
            ["a status code of 404", failure("x", { statusCode: "404" })],
            ["a status of 400", failure("x", { status: 400 })],
            ["a message that says not found", failure("Object not found")],
        ])("reports a missing object for %s", async (_name, answer) => {
            const { service, bucket } = await build()
            bucket.download.mockResolvedValue(answer)

            await expect(service.download("b", "p")).resolves.toMatchObject({
                kind: "refused",
                code: SupabaseErrorCode.ObjectNotFound,
            })
        })

        it("reports an unavailable provider for any other failure and logs it", async () => {
            const { service, bucket, logger } = await build()
            bucket.download.mockResolvedValue(failure("boom", { status: 500 }))

            await expect(service.download("b", "p")).resolves.toMatchObject({
                kind: "refused",
                code: SupabaseErrorCode.ProviderUnavailable,
            })

            expect(logger.error).toHaveBeenCalledWith(SupabaseLogEvent.StorageFailed, expect.any(Error), {
                bucket: "b",
            })
        })
    })
})
