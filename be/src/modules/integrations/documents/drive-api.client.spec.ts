import type { Logger } from "@modules/platform/logging"
import { DocumentsLogEvent } from "./documents.log-events"
import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { Secret } from "@modules/platform/config"
import type { HttpClient, HttpResponse } from "@modules/platform/http"
import { RENEWAL_GRANT_FIELD } from "./documents.contracts"
import type { DocumentReaders } from "./documents.contracts"
import { DOCUMENTS_OPTIONS } from "./documents.decorators"
import type { DocumentsOptions } from "./documents.options"
import { DocumentsHttpClient } from "./documents-http.client"
import { DriveApiClient } from "./drive-api.client"
import { DocumentsErrorCode } from "./errors/documents.error"

const optionsOf = builder<DocumentsOptions>({
    driveBase: "https://drive.test/v3",
    oauthBase: null,
    google: { clientId: "client-1", clientSecret: new Secret("secret-1") },
    readers: mock<DocumentReaders>(),
})

const json = (value: unknown, status = 200): HttpResponse => ({
    status,
    headers: {},
    url: "",
    body: Buffer.from(JSON.stringify(value)),
})

const bytes = (body: string | Uint8Array, headers: Record<string, string> = {}, status = 200): HttpResponse => ({
    status,
    headers,
    url: "",
    body: typeof body === "string" ? Buffer.from(body) : body,
})

type Route = readonly [match: string, response: HttpResponse]

const build = async (inputOptions: DocumentsOptions = optionsOf()) => {
    const options = builder<DocumentsOptions>(inputOptions)()
    const http = mock<HttpClient>()
    const logger: Logger = mock<Logger>()
    const transport = mock<DocumentsHttpClient>({
        get: jest.fn((url: string, headers: Readonly<Record<string, string>>, timeoutMs: number) =>
            http.request({ method: "GET", url, headers, read: "bytes", timeoutMs }),
        ),
        postForm: jest.fn((url: string, form: Readonly<Record<string, string>>, timeoutMs: number) =>
            http.request({ method: "POST", url, form, read: "bytes", timeoutMs }),
        ),
        jsonBody: jest.fn((response: HttpResponse): unknown => {
            try {
                return JSON.parse(
                    new TextDecoder().decode(response.body instanceof Uint8Array ? response.body : new Uint8Array()),
                )
            } catch (cause) {
                logger.error(DocumentsLogEvent.BodyUnreadable, cause, { status: response.status })
                return undefined
            }
        }),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            DriveApiClient,
            { provide: DOCUMENTS_OPTIONS, useValue: options },
            { provide: DocumentsHttpClient, useValue: transport },
        ],
    }).compile()
    const route = (table: ReadonlyArray<Route>): void => {
        http.request.mockImplementation((request) => {
            const hit = table.find(([match]) => request.url.includes(match))
            return hit === undefined ? Promise.reject(new Error(`unrouted ${request.url}`)) : Promise.resolve(hit[1])
        })
    }
    return { client: moduleRef.get(DriveApiClient), http, route }
}

const FILE_ID = "1AbCdEfGhIjKlMnOp"
const META = `/files/${FILE_ID}?fields`

describe("DriveApiClient", () => {
    describe("readFile", () => {
        it("exports a Google Doc as text and drops the byte order mark", async () => {
            const { client, http, route } = await build()
            route([
                [META, json({ name: "Menu", mimeType: "application/vnd.google-apps.document" })],
                ["/export?mimeType=text%2Fplain", bytes("\ufeffHello")],
            ])

            await expect(client.readFile("token-1", FILE_ID)).resolves.toEqual({ name: "Menu", text: "Hello" })

            expect(http.request).toHaveBeenCalledWith(
                expect.objectContaining({ headers: { Authorization: "Bearer token-1" }, timeoutMs: 30_000 }),
            )
        })
    })
})

describe("DriveApiClient", () => {
    describe("readFile", () => {
        it("downloads an uploaded PDF and reads it with the reader", async () => {
            const readers = mock<DocumentReaders>()
            readers.pdf.mockResolvedValue("pdf words")
            const { client, route } = await build(optionsOf({ readers }))
            route([
                [META, json({ name: "menu.pdf", mimeType: "application/pdf", size: "1000" })],
                ["alt=media", bytes("%PDF-1.4 body")],
            ])

            await expect(client.readFile("token-1", FILE_ID)).resolves.toEqual({ name: "menu.pdf", text: "pdf words" })
        })
    })
})

