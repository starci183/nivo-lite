import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import type { HttpResponse } from "@modules/platform/http"
import type { DocumentReaders } from "./documents.contracts"
import { DOCUMENTS_OPTIONS } from "./documents.decorators"
import type { DocumentsOptions } from "./documents.options"
import { DocumentsHttpClient } from "./documents-http.client"
import { DocumentsErrorCode } from "./errors/documents.error"
import { PublicLinkClient } from "./public-link.client"

const optionsOf = builder<DocumentsOptions>({
    driveBase: "https://drive.test/v3",
    oauthBase: null,
    google: null,
    readers: mock<DocumentReaders>(),
})

const answer = (body: string | Uint8Array, headers: Record<string, string>, status = 200, url = ""): HttpResponse => ({
    status,
    headers,
    url,
    body: typeof body === "string" ? Buffer.from(body) : body,
})

const build = async (inputOptions: DocumentsOptions = optionsOf()) => {
    const options = builder<DocumentsOptions>(inputOptions)()
    const http = mock<DocumentsHttpClient>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            PublicLinkClient,
            { provide: DOCUMENTS_OPTIONS, useValue: options },
            { provide: DocumentsHttpClient, useValue: http },
        ],
    }).compile()
    return { client: moduleRef.get(PublicLinkClient), http }
}

const WEB = { kind: "web", fetchUrl: "https://shop.test/menu" } as const
const GOOGLE = { kind: "google", driveId: "1AbCdEfGhIjKlMnOp", fetchUrl: "https://docs.google.com/export" } as const

describe("PublicLinkClient", () => {
    it("reads a web page into text and a title", async () => {
        const { client, http } = await build()
        http.get.mockResolvedValue(
            answer("<title>Menu</title><p>Latte</p>", { "content-type": "text/html; charset=utf-8" }),
        )

        await expect(client.read(WEB)).resolves.toEqual({ text: "Menu Latte", title: "Menu" })

        expect(http.get).toHaveBeenCalledWith(
            "https://shop.test/menu",
            { "User-Agent": "NIVO-OS-Knowledge/1.0" },
            10_000,
        )
    })
})

describe("PublicLinkClient", () => {
    it("reads a text body by its content type", async () => {
        const { client, http } = await build()
        http.get.mockResolvedValue(
            answer("plain words", { "content-type": "text/plain" }, 200, "https://shop.test/menu"),
        )

        await expect(client.read(WEB)).resolves.toEqual({ text: "plain words", title: null })
    })
})

describe("PublicLinkClient", () => {
    it("reads a PDF through the reader of the options", async () => {
        const readers = mock<DocumentReaders>()
        readers.pdf.mockResolvedValue("pdf words")
        const { client, http } = await build(optionsOf({ readers }))
        http.get.mockResolvedValue(answer("%PDF-1.4 body", {}))

        await expect(client.read(WEB)).resolves.toEqual({ text: "pdf words", title: null })
    })
})

describe("PublicLinkClient", () => {
    it("cuts a long text at the limit", async () => {
        const { client, http } = await build()
        http.get.mockResolvedValue(answer("a".repeat(130_000), { "content-type": "text/plain" }))

        const read = await client.read(WEB)

        expect(read.text).toHaveLength(120_000)
    })
})

describe("PublicLinkClient", () => {
    it("refuses a private address before it fetches anything", async () => {
        const { client, http } = await build()

        await expect(client.read({ kind: "web", fetchUrl: "http://127.0.0.1/admin" })).rejects.toMatchObject({
            code: DocumentsErrorCode.HostPrivate,
        })

        expect(http.get).not.toHaveBeenCalled()
    })
})

describe("PublicLinkClient", () => {
    it.each([404, 401, 403])("takes status %s of a Google file for a file that is not public", async (status) => {
        const { client, http } = await build()
        http.get.mockResolvedValue(answer("", {}, status))

        await expect(client.read(GOOGLE)).rejects.toMatchObject({ code: DocumentsErrorCode.NotPublic })
    })
})

describe("PublicLinkClient", () => {
    it("takes a redirect to the Google sign-in for a file that is not public", async () => {
        const { client, http } = await build()
        http.get.mockResolvedValue(
            answer("<html>", { "content-type": "text/html" }, 200, "https://accounts.google.com/x"),
        )

        await expect(client.read(GOOGLE)).rejects.toMatchObject({ code: DocumentsErrorCode.NotPublic })
    })
})

describe("PublicLinkClient", () => {
    it("takes a page answered for a Google export for the sign-in wall", async () => {
        const { client, http } = await build()
        http.get.mockResolvedValue(answer("<html>wall</html>", { "content-type": "text/html" }))

        await expect(client.read(GOOGLE)).rejects.toMatchObject({ code: DocumentsErrorCode.NotPublic })
    })
})

describe("PublicLinkClient", () => {
    it("reads the CSV export of a Google file", async () => {
        const { client, http } = await build()
        http.get.mockResolvedValue(answer("a,b", { "content-type": "text/csv" }))

        await expect(client.read(GOOGLE)).resolves.toEqual({ text: "a,b", title: null })
    })
})

describe("PublicLinkClient", () => {
    it.each([
        [404, DocumentsErrorCode.Refused],
        [410, DocumentsErrorCode.Refused],
        [503, DocumentsErrorCode.Unavailable],
    ])("reports status %s of a plain page", async (status, code) => {
        const { client, http } = await build()
        http.get.mockResolvedValue(answer("", {}, status))

        await expect(client.read(WEB)).rejects.toMatchObject({ code, params: { status } })
    })
})

describe("PublicLinkClient", () => {
    it("refuses a body over the limit", async () => {
        const { client, http } = await build()
        http.get.mockResolvedValue(answer(new Uint8Array(12_000_001), { "content-type": "text/plain" }))

        await expect(client.read(WEB)).rejects.toMatchObject({ code: DocumentsErrorCode.TooLarge })
    })
})

describe("PublicLinkClient", () => {
    it.each([
        ["image/png; x=1", "image/png"],
        [undefined, "unknown"],
    ])("refuses a type it cannot read (%s)", async (type, named) => {
        const { client, http } = await build()
        http.get.mockResolvedValue(answer("bytes", type === undefined ? {} : { "content-type": type }))

        await expect(client.read(WEB)).rejects.toMatchObject({
            code: DocumentsErrorCode.TypeUnsupported,
            params: { type: named },
        })
    })
})
