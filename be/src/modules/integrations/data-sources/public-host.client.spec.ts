import { lookup } from "node:dns/promises"
import type { LookupAddress, LookupAllOptions } from "node:dns"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { HTTP_CLIENT } from "@modules/platform/http"
import type { HttpClient, HttpResponse } from "@modules/platform/http"
import { DATA_SOURCES_OPTIONS } from "./data-sources.decorators"
import type { DataSourcesOptions } from "./data-sources.options"
import { DataSourcesError, DataSourcesErrorCode } from "./errors/data-sources.error"
import { PUBLIC_HOST_TEXT } from "./messages/public-host.messages"
import { PublicHostClient } from "./public-host.client"

jest.mock("node:dns/promises", () => ({ lookup: jest.fn() }))

const lookupMock = jest.mocked<(hostname: string, options: LookupAllOptions) => Promise<Array<LookupAddress>>>(lookup)

const options = (allowPrivateHosts: boolean): DataSourcesOptions => ({ allowPrivateHosts, telegramUser: null })

const build = async (allowPrivateHosts = false) => {
    const http = mock<HttpClient>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            PublicHostClient,
            { provide: DATA_SOURCES_OPTIONS, useValue: options(allowPrivateHosts) },
            { provide: HTTP_CLIENT, useValue: http },
        ],
    }).compile()
    return { client: moduleRef.get(PublicHostClient), http }
}

const answer = (partial: Partial<HttpResponse> = {}): HttpResponse => ({
    status: 200,
    headers: { "content-type": "text/plain" },
    url: "https://shop.example/orders",
    body: "ok",
    ...partial,
})