describe("DriveApiClient", () => {
    describe("readFile", () => {
        it("sniffs the kind of a download from its content type when the name has no extension", async () => {
            const { client, route } = await build()
            route([
                [META, json({ name: "notes", mimeType: "text/plain" })],
                ["alt=media", bytes("plain", { "content-type": "text/plain" })],
            ])

            await expect(client.readFile("token-1", FILE_ID)).resolves.toEqual({ name: "notes", text: "plain" })
        })
    })
})

describe("DriveApiClient", () => {
    describe("readFile", () => {
        it("uses the id as the name when Drive gives none and cuts a long text", async () => {
            const { client, route } = await build()
            route([
                [META, json({ mimeType: "application/vnd.google-apps.spreadsheet" })],
                ["text%2Fcsv", bytes("a".repeat(130_000))],
            ])

            const read = await client.readFile("token-1", FILE_ID)

            expect(read.name).toBe(FILE_ID)
            expect(read.text).toHaveLength(120_000)
        })
    })
})

describe("DriveApiClient", () => {
    describe("readFile", () => {
        it.each([
            ["a named", { name: "blob", mimeType: "application/octet-stream" }, "application/octet-stream"],
            ["a typeless", { name: "blob.xyz" }, "unknown"],
        ])("refuses %s type it cannot read", async (_name, meta, type) => {
            const { client, route } = await build()
            route([[META, json(meta)]])

            await expect(client.readFile("token-1", FILE_ID)).rejects.toMatchObject({
                code: DocumentsErrorCode.TypeUnsupported,
                params: { type },
            })
        })
    })
})

describe("DriveApiClient", () => {
    describe("readFile", () => {
        it.each([
            ["image/png", { "content-type": "image/png" }],
            ["unknown", {}],
        ])("refuses a download of no readable kind (%s)", async (type, headers) => {
            const { client, route } = await build()
            route([
                [META, json({ name: "data", mimeType: "text/csv" })],
                ["alt=media", bytes("x", headers)],
            ])

            await expect(client.readFile("token-1", FILE_ID)).rejects.toMatchObject({ params: { type } })
        })
    })
})

describe("DriveApiClient", () => {
    describe("readFile", () => {
        it("refuses a malformed id before it calls Drive", async () => {
            const { client, http } = await build()

            await expect(client.readFile("token-1", "short")).rejects.toMatchObject({
                code: DocumentsErrorCode.DriveIdInvalid,
            })

            expect(http.request).not.toHaveBeenCalled()
        })
    })
})

describe("DriveApiClient", () => {
    describe("readFile", () => {
        it("refuses a folder", async () => {
            const { client, route } = await build()
            route([[META, json({ name: "Dir", mimeType: "application/vnd.google-apps.folder" })]])

            await expect(client.readFile("token-1", FILE_ID)).rejects.toMatchObject({
                code: DocumentsErrorCode.FolderUnsupported,
            })
        })
    })
})

describe("DriveApiClient", () => {
    describe("readFile", () => {
        it("refuses a file whose reported size is over the limit before it downloads", async () => {
            const { client, http, route } = await build()
            route([[META, json({ name: "big.pdf", mimeType: "application/pdf", size: "10000001" })]])

            await expect(client.readFile("token-1", FILE_ID)).rejects.toMatchObject({
                code: DocumentsErrorCode.TooLarge,
            })

            expect(http.request).toHaveBeenCalledTimes(1)
        })
    })
})

describe("DriveApiClient", () => {
    describe("readFile", () => {
        it("refuses a download over the limit even when Drive reported no size", async () => {
            const { client, route } = await build()
            route([
                [META, json({ name: "big.csv", mimeType: "text/csv" })],
                ["alt=media", bytes(new Uint8Array(10_000_001))],
            ])

            await expect(client.readFile("token-1", FILE_ID)).rejects.toMatchObject({
                code: DocumentsErrorCode.TooLarge,
            })
        })
    })
})

