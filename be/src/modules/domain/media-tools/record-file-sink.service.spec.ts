import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ProviderRegistryError, ProviderRegistryErrorCode } from "@modules/domain/provider-registry"
import type { ProviderFile } from "@modules/domain/provider-registry"
import { RecordFilesService } from "@modules/domain/record-files"
import { RecordFilesError, RecordFilesErrorCode } from "@modules/domain/record-files/errors/record-files.error"
import { ToolsError, ToolsErrorCode } from "@modules/domain/tools"
import { RecordFileSinkService } from "./record-file-sink.service"

/** A provider's file whose bytes are read once from the provider. */
const fileOf = (mimeType: string | null, bytes = Buffer.from("clip")) => {
    const fetch = jest.fn(() => Promise.resolve(bytes))
    const file: ProviderFile = { provider: "elevenlabs", handle: "h-1", mimeType, expiresAt: null, fetch }
    return { file, fetch }
}

const build = async () => {
    const files = mock<RecordFilesService>()
    const moduleRef = await Test.createTestingModule({
        providers: [RecordFileSinkService, { provide: RecordFilesService, useValue: files }],
    }).compile()
    return { sink: moduleRef.get(RecordFileSinkService), files }
}

describe("RecordFileSinkService: a provider's file kept by the records' file store", () => {
    it("stages the provider's bytes in the workspace with their type and answers the staged key", async () => {
        const { sink, files } = await build()
        files.stage.mockResolvedValue("ws-1/staged/obj-1")
        const { file, fetch } = fileOf("audio/mpeg")

        await expect(sink.store("ws-1", file)).resolves.toBe("ws-1/staged/obj-1")

        expect(fetch).toHaveBeenCalledTimes(1)
        expect(files.stage).toHaveBeenCalledWith("ws-1", new Uint8Array(Buffer.from("clip")), "audio/mpeg")
    })

    it("answers the store's refusal (a type it keeps no file of, a size off its bounds, a store down) as the infrastructure refusal", async () => {
        for (const code of [RecordFilesErrorCode.MimeNotAccepted, RecordFilesErrorCode.SizeInvalid, RecordFilesErrorCode.StoreUnavailable]) {
            const { sink, files } = await build()
            files.stage.mockRejectedValue(new RecordFilesError({ code }))

            const refused = await sink.store("ws-1", fileOf("video/mp4").file).catch((cause: unknown) => cause)

            expect(refused).toBeInstanceOf(ToolsError)
            expect(refused).toMatchObject({
                code: ToolsErrorCode.NativeRefused,
                params: { reason: "file_store_unavailable", refusalClass: "infrastructure" },
            })
        }
    })

    it("stages a file of no declared type as no type: the store refuses it, nothing is guessed", async () => {
        const { sink, files } = await build()
        files.stage.mockRejectedValue(new RecordFilesError({ code: RecordFilesErrorCode.MimeNotAccepted }))

        await expect(sink.store("ws-1", fileOf(null).file)).rejects.toMatchObject({ params: { reason: "file_store_unavailable" } })
        expect(files.stage).toHaveBeenCalledWith("ws-1", expect.any(Uint8Array), "")
    })

    it("lets a failure to read the provider's bytes pass as the provider's own (no store was asked)", async () => {
        const { sink, files } = await build()
        const gone = new ProviderRegistryError({ code: ProviderRegistryErrorCode.CallNotSent })
        const file: ProviderFile = { ...fileOf("audio/mpeg").file, fetch: () => Promise.reject(gone) }

        await expect(sink.store("ws-1", file)).rejects.toBe(gone)
        expect(files.stage).not.toHaveBeenCalled()
    })
})
