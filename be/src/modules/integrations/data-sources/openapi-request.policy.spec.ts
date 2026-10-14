import type { OpenApiAuth, OpenApiCall, OpenApiOperation } from "./openapi.contracts"
import { DataSourcesErrorCode } from "./errors/data-sources.error"
import { OPENAPI_TEXT, missingPathParam } from "./messages/openapi.messages"
import { buildRequest } from "./openapi-request.policy"

const operation = (partial: Partial<OpenApiOperation> = {}): OpenApiOperation => ({
    id: "list",
    method: "GET",
    path: "/orders/{id}",
    summary: "",
    params: [
        { name: "id", in: "path", required: true },
        { name: "q", in: "query", required: false },
        { name: "X-Trace", in: "header", required: false },
    ],
    hasBody: false,
    ...partial,
})

const auth = (partial: Partial<OpenApiAuth> = {}): OpenApiAuth => ({
    type: "none",
    name: "",
    value: "",
    user: "",
    password: "",
    ...partial,
})

const call = (partial: Partial<OpenApiCall> = {}): OpenApiCall => ({
    baseUrl: "https://api.example/v1/",
    op: operation(),
    auth: auth(),
    input: { id: "a b", q: "open", "X-Trace": "t-1" },
    ...partial,
})

describe("buildRequest", () => {
    it("fills the path, the fixed query, the query and the header, and strips a trailing slash", () => {
        const built = buildRequest(call({ fixedQuery: "page=2&page=3" }))

        expect(built.url.toString()).toBe("https://api.example/v1/orders/a%20b?page=3&q=open")
        expect(built.headers).toEqual({ accept: "application/json", "X-Trace": "t-1" })
        expect(built.body).toBeUndefined()
    })

    it("skips an empty query or header and refuses a missing path value or a base URL that is not http", () => {
        const skipped = buildRequest(call({ input: { id: 7, q: "", "X-Trace": "" } }))

        expect(skipped.url.toString()).toBe("https://api.example/v1/orders/7")
        expect(skipped.headers).toEqual({ accept: "application/json" })
        expect(() => buildRequest(call({ input: { id: "" } }))).toThrow(
            expect.objectContaining({
                code: DataSourcesErrorCode.Rejected,
                params: { detail: missingPathParam("id") },
            }),
        )
        expect(() => buildRequest(call({ baseUrl: "ftp://files.example" }))).toThrow(
            expect.objectContaining({
                code: DataSourcesErrorCode.Rejected,
                params: { detail: OPENAPI_TEXT.baseUrlScheme },
            }),
        )
    })

    it.each<[Partial<OpenApiAuth>, string, string]>([
        [{ type: "header", name: "X-Key", value: "secret" }, "X-Key", "secret"],
        [{ type: "bearer", value: "token" }, "authorization", "Bearer token"],
        [
            { type: "basic", user: "ada", password: "secret" },
            "authorization",
            `Basic ${Buffer.from("ada:secret").toString("base64")}`,
        ],
    ])("sends %j authentication", (credential, header, value) => {
        const built = buildRequest(call({ auth: auth(credential) }))

        expect(built.headers[header]).toBe(value)
    })

    it("puts a query credential on the URL and ignores an incomplete credential", () => {
        const query = buildRequest(call({ auth: auth({ type: "query", name: "api_key", value: "secret" }) }))
        const incomplete = buildRequest(
            call({
                auth: auth({ type: "header", name: "X-Key", value: "" }),
            }),
        )

        expect(query.url.searchParams.get("api_key")).toBe("secret")
        expect(incomplete.headers["X-Key"]).toBeUndefined()
        expect(
            buildRequest(call({ auth: auth({ type: "basic", user: "", password: "" }) })).headers.authorization,
        ).toBeUndefined()
        expect(
            buildRequest(call({ auth: auth({ type: "basic", user: "ada", password: "" }) })).headers.authorization,
        ).toBe(`Basic ${Buffer.from("ada:").toString("base64")}`)
        expect(
            buildRequest(call({ auth: auth({ type: "basic", user: "", password: "secret" }) })).headers.authorization,
        ).toBe(`Basic ${Buffer.from(":secret").toString("base64")}`)
        expect(buildRequest(call({ auth: auth({ type: "bearer", value: "" }) })).headers.authorization).toBeUndefined()
        expect(
            buildRequest(call({ op: operation({ method: "POST", path: "/orders", params: [] }), input: {} })).body,
        ).toBeUndefined()
    })

    it("sends a JSON body for a write, keeps a string body as it is, and calls a next-page link as given", () => {
        const posted = buildRequest(
            call({
                op: operation({ method: "POST", path: "/orders", params: [] }),
                input: { body: { id: 1 } },
            }),
        )
        const raw = buildRequest(
            call({
                op: operation({ method: "PUT", path: "/orders", params: [] }),
                input: { body: "already" },
            }),
        )
        const linked = buildRequest(
            call({
                link: "https://api.example/v1/orders?page=2",
                op: operation({ method: "POST" }),
                input: { id: "1", body: { id: 1 }, "X-Trace": "t-1" },
            }),
        )

        expect(posted.body).toBe('{"id":1}')
        expect(posted.headers["content-type"]).toBe("application/json")
        expect(raw.body).toBe("already")
        expect(raw.headers).toEqual({ accept: "application/json", "content-type": "application/json" })
        expect(
            buildRequest(call({ op: operation({ method: "GET" }), input: { id: "1", body: { id: 1 } } })).body,
        ).toBeUndefined()
        expect(linked.url.toString()).toBe("https://api.example/v1/orders?page=2")
        expect(linked.headers).toEqual({ accept: "application/json", "content-type": "application/json" })
        expect(linked.body).toBe('{"id":1}')
    })
})
