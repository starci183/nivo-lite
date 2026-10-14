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
    const admin = mock<SupabaseAdminClient>({ storage })
    const moduleRef = await Test.createTestingModule({
        providers: [
            SupabaseObjectsService,
            { provide: SUPABASE_ADMIN_CLIENT, useValue: admin },
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

    describe("list", () => {
        it("omits folder markers and preserves the names and available creation dates", async () => {
            const { service, bucket, storage } = await build()
            bucket.list.mockResolvedValue({
                data: [
                    {
                        id: null,
                        name: "folder",
                        created_at: null,
                        updated_at: null,
                        last_accessed_at: null,
                        metadata: null,
                    },
                    {
                        id: "new",
                        name: "new.pdf",
                        created_at: "2026-10-14T10:00:00Z",
                        updated_at: null,
                        last_accessed_at: null,
                        metadata: null,
                    },
                    {
                        id: "old",
                        name: "old.pdf",
                        created_at: null,
                        updated_at: null,
                        last_accessed_at: null,
                        metadata: null,
                    },
                ],
                error: null,
            })

            await expect(service.list("documents", "workspace/1", 12)).resolves.toEqual({
                kind: "ok",
                value: [
                    { name: "new.pdf", createdAt: "2026-10-14T10:00:00Z" },
                    { name: "old.pdf", createdAt: null },
                ],
            })
            expect(storage.from).toHaveBeenCalledWith("documents")
            expect(bucket.list).toHaveBeenCalledWith("workspace/1", {
                limit: 12,
                sortBy: { column: "created_at", order: "desc" },
            })
        })

        it("logs a failed list request and reports an unavailable provider", async () => {
            const { service, bucket, logger } = await build()
            const answer = failure("list unavailable")
            bucket.list.mockResolvedValue(answer)

            await expect(service.list("documents", "workspace/1", 12)).resolves.toEqual({
                kind: "refused",
                code: SupabaseErrorCode.ProviderUnavailable,
            })
            expect(logger.error).toHaveBeenCalledWith(SupabaseLogEvent.StorageFailed, answer.error, {
                bucket: "documents",
            })
        })
    })

    describe("signedUrls", () => {
        it("answers an empty list without contacting Storage when no paths were requested", async () => {
            const { service, bucket, storage } = await build()

            await expect(service.signedUrls("documents", [], 60)).resolves.toEqual({ kind: "ok", value: [] })
            expect(storage.from).not.toHaveBeenCalled()
            expect(bucket.createSignedUrls).not.toHaveBeenCalled()
        })

        it("keeps only signed addresses with a path and a nonempty string URL", async () => {
            const { service, bucket, storage } = await build()
            bucket.createSignedUrls.mockResolvedValue({
                data: [
                    { path: "one.pdf", signedUrl: "https://s.test/one", signedURL: "/one", error: null },
                    { path: null, signedUrl: "https://s.test/no-path", signedURL: "/no-path", error: "missing path" },
                    { path: "missing.pdf", signedUrl: null, signedURL: null, error: "not found" },
                    { path: "empty.pdf", signedUrl: "", signedURL: "", error: null },
                ],
                error: null,
            })

            await expect(service.signedUrls("documents", ["one.pdf", "missing.pdf"], 60)).resolves.toEqual({
                kind: "ok",
                value: [{ path: "one.pdf", signedUrl: "https://s.test/one" }],
            })
            expect(storage.from).toHaveBeenCalledWith("documents")
            expect(bucket.createSignedUrls).toHaveBeenCalledWith(["one.pdf", "missing.pdf"], 60)
        })

        it("logs a failed signing request and reports an unavailable provider", async () => {
            const { service, bucket, logger } = await build()
            const answer = failure("signing unavailable")
            bucket.createSignedUrls.mockResolvedValue(answer)

            await expect(service.signedUrls("documents", ["one.pdf"], 60)).resolves.toEqual({
                kind: "refused",
                code: SupabaseErrorCode.ProviderUnavailable,
            })
            expect(logger.error).toHaveBeenCalledWith(SupabaseLogEvent.StorageFailed, answer.error, {
                bucket: "documents",
            })
        })
    })

    describe("remove", () => {
        it("answers zero without contacting Storage when no paths were requested", async () => {
            const { service, bucket, storage } = await build()

            await expect(service.remove("documents", [])).resolves.toEqual({ kind: "ok", value: 0 })
            expect(storage.from).not.toHaveBeenCalled()
            expect(bucket.remove).not.toHaveBeenCalled()
        })

        it("answers the number Storage actually removed and sends the requested paths", async () => {
            const { service, bucket, storage } = await build()
            bucket.remove.mockResolvedValue({
                data: [
                    {
                        id: "one",
                        name: "one.pdf",
                        created_at: null,
                        updated_at: null,
                        last_accessed_at: null,
                        metadata: null,
                    },
                ],
                error: null,
            })

            await expect(service.remove("documents", ["one.pdf", "missing.pdf"])).resolves.toEqual({
                kind: "ok",
                value: 1,
            })
            expect(storage.from).toHaveBeenCalledWith("documents")
            expect(bucket.remove).toHaveBeenCalledWith(["one.pdf", "missing.pdf"])
        })

        it("logs a failed removal and reports an unavailable provider", async () => {
            const { service, bucket, logger } = await build()
            const answer = failure("removal unavailable")
            bucket.remove.mockResolvedValue(answer)

            await expect(service.remove("documents", ["one.pdf"])).resolves.toEqual({
                kind: "refused",
                code: SupabaseErrorCode.ProviderUnavailable,
            })
            expect(logger.error).toHaveBeenCalledWith(SupabaseLogEvent.StorageFailed, answer.error, {
                bucket: "documents",
            })
        })
    })
})
