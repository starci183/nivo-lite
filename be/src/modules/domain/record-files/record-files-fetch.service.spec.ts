import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { defineEntity, field } from "@nivo-lite/agent-sdk/entity"
import { REMOTE_FILES, type RemoteFileAnswer, type RemoteFiles } from "@modules/integrations/remote-files"
import { RecordFilesErrorCode } from "./errors/record-files.error"
import { RecordFileFetchService } from "./record-files-fetch.service"

/** The hosts of this spec are IP literals: no name is resolved, so no network is touched. */
const FIRST = "https://93.184.216.34/a.png"
const SECOND = "https://93.184.216.35/b.png"
const THIRD = "https://93.184.216.36/c.png"

const PROJECT = defineEntity({
    name: "fixture.fetch",
    dataKind: "fixture-fetch",
    fields: { cover: field.file({ accept: ["image/png"], maxBytes: 8 }) },
})

const BYTES = Buffer.from([1, 2, 3])

const png = (): RemoteFileAnswer => ({ status: 200, contentType: "image/png; charset=x", location: undefined, length: 3, bytes: BYTES })
const redirectTo = (location: string): RemoteFileAnswer => ({ status: 302, contentType: "", location, length: 0, bytes: null })

const build = async (maxRedirects: number) => {
    const remote = mock<RemoteFiles>({ maxRedirects })
    const moduleRef = await Test.createTestingModule({
        providers: [RecordFileFetchService, { provide: REMOTE_FILES, useValue: remote }],
    }).compile()
    return { remote, service: moduleRef.get(RecordFileFetchService) }
}

describe("RecordFileFetchService: follows redirects one hop after the other, up to the integration's limit", () => {
    it("reads the answer of the first address when it is a file", async () => {
        const { remote, service } = await build(2)
        remote.read.mockResolvedValueOnce(png())

        await expect(service.fetch(FIRST, PROJECT.fields.cover)).resolves.toEqual({ bytes: BYTES, mime: "image/png" })
        expect(remote.read).toHaveBeenCalledTimes(1)
    })

    it("follows a redirect to the next address and reads the file there, the hops in order", async () => {
        const { remote, service } = await build(2)
        remote.read.mockResolvedValueOnce(redirectTo(SECOND)).mockResolvedValueOnce(redirectTo(THIRD)).mockResolvedValueOnce(png())

        await expect(service.fetch(FIRST, PROJECT.fields.cover)).resolves.toEqual({ bytes: BYTES, mime: "image/png" })
        expect(remote.read.mock.calls.map(([request]) => request.url)).toEqual([FIRST, SECOND, THIRD])
    })

    it("refuses with UrlUnreachable once the redirects pass the limit, and reads no further address", async () => {
        const { remote, service } = await build(1)
        remote.read.mockResolvedValueOnce(redirectTo(SECOND)).mockResolvedValueOnce(redirectTo(THIRD)).mockResolvedValueOnce(png())

        await expect(service.fetch(FIRST, PROJECT.fields.cover)).rejects.toMatchObject({ code: RecordFilesErrorCode.UrlUnreachable })
        expect(remote.read).toHaveBeenCalledTimes(2)
    })

    it("refuses with UrlInvalid a redirect to a plain http address, before it is read", async () => {
        const { remote, service } = await build(2)
        remote.read.mockResolvedValueOnce(redirectTo("http://93.184.216.35/b.png"))

        await expect(service.fetch(FIRST, PROJECT.fields.cover)).rejects.toMatchObject({ code: RecordFilesErrorCode.UrlInvalid })
        expect(remote.read).toHaveBeenCalledTimes(1)
    })
})
