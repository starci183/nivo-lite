import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { HTTP_CLIENT } from "@modules/platform/http/http.decorators"
import type { HttpClient, HttpResponse } from "@modules/platform/http"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DocumentsLogEvent } from "./documents.log-events"
import { DocumentsHttpClient } from "./documents-http.client"
import { DocumentsErrorCode } from "./errors/documents.error"

const ANSWER: HttpResponse = { status: 200, headers: {}, url: "https://x.test/", body: Buffer.from("ok") }

const build = async () => {
    const http = mock<HttpClient>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            DocumentsHttpClient,
            { provide: HTTP_CLIENT, useValue: http },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { client: moduleRef.get(DocumentsHttpClient), http, logger }
}

describe("DocumentsHttpClient", () => {
    describe("get", () => {
        it("reads the address as bytes with the given headers and deadline", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValue(ANSWER)

            await expect(client.get("https://x.test/", { "User-Agent": "test" }, 1000)).resolves.toBe(ANSWER)

            expect(http.request).toHaveBeenCalledWith({
                method: "GET",
                url: "https://x.test/",
                headers: { "User-Agent": "test" },
                read: "bytes",
                timeoutMs: 1000,
            })
        })

        it("reports a network failure as unavailable with status 0 and keeps the cause", async () => {
            const { client, http } = await build()
            const failure = new Error("offline")
            http.request.mockRejectedValue(failure)

            await expect(client.get("https://x.test/", {}, 1000)).rejects.toMatchObject({
                code: DocumentsErrorCode.Unavailable,
                params: { status: 0 },
                cause: failure,
            })
        })
    })

    describe("postForm", () => {
        it("posts the fields and answers the response", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValue(ANSWER)

            await expect(client.postForm("https://x.test/token", { a: "1" }, 2000)).resolves.toBe(ANSWER)

            expect(http.request).toHaveBeenCalledWith({
                method: "POST",
                url: "https://x.test/token",
                form: { a: "1" },
                read: "bytes",
                timeoutMs: 2000,
            })
        })

        it("reports a network failure as unavailable with status 0", async () => {
            const { client, http } = await build()
            http.request.mockRejectedValue(new Error("offline"))

            await expect(client.postForm("https://x.test/token", {}, 2000)).rejects.toMatchObject({
                code: DocumentsErrorCode.Unavailable,
                params: { status: 0 },
            })
        })
    })

    describe("jsonBody", () => {
        it("parses the JSON in the body", async () => {
            const { client } = await build()

            expect(client.jsonBody({ ...ANSWER, body: Buffer.from('{"a":1}') })).toEqual({ a: 1 })
        })

        it("answers undefined and logs the cause when the body is not JSON", async () => {
            const { client, logger } = await build()

            expect(client.jsonBody({ ...ANSWER, status: 502, body: Buffer.from("<html>") })).toBeUndefined()

            expect(logger.error).toHaveBeenCalledWith(DocumentsLogEvent.BodyUnreadable, expect.any(SyntaxError), {
                status: 502,
            })
        })
    })
})
