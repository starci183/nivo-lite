import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { PUBLIC_HOST } from "./data-sources.decorators"
import { DataSourcesErrorCode } from "./errors/data-sources.error"
import { OPENAPI_TEXT, specDownloadFailure } from "./messages/openapi.messages"
import { OpenApiClient } from "./openapi.client"
import type { OpenApiCall } from "./openapi.contracts"
import type { PublicHostClient, PublicResponse } from "./public-host.client"

const SPEC =
    '{"openapi":"3.0.0","info":{"title":"Shop"},"paths":{"/ping":{"get":{"operationId":"ping","responses":{"200":{"description":"ok"}}}}}}'

const response = (partial: Partial<PublicResponse>): PublicResponse => ({
    status: 200,
    headers: {},
    text: SPEC,
    ...partial,
})

const callOf = (partial: Partial<OpenApiCall> = {}): OpenApiCall => ({
    baseUrl: "https://api.example",
    op: { id: "ping", method: "GET", path: "/ping", summary: "", params: [], hasBody: false },
    auth: { type: "none", name: "", value: "", user: "", password: "" },
    input: {},
    ...partial,
})

const build = async (allowPrivate = false) => {
    const publicHost = mock<PublicHostClient>()
    publicHost.allowsPrivate.mockReturnValue(allowPrivate)
    const moduleRef = await Test.createTestingModule({
        providers: [OpenApiClient, { provide: PUBLIC_HOST, useValue: publicHost }],
    }).compile()
    return { client: moduleRef.get(OpenApiClient), publicHost }
}

describe("OpenApiClient", () => {
    describe("fetchSpec", () => {
        it("refuses a link that is not https, unless a development site allows http", async () => {
            const blocked = await build(false)
            const allowed = await build(true)

            await expect(blocked.client.fetchSpec("not a url")).rejects.toMatchObject({
                code: DataSourcesErrorCode.Rejected,
                params: { detail: OPENAPI_TEXT.badSpecLink },
            })
            await expect(blocked.client.fetchSpec("http://api.example/openapi.json")).rejects.toMatchObject({
                params: { detail: OPENAPI_TEXT.httpsSpecLink },
            })
            blocked.publicHost.get.mockResolvedValue(response({}))
            await expect(blocked.client.fetchSpec("https://api.example/openapi.json")).resolves.toBe(SPEC)
            allowed.publicHost.get.mockResolvedValue(response({ status: 299, text: "yaml" }))
            await expect(allowed.client.fetchSpec("http://api.example/openapi.yaml")).resolves.toBe("yaml")
        })

        it("refuses a download that is not a success", async () => {
            const { client, publicHost } = await build()
            publicHost.get.mockResolvedValue(response({ status: 404, text: "" }))

            await expect(client.fetchSpec("https://api.example/openapi.json")).rejects.toMatchObject({
                params: { detail: specDownloadFailure(404) },
            })
            expect(publicHost.get).toHaveBeenCalledWith("https://api.example/openapi.json", {
                headers: { accept: "application/json, application/yaml, text/yaml, */*" },
                maxBytes: 5_000_000,
            })
        })
    })

    describe("parseSpec", () => {
        it("reads JSON and YAML and refuses an empty or unreadable document", async () => {
            const { client } = await build()

            expect(client.parseSpec(SPEC, "https://api.example/openapi.json").title).toBe("Shop")
            expect(
                client.parseSpec(
                    "openapi: '3.0.0'\ninfo:\n  title: Shop\npaths:\n  /ping:\n    get:\n      operationId: ping\n      responses:\n        '200':\n          description: ok\n",
                    "https://api.example/openapi.yaml",
                ).ops[0]?.id,
            ).toBe("ping")
            expect(() => client.parseSpec("   ", "https://api.example/openapi.json")).toThrow(
                expect.objectContaining({ params: { detail: OPENAPI_TEXT.emptySpec } }),
            )
            expect(() => client.parseSpec("openapi: nope\n", "https://api.example/openapi.yaml")).toThrow(
                expect.objectContaining({ params: { detail: OPENAPI_TEXT.notSpec } }),
            )
            expect(() => client.parseSpec("[", "https://api.example/openapi.yaml")).toThrow(
                expect.objectContaining({ params: { detail: OPENAPI_TEXT.unreadableSpec } }),
            )
        })
    })

    describe("call", () => {
        it("sends the built request and keeps a non-success status", async () => {
            const { client, publicHost } = await build()
            const sent: PublicResponse = { status: 500, headers: {}, text: "no" }
            publicHost.send.mockResolvedValue(sent)
            const posted = callOf({
                op: { id: "create", method: "POST", path: "/orders", summary: "", params: [], hasBody: true },
                input: { body: { sku: "a" } },
                maxBytes: 1000,
            })

            await expect(client.call(callOf())).resolves.toBe(sent)
            await expect(client.call(posted)).resolves.toBe(sent)

            expect(publicHost.send).toHaveBeenNthCalledWith(1, "GET", "https://api.example/ping", {
                headers: { accept: "application/json" },
                timeoutMs: 15_000,
                maxBytes: 5_000_000,
            })
            expect(publicHost.send).toHaveBeenNthCalledWith(2, "POST", "https://api.example/orders", {
                headers: { accept: "application/json", "content-type": "application/json" },
                timeoutMs: 15_000,
                maxBytes: 1000,
                bytes: Buffer.from(JSON.stringify({ sku: "a" })),
            })
        })
    })
})
