import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { HTTP_CLIENT } from "@modules/platform/http"
import type { HttpClient, HttpResponse } from "@modules/platform/http"
import { RemoteFilesError, RemoteFilesErrorCode } from "./errors/remote-files.error"
import { RemoteFilesClient } from "./remote-files.client"
import type { RemoteFileRequest } from "./remote-files.contracts"

const request = (overrides: Partial<RemoteFileRequest> = {}): RemoteFileRequest => ({
    url: "https://files.test/a",
    maxBytes: 10,
    timeoutMs: 1000,
    accepts: (type) => type.startsWith("image/"),
    ...overrides,
})

const answer = (body: Buffer, type: string | undefined, status = 200): HttpResponse => ({
    status,
    headers: type === undefined ? {} : { "content-type": type },
    body,
})

const build = async () => {
    const http = mock<HttpClient>()
    const moduleRef = await Test.createTestingModule({
        providers: [RemoteFilesClient, { provide: HTTP_CLIENT, useValue: http }],
    }).compile()
    return { client: moduleRef.get(RemoteFilesClient), http }
}

describe("RemoteFilesClient", () => {
    it("asks the address once for bytes, within the deadline, and keeps an accepted file", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue(answer(Buffer.from([1, 2, 3]), "image/png"))

        await expect(client.read(request({ headers: { accept: "image/*" } }))).resolves.toEqual({
            status: 200,
            contentType: "image/png",
            location: undefined,
            length: 3,
            bytes: Buffer.from([1, 2, 3]),
        })
        expect(http.request).toHaveBeenCalledWith({
            method: "GET",
            url: "https://files.test/a",
            read: "bytes",
            timeoutMs: 1000,
            headers: { accept: "image/*" },
        })
    })

    it("hands the pin and the redirect mode to the HTTP port and reports a redirect with its location", async () => {
        const { client, http } = await build()
        const pin = { address: "203.0.113.5", family: 4 as const }
        http.request.mockResolvedValue({
            status: 302,
            headers: { location: "https://files.test/b" },
            body: Buffer.alloc(0),
        })

        await expect(client.read(request({ pin, redirect: "manual" }))).resolves.toMatchObject({
            status: 302,
            location: "https://files.test/b",
            bytes: null,
        })
        expect(http.request).toHaveBeenCalledWith(expect.objectContaining({ pin, redirect: "manual" }))
    })

    it.each([
        ["a refused status", answer(Buffer.from([1]), "image/png", 404)],
        ["a type the caller does not accept", answer(Buffer.from([1]), "text/html")],
        ["no declared type", answer(Buffer.from([1]), undefined)],
        ["an empty body", answer(Buffer.alloc(0), "image/png")],
        ["a body over the limit", answer(Buffer.alloc(11), "image/png")],
        ["a body that is not bytes", { status: 200, headers: { "content-type": "image/png" }, body: "text" }],
    ])("keeps the file out for %s but still describes the answer", async (_name, response) => {
        const { client, http } = await build()
        http.request.mockResolvedValue(response)

        await expect(client.read(request())).resolves.toMatchObject({ status: response.status, bytes: null })
    })

    it("fails with a typed error when the address cannot be asked", async () => {
        const { client, http } = await build()
        const cause = new Error("timeout")
        http.request.mockRejectedValue(cause)

        const failure: unknown = await client.read(request()).catch((error: unknown) => error)

        expect(failure).toBeInstanceOf(RemoteFilesError)
        expect(failure).toMatchObject({ code: RemoteFilesErrorCode.RequestFailed })
    })
})
