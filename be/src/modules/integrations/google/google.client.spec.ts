import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { Secret } from "@modules/platform/config"
import { CLOCK } from "@modules/platform/clock"
import { HTTP_CLIENT } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { GoogleErrorCode } from "./errors/google.error"
import { GoogleClient } from "./google.client"
import { GOOGLE_OPTIONS } from "./google.decorators"
import type { GoogleOptions } from "./google.options"
import { ordersTab } from "./google-sheet.policy"

const OPTIONS: GoogleOptions = {
    client: { clientId: "client-1", clientSecret: new Secret("secret-1") },
    oauthBase: undefined,
    sheetsBase: undefined,
    siteUrl: "https://nivo.vn",
    channelTokenKey: new Secret(Buffer.alloc(32, 9).toString("base64")),
    timeoutMs: 5000,
}

const build = async (options: GoogleOptions = OPTIONS) => {
    const http = mock<HttpClient>()
    const clock = new FakeClock("2026-10-12T03:00:00.000Z")
    const moduleRef = await Test.createTestingModule({
        providers: [
            GoogleClient,
            { provide: HTTP_CLIENT, useValue: http },
            { provide: GOOGLE_OPTIONS, useValue: options },
            { provide: CLOCK, useValue: clock },
        ],
    }).compile()
    return { client: moduleRef.get(GoogleClient), http, clock }
}

const answer = (body: unknown, status = 200) => ({ status, body })