describe("DriveApiClient", () => {
    describe("readFile", () => {
        it("reports a rejected token", async () => {
            const { client, route } = await build()
            route([["/files/", bytes("", {}, 401)]])

            await expect(client.readFile("token-1", FILE_ID)).rejects.toMatchObject({
                code: DocumentsErrorCode.TokenRejected,
            })
        })
    })
})

describe("DriveApiClient", () => {
    describe("readFile", () => {
        it.each([
            [404, "not found"],
            [403, "forbidden"],
        ])("reports status %s as an account that cannot open the item", async (status, body) => {
            const { client, route } = await build()
            route([["/files/", bytes(body, {}, status)]])

            await expect(client.readFile("token-1", FILE_ID)).rejects.toMatchObject({
                code: DocumentsErrorCode.DriveNoAccess,
            })
        })
    })
})

describe("DriveApiClient", () => {
    describe("readFile", () => {
        it.each([
            [403, "rateLimitExceeded", DocumentsErrorCode.Refused],
            [500, "oops", DocumentsErrorCode.Unavailable],
        ])("reports status %s (%s) by its status", async (status, body, code) => {
            const { client, route } = await build()
            route([["/files/", bytes(body, {}, status)]])

            await expect(client.readFile("token-1", FILE_ID)).rejects.toMatchObject({ code, params: { status } })
        })
    })
})

describe("DriveApiClient", () => {
    describe("refreshAccessToken", () => {
        it("asks Google for a new access token with the client of the deployment", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValue(
                json({ access_token: "new-token", [RENEWAL_GRANT_FIELD]: "rotated", expires_in: 1800 }),
            )

            await expect(client.refreshAccessToken("refresh-1")).resolves.toEqual({
                accessToken: "new-token",
                renewalToken: "rotated",
                expiresInSeconds: 1800,
            })

            expect(http.request).toHaveBeenCalledWith({
                method: "POST",
                url: "https://oauth2.googleapis.com/token",
                form: {
                    [RENEWAL_GRANT_FIELD]: "refresh-1",
                    client_id: "client-1",
                    client_secret: "secret-1",
                    grant_type: "refresh_token",
                },
                read: "bytes",
                timeoutMs: 15_000,
            })
        })

        it("uses the token endpoint of a local fake and defaults the lifetime and the refresh token", async () => {
            const { client, http } = await build(optionsOf({ oauthBase: "https://fake.test" }))
            http.request.mockResolvedValue(json({ access_token: "new-token" }))

            await expect(client.refreshAccessToken("refresh-1")).resolves.toEqual({
                accessToken: "new-token",
                renewalToken: null,
                expiresInSeconds: 3600,
            })

            expect(http.request).toHaveBeenCalledWith(expect.objectContaining({ url: "https://fake.test/token" }))
        })

        it("refuses when the deployment has no Google client", async () => {
            const { client, http } = await build(optionsOf({ google: null }))

            await expect(client.refreshAccessToken("refresh-1")).rejects.toMatchObject({
                code: DocumentsErrorCode.GoogleNotConfigured,
            })

            expect(http.request).not.toHaveBeenCalled()
        })

        it.each([
            ["a string error", { error: "invalid_grant" }],
            ["an error object", { error: { status: "invalid_grant" } }],
        ])("reports %s of invalid_grant as a revoked grant", async (_name, body) => {
            const { client, http } = await build()
            http.request.mockResolvedValue(json(body, 400))

            await expect(client.refreshAccessToken("refresh-1")).rejects.toMatchObject({
                code: DocumentsErrorCode.GoogleGrantRevoked,
            })
        })

        it.each([
            ["another error code", json({ error: "server_error" }, 503), DocumentsErrorCode.Unavailable],
            ["an unreadable error", bytes("<html>", {}, 400), DocumentsErrorCode.Refused],
            ["an answer with no access token", json({}), DocumentsErrorCode.Unavailable],
        ])("reports %s by its status", async (_name, response, code) => {
            const { client, http } = await build()
            http.request.mockResolvedValue(response)

            await expect(client.refreshAccessToken("refresh-1")).rejects.toMatchObject({ code })
        })
    })
})