describe("PublicHostClient", () => {
    beforeEach(() => {
        lookupMock.mockReset()
    })

    it("reports whether private addresses are allowed", async () => {
        const blocked = await build(false)
        const allowed = await build(true)

        expect(blocked.client.allowsPrivate()).toBe(false)
        expect(allowed.client.allowsPrivate()).toBe(true)
    })

    describe("resolve", () => {
        it("refuses a host that is not a name or an address", async () => {
            const { client } = await build()

            await expect(client.resolve("bad host")).rejects.toMatchObject({ code: DataSourcesErrorCode.HostInvalid })
            expect(lookupMock).not.toHaveBeenCalled()
        })

        it("uses an address literal without DNS and keeps its family", async () => {
            const { client } = await build()

            await expect(client.resolve("  8.8.8.8  ")).resolves.toEqual({ address: "8.8.8.8", family: 4 })
            await expect(client.resolve("[2001:4860:4860::8888]")).resolves.toEqual({
                address: "2001:4860:4860::8888",
                family: 6,
            })
            expect(lookupMock).not.toHaveBeenCalled()
        })

        it("refuses a private literal unless the site is allowed to use one", async () => {
            const blocked = await build(false)
            const allowed = await build(true)

            await expect(blocked.client.resolve("10.0.0.1")).rejects.toMatchObject({
                code: DataSourcesErrorCode.HostPrivate,
                params: { host: "10.0.0.1" },
            })
            await expect(allowed.client.resolve("10.0.0.1")).resolves.toEqual({ address: "10.0.0.1", family: 4 })
        })

        it("refuses a name that does not resolve or resolves to a private address", async () => {
            const { client } = await build()
            const cause = new Error("ENOTFOUND")
            lookupMock.mockRejectedValueOnce(cause)
            lookupMock.mockResolvedValueOnce([])
            lookupMock.mockResolvedValueOnce([{ address: "10.1.1.1", family: 4 }])
            lookupMock.mockResolvedValueOnce([
                { address: "8.8.8.8", family: 4 },
                { address: "10.1.1.1", family: 4 },
            ])

            await expect(client.resolve("missing.example")).rejects.toMatchObject({
                code: DataSourcesErrorCode.HostUnknown,
                params: { host: "missing.example" },
                cause,
            })
            await expect(client.resolve("empty.example")).rejects.toMatchObject({
                code: DataSourcesErrorCode.HostUnknown,
            })
            await expect(client.resolve("lan.example")).rejects.toMatchObject({
                code: DataSourcesErrorCode.HostPrivate,
            })
            await expect(client.resolve("mixed.example")).rejects.toMatchObject({
                code: DataSourcesErrorCode.HostPrivate,
            })
        })

        it("returns the first public answer", async () => {
            const { client } = await build()
            const records: Array<LookupAddress> = [
                { address: "8.8.8.8", family: 4 },
                { address: "2001:4860:4860::8888", family: 6 },
            ]
            lookupMock.mockResolvedValue(records)

            await expect(client.resolve("shop.example")).resolves.toEqual({ address: "8.8.8.8", family: 4 })
            expect(lookupMock).toHaveBeenCalledWith("shop.example", { all: true })
        })
    })

    describe("send", () => {
        it("pins the resolved address and reads the body as text", async () => {
            const { client, http } = await build()
            lookupMock.mockResolvedValue([{ address: "8.8.8.8", family: 4 }])
            http.request.mockResolvedValue(answer())

            await expect(client.get("https://shop.example/orders")).resolves.toEqual({
                status: 200,
                headers: { "content-type": "text/plain" },
                text: "ok",
            })
            expect(http.request).toHaveBeenCalledWith({
                method: "GET",
                url: "https://shop.example/orders",
                headers: {},
                read: "text",
                redirect: "manual",
                pin: { address: "8.8.8.8", family: 4 },
                timeoutMs: 15_000,
            })
        })

        it("sends json, form or bytes and a caller timeout", async () => {
            const { client, http } = await build()
            lookupMock.mockResolvedValue([{ address: "8.8.8.8", family: 4 }])
            http.request.mockResolvedValue(answer({ body: "", headers: undefined }))

            await client.send("POST", "https://shop.example/orders", {
                headers: { accept: "application/json" },
                json: { id: 1 },
                timeoutMs: 1000,
                maxBytes: 10,
            })
            await client.send("POST", "https://shop.example/token", { form: { grant: "x" }, timeoutMs: 1000 })
            await client.send("PUT", "https://shop.example/file", { bytes: Buffer.from("hi"), timeoutMs: 1000 })

            expect(http.request).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({ body: { id: 1 }, headers: { accept: "application/json" }, timeoutMs: 1000 }),
            )
            expect(http.request).toHaveBeenNthCalledWith(2, expect.objectContaining({ form: { grant: "x" } }))
            expect(http.request).toHaveBeenNthCalledWith(3, expect.objectContaining({ bytes: Buffer.from("hi") }))
        })

        it("refuses a scheme that is not http and a body over the cap", async () => {
            const { client, http } = await build()

            await expect(client.send("GET", "ftp://shop.example/file", {})).rejects.toMatchObject({
                code: DataSourcesErrorCode.Rejected,
                params: { detail: PUBLIC_HOST_TEXT.schemeOnly },
            })
            lookupMock.mockResolvedValue([{ address: "8.8.8.8", family: 4 }])
            http.request.mockResolvedValue(answer({ body: "abcdef" }))
            await expect(client.send("GET", "https://shop.example/big", { maxBytes: 4 })).rejects.toMatchObject({
                code: DataSourcesErrorCode.TooLarge,
                params: { limit: "0 MB" },
            })
            http.request.mockResolvedValue(answer({ body: 12 }))
            await expect(client.get("https://shop.example/empty")).resolves.toMatchObject({ text: "" })
        })

        it("wraps a network failure", async () => {
            const { client, http } = await build()
            const cause = new Error("reset")
            lookupMock.mockResolvedValue([{ address: "8.8.8.8", family: 4 }])
            http.request.mockRejectedValue(cause)

            await expect(client.get("https://shop.example/down")).rejects.toEqual(
                new DataSourcesError({
                    code: DataSourcesErrorCode.Unavailable,
                    params: { detail: PUBLIC_HOST_TEXT.unreachable },
                    cause,
                }),
            )
        })

        it("follows three redirects and drops the body when the origin changes", async () => {
            const { client, http } = await build()
            lookupMock.mockResolvedValue([{ address: "8.8.8.8", family: 4 }])
            http.request
                .mockResolvedValueOnce(answer({ status: 302, headers: { location: "/next" }, body: "" }))
                .mockResolvedValueOnce(
                    answer({ status: 301, headers: { location: "https://cdn.example/file" }, body: "" }),
                )
                .mockResolvedValueOnce(answer({ status: 200, body: "done", headers: {} }))

            await expect(
                client.send("POST", "https://shop.example/start", { json: { id: 1 }, timeoutMs: 2000 }),
            ).resolves.toEqual({ status: 200, headers: {}, text: "done" })

            expect(http.request).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({ url: "https://shop.example/next", body: { id: 1 } }),
            )
            expect(http.request).toHaveBeenNthCalledWith(
                3,
                expect.objectContaining({ url: "https://cdn.example/file", timeoutMs: 2000 }),
            )
            expect(http.request.mock.calls[2]?.[0]).not.toEqual(expect.objectContaining({ body: { id: 1 } }))
        })

        it("stops after more than three redirects and ignores a redirect without a location", async () => {
            const { client, http } = await build()
            lookupMock.mockResolvedValue([{ address: "8.8.8.8", family: 4 }])
            http.request.mockResolvedValue(answer({ status: 302, headers: { location: "/again" }, body: "" }))

            await expect(client.get("https://shop.example/loop")).rejects.toMatchObject({
                code: DataSourcesErrorCode.Rejected,
                params: { detail: PUBLIC_HOST_TEXT.tooManyRedirects },
            })
            expect(http.request).toHaveBeenCalledTimes(4)

            http.request.mockResolvedValue(answer({ status: 302, headers: {}, body: "stay" }))
            await expect(client.get("https://shop.example/stay")).resolves.toMatchObject({ status: 302, text: "stay" })
        })
    })
})