describe("GoogleClient", () => {
    describe("configuration and state", () => {
        it("is configured only with a client and a site url", async () => {
            expect((await build()).client.isConfigured()).toBe(true)
            expect((await build({ ...OPTIONS, client: null })).client.isConfigured()).toBe(false)
            expect((await build({ ...OPTIONS, siteUrl: undefined })).client.isConfigured()).toBe(false)
        })

        it("builds the consent url for a state", async () => {
            const { client } = await build()

            expect(client.authUrl("s1")).toContain("state=s1")
            expect(client.authUrl("s1", "drive.readonly")).toContain("scope=drive.readonly")
        })

        it("signs a state that verifies until it expires", async () => {
            const { client, clock } = await build()
            const state = client.sign({ workspaceId: "ws", userId: "u", returnTo: "/connections" })

            expect(client.verify(state)).toMatchObject({ w: "ws", u: "u" })
            clock.advance(11 * 60 * 1000)
            expect(client.verify(state)).toBeNull()
        })
    })

    describe("tokens", () => {
        it("exchanges a consent code with the redirect uri of the site", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValue(
                answer({ access_token: "at", refresh_token: "rt", expires_in: 100, id_token: "id", scope: "s" }),
            )

            await expect(client.exchangeCode("code-1")).resolves.toEqual({
                accessToken: "at",
                refreshToken: "rt",
                expiresAt: new Date("2026-10-12T03:00:00.000Z").getTime() + 100_000,
                idToken: "id",
                scope: "s",
            })
            expect(http.request).toHaveBeenCalledWith({
                method: "POST",
                url: "https://oauth2.googleapis.com/token",
                form: {
                    code: "code-1",
                    client_id: "client-1",
                    client_secret: "secret-1",
                    redirect_uri: "https://nivo.vn/api/connections/google/callback",
                    grant_type: "authorization_code",
                },
                timeoutMs: 5000,
            })
        })

        it("defaults the lifetime to an hour and leaves absent fields null", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValue(answer({ access_token: "at" }))

            await expect(client.refreshAccessToken("rt")).resolves.toMatchObject({
                refreshToken: null,
                idToken: null,
                scope: null,
                expiresAt: new Date("2026-10-12T03:00:00.000Z").getTime() + 3_600_000,
            })
            expect(http.request).toHaveBeenCalledWith(
                expect.objectContaining({
                    form: expect.objectContaining({ grant_type: "refresh_token", refresh_token: "rt" }),
                }),
            )
        })

        it("refuses to talk to Google when it is not configured", async () => {
            const { client } = await build({ ...OPTIONS, client: null })
            const { client: noSite } = await build({ ...OPTIONS, siteUrl: undefined })

            expect(() => client.exchangeCode("c")).toThrow(
                expect.objectContaining({ code: GoogleErrorCode.NotConfigured }),
            )
            expect(() => noSite.exchangeCode("c")).toThrow(
                expect.objectContaining({ code: GoogleErrorCode.NotConfigured }),
            )
            expect(() => client.refreshAccessToken("r")).toThrow(
                expect.objectContaining({ code: GoogleErrorCode.NotConfigured }),
            )
        })

        it("rejects an answer without an access token", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValue(answer({}))

            await expect(client.refreshAccessToken("rt")).rejects.toMatchObject({
                code: GoogleErrorCode.ContractMismatch,
            })
        })

        it("reports a refusal with its status and reason", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValueOnce(answer({ error: "invalid_grant" }, 400))
            http.request.mockResolvedValueOnce(answer({ error: { status: "PERMISSION_DENIED" } }, 403))
            http.request.mockResolvedValueOnce(answer("not an object", 500))

            await expect(client.refreshAccessToken("rt")).rejects.toMatchObject({
                code: GoogleErrorCode.Refused,
                params: { status: 400, reason: "invalid_grant" },
            })
            await expect(client.refreshAccessToken("rt")).rejects.toMatchObject({
                params: { status: 403, reason: "PERMISSION_DENIED" },
            })
            await expect(client.refreshAccessToken("rt")).rejects.toMatchObject({ params: { status: 500, reason: "" } })
        })

        it("reports an unreachable Google", async () => {
            const { client, http } = await build()
            http.request.mockRejectedValue(new Error("down"))

            await expect(client.refreshAccessToken("rt")).rejects.toMatchObject({ code: GoogleErrorCode.Unreachable })
        })
    })

    describe("accountEmail", () => {
        const idTokenOf = (payload: unknown) => `h.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.s`

        it("reads the email from the id token without a request", async () => {
            const { client, http } = await build()

            await expect(
                client.accountEmail({ idToken: idTokenOf({ email: "a@b.vn" }), accessToken: "at" }),
            ).resolves.toBe("a@b.vn")
            expect(http.request).not.toHaveBeenCalled()
        })

        it("asks the userinfo endpoint when the id token says nothing", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValue(answer({ email: "u@b.vn" }))

            await expect(client.accountEmail({ idToken: null, accessToken: "at" })).resolves.toBe("u@b.vn")
            await expect(client.accountEmail({ idToken: idTokenOf({ sub: "1" }), accessToken: "at" })).resolves.toBe(
                "u@b.vn",
            )
            await expect(client.accountEmail({ idToken: idTokenOf("text"), accessToken: "at" })).resolves.toBe("u@b.vn")
            await expect(client.accountEmail({ idToken: "garbage", accessToken: "at" })).resolves.toBe("u@b.vn")
            expect(http.request).toHaveBeenCalledWith(
                expect.objectContaining({
                    url: "https://openidconnect.googleapis.com/v1/userinfo",
                    headers: { authorization: "Bearer at" },
                }),
            )
        })

        it("answers null when nothing names the account", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValueOnce(answer({}))
            http.request.mockRejectedValueOnce(new Error("down"))

            await expect(client.accountEmail({ idToken: null, accessToken: "at" })).resolves.toBeNull()
            await expect(client.accountEmail({ idToken: null, accessToken: "at" })).resolves.toBeNull()
        })
    })

    describe("spreadsheets", () => {
        it("creates the spreadsheet and formats the money column", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValueOnce(answer({ spreadsheetId: "id 1", spreadsheetUrl: "https://s.test/1" }))
            http.request.mockResolvedValueOnce(answer({}))

            await expect(client.createOrdersSpreadsheet("tok", "Shop")).resolves.toEqual({
                spreadsheetId: "id 1",
                spreadsheetUrl: "https://s.test/1",
            })
            expect(http.request).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({ url: "https://sheets.googleapis.com/v4/spreadsheets/id%201:batchUpdate" }),
            )
        })

        it("builds the url itself when Google sends none and rejects a missing id", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValueOnce(answer({ spreadsheetId: "abc" }))
            http.request.mockResolvedValueOnce(answer({}))
            http.request.mockResolvedValueOnce(answer({}))

            await expect(client.createOrdersSpreadsheet("tok", "Shop")).resolves.toMatchObject({
                spreadsheetUrl: "https://docs.google.com/spreadsheets/d/abc/edit",
            })
            await expect(client.createOrdersSpreadsheet("tok", "Shop")).rejects.toMatchObject({
                code: GoogleErrorCode.ContractMismatch,
            })
        })
    })

    describe("sheet operations", () => {
        it("finds the first matching row in priority order, skipping the header", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValue(answer({ values: [["Code"], ["A-1"], [], ["B-2"], "bad", [" A-1 "]] }))
            const sheets = (await build()).client.sheets("tok")
            const api = client.sheets("tok")

            await expect(api.findRow("s", ["B-2", "A-1"])).resolves.toEqual({ row: 4, code: "B-2" })
            await expect(api.findRow("s", ["Code", "Z"])).resolves.toBeNull()
            await expect(api.findRow("s", [" ", ""])).resolves.toBeNull()
            expect(http.request).toHaveBeenCalledTimes(2)
            expect(http.request).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: "GET",
                    url: `https://sheets.googleapis.com/v4/spreadsheets/s/values/${encodeURIComponent(`'${ordersTab()}'!B:B`)}`,
                }),
            )
            expect(sheets).toBeDefined()
        })

        it("reads a sheet with no values as no match", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValue(answer({}))

            await expect(client.sheets("tok").findRow("s", ["A"])).resolves.toBeNull()
        })

        it("appends a row as raw values and reads the row it landed on", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValueOnce(answer({ updates: { updatedRange: "'Tab'!A12:I12" } }))
            http.request.mockResolvedValueOnce(answer({ updates: { updatedRange: "nonsense" } }))
            http.request.mockResolvedValueOnce(answer({}))

            await expect(client.sheets("tok").appendRow("s", "Tab", 9, ["=x", 1])).resolves.toBe(12)
            await expect(client.sheets("tok").appendRow("s", "Tab", 9, [])).resolves.toBe(0)
            await expect(client.sheets("tok").appendRow("s", "Tab", 9, [])).resolves.toBe(0)
            expect(http.request).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({
                    method: "POST",
                    url: expect.stringContaining(":append?valueInputOption=RAW&insertDataOption=INSERT_ROWS"),
                    body: { majorDimension: "ROWS", values: [["=x", 1]] },
                    headers: { authorization: "Bearer tok" },
                }),
            )
        })

        it("updates the given cells of one row", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValue(answer({}))

            await client.sheets("tok").updateCells("s", 4, { F: "x", G: 2 })

            expect(http.request).toHaveBeenCalledWith(
                expect.objectContaining({
                    body: {
                        valueInputOption: "RAW",
                        data: [
                            { range: `'${ordersTab()}'!F4`, majorDimension: "ROWS", values: [["x"]] },
                            { range: `'${ordersTab()}'!G4`, majorDimension: "ROWS", values: [[2]] },
                        ],
                    },
                }),
            )
        })

        it("applies a NIVO event through the sheet operations", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValue(answer({ updates: { updatedRange: "A2:G2" } }))

            const result = await client.applyEvent(
                "tok",
                { spreadsheetId: "s", recordLeads: true },
                { event: "lead.created", data: { name: "An" }, occurredAt: "2026-10-12T03:00:00.000Z" },
            )

            expect(result.evidence).toContain("An")
        })
    })
})
