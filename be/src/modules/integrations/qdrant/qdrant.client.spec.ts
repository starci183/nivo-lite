import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { HTTP_CLIENT } from "@modules/platform/http"
import { isRecord } from "@modules/platform/primitives"
import type { HttpClient, HttpRequest } from "@modules/platform/http"
import { QdrantErrorCode } from "./errors/qdrant.error"
import { QdrantClient } from "./qdrant.client"
import type { VectorIndex, VectorPoint, VectorScope } from "./qdrant.contracts"
import { QDRANT_ENDPOINT } from "./qdrant.decorators"
import type { QdrantEndpoint } from "./qdrant.options"
import { filterOf } from "./qdrant.policy"

const WS = "11111111-1111-4111-8111-111111111111"
const BASE = "http://qdrant.test:6333"
const customer: VectorScope = {
    workspaceId: WS,
    audience: "customer",
    module: "chatbot",
    installationId: null,
    model: "m1@1536",
    standing: "in_force",
}
const internal: VectorScope = { ...customer, audience: "internal", installationId: "i1" }

const point = (id: string): VectorPoint => ({
    id,
    vector: [0.1, 0.2],
    payload: {
        workspaceId: WS,
        sourceId: "s1",
        module: null,
        installationId: null,
        isPublic: true,
        customerReady: false,
        inForce: true,
        model: "m1@1536",
        textHash: "h1",
    },
})

/** The `points` array of the body a request carried, empty when the body has none. */
const pointsOf = (request: HttpRequest): ReadonlyArray<unknown> => {
    const body: unknown = request.body
    return isRecord(body) && Array.isArray(body.points) ? body.points : []
}

/** True when the body of a request asks for the vectors. */
const asksVectors = (request: HttpRequest): boolean => {
    const body: unknown = request.body
    return isRecord(body) && body.with_vector === true
}

/** A scripted Qdrant: every request is recorded and answered from the script; no network. */
const build = async (answer: (request: HttpRequest) => unknown = () => ({ result: {} }), status = 200) => {
    const http = mock<HttpClient>()
    /** The endpoint the client calls, as the module registers it. */
    const endpoint = mock<QdrantEndpoint>({ url: BASE, apiKey: null, timeoutMs: 5000, dimensions: 1536 })
    const requests: Array<HttpRequest> = []
    http.request.mockImplementation((request) => {
        requests.push(request)
        return Promise.resolve({ status, body: answer(request) })
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            QdrantClient,
            { provide: HTTP_CLIENT, useValue: http },
            { provide: QDRANT_ENDPOINT, useValue: endpoint },
        ],
    }).compile()
    return { client: moduleRef.get(QdrantClient), requests, http }
}

/** True when a value of type `From` is accepted where `To` is wanted. */
type Accepts<To, From> = [From] extends [To] ? true : false

const registerFilterCases = () => {
    it("always carries the tenant, the model and rows in force; a customer audience adds public and customer-ready", async () => {
        await build()

        expect(filterOf(customer)).toEqual({
            must: [
                { key: "workspace_id", match: { value: WS } },
                { key: "model", match: { value: "m1@1536" } },
                { key: "in_force", match: { value: true } },
                { should: [{ is_null: { key: "module" } }, { key: "module", match: { value: "chatbot" } }] },
                { should: [{ is_null: { key: "installation_id" } }] },
                { key: "is_public", match: { value: true } },
                { key: "customer_ready", match: { value: true } },
            ],
        })
        const team = filterOf(internal).must
        expect(team).toHaveLength(5)
        expect(team).toContainEqual({
            should: [{ is_null: { key: "installation_id" } }, { key: "installation_id", match: { value: "i1" } }],
        })
    })

    it("has no search or count that takes a filter: the scope is the only way in (typecheck)", async () => {
        const { client } = await build()
        const index: VectorIndex = client

        // A search names its scope, and a scope names its audience and its workspace: a bare filter object is none of these.
        const widened: Accepts<Parameters<VectorIndex["search"]>[1], { must: [] }> = false
        const noAudience: Accepts<VectorScope, Omit<VectorScope, "audience">> = false
        const noTenant: Accepts<VectorScope, Omit<VectorScope, "workspaceId">> = false

        expect([widened, noAudience, noTenant, index.search.length]).toHaveLength(4)
    })
}

/** The reads: search, count, the stamps of a document and the walk of a kind. */
const registerSearchCases = () => {
    it("searches inside the scope in one call and answers ids and scores only, never text", async () => {
        const { client, requests } = await build(() => ({
            result: {
                points: [
                    { id: "p1", score: 0.91, payload: { text: "leak" } },
                    { id: 7, score: 0.5 },
                    { id: "p2", score: 0.4 },
                ],
            },
        }))

        const matches = await client.search("passage", customer, [0.1, 0.2], { limit: 500, offset: 40 })

        expect(matches).toEqual([
            { id: "p1", score: 0.91 },
            { id: "p2", score: 0.4 },
        ])
        expect(requests).toEqual([
            {
                method: "POST",
                url: `${BASE}/collections/nivo_passages/points/query`,
                body: {
                    query: [0.1, 0.2],
                    filter: filterOf(customer),
                    limit: 100,
                    offset: 40,
                    with_payload: false,
                    with_vector: false,
                },
                timeoutMs: 5000,
            },
        ])
    })

    it("keeps truths in their own collection and counts inside the scope", async () => {
        const { client, requests } = await build(() => ({ result: { count: 3 } }))

        await expect(client.count("truth", internal)).resolves.toBe(3)

        expect(requests[0]).toMatchObject({
            url: `${BASE}/collections/nivo_truths/points/count`,
            body: { filter: filterOf(internal), exact: true },
        })
    })

}

/** The stamps of a document and the walk of a kind. */
const registerStampCases = () => {
    it("pages the stamps of a document for the sync and reads vectors to adopt", async () => {
        const stored = {
            workspace_id: WS,
            source_id: "s1",
            is_public: true,
            in_force: true,
            model: "m1@1536",
            text_hash: "h1",
        }
        const { client, requests } = await build((request) =>
            request.url.endsWith("/scroll") && asksVectors(request)
                ? { result: { points: [{ id: "p1", vector: [1, 2] }] } }
                : { result: { points: [{ id: "p1", payload: stored }, { id: "p2" }], next_page_offset: "p3" } },
        )

        const page = await client.stamps("passage", { workspaceId: WS, sourceId: "s1" }, { limit: 1000, after: "p0" })
        expect(page.next).toBe("p3")
        expect(page.points[0]).toEqual({
            id: "p1",
            payload: { ...point("p1").payload, customerReady: false },
        })
        // A point whose payload is missing reads as empty: the sync sees it differ from any row and rewrites it.
        expect(page.points[1]?.payload).toMatchObject({ workspaceId: "", model: "", textHash: "", inForce: false })
        await expect(client.vectorsOf("passage", WS, ["p1"])).resolves.toEqual(new Map([["p1", [1, 2]]]))
        await expect(client.vectorsOf("passage", WS, [])).resolves.toEqual(new Map())

        expect(requests[0]?.body).toMatchObject({
            filter: {
                must: [
                    { key: "workspace_id", match: { value: WS } },
                    { key: "source_id", match: { value: "s1" } },
                ],
            },
            limit: 256,
            offset: "p0",
            with_payload: true,
            with_vector: false,
        })
        expect(requests).toHaveLength(2)
    })

    it("walks every point of a kind for the reconcile and reads stamps by row id", async () => {
        const { client, requests } = await build((request) =>
            request.url.endsWith("/points")
                ? { result: [{ id: "p1", payload: { workspace_id: WS } }] }
                : { result: { points: [] } },
        )

        await expect(client.stamps("truth", {}, { limit: 256, after: null })).resolves.toEqual({
            points: [],
            next: null,
        })
        await expect(client.stampsOf("truth", ["p1", "p2"])).resolves.toMatchObject([
            { id: "p1", payload: { workspaceId: WS } },
        ])

        expect(requests[0]?.body).toMatchObject({ filter: { must: [] } })
        expect(requests[1]).toMatchObject({
            method: "POST",
            url: `${BASE}/collections/nivo_truths/points`,
            body: { ids: ["p1", "p2"], with_payload: true, with_vector: false },
        })
    })
}

/** The writes: upsert, remove, the flags and the batch size. */
const registerWriteCases = () => {
    it("upserts points under their Postgres row ids with the mirror of the row and no text, in batches, acknowledged", async () => {
        const { client, requests } = await build()

        await client.upsert(
            "passage",
            Array.from({ length: 100 }, (_, at) => point(`p${at}`)),
        )

        expect(requests.map((request) => request.url)).toEqual([
            `${BASE}/collections/nivo_passages/points?wait=true`,
            `${BASE}/collections/nivo_passages/points?wait=true`,
        ])
        const [first, second] = requests.map((request) => pointsOf(request))
        expect([first?.length, second?.length]).toEqual([64, 36])
        expect(first?.[0]).toEqual({
            id: "p0",
            vector: [0.1, 0.2],
            payload: {
                workspace_id: WS,
                source_id: "s1",
                module: null,
                installation_id: null,
                is_public: true,
                customer_ready: false,
                in_force: true,
                model: "m1@1536",
                text_hash: "h1",
            },
        })
    })

    it("removes points only inside the workspace that owns them", async () => {
        const { client, requests } = await build()

        await client.remove("passage", WS, ["p1", "p2"])
        await client.remove("passage", WS, [])

        expect(requests).toHaveLength(1)
        expect(requests[0]).toMatchObject({
            url: `${BASE}/collections/nivo_passages/points/delete?wait=true`,
            body: { filter: { must: [{ key: "workspace_id", match: { value: WS } }, { has_id: ["p1", "p2"] }] } },
        })
    })

}

/** The flags and the batch size of the writes. */
const registerFlagCases = () => {
    it("rewrites the flags of points inside their workspace and leaves the vector and its identity", async () => {
        const { client, requests } = await build()
        const { model: _model, textHash: _hash, ...flags } = point("p1").payload

        await client.mark("passage", WS, ["p1"], { ...flags, customerReady: true })

        expect(requests[0]).toMatchObject({
            method: "POST",
            url: `${BASE}/collections/nivo_passages/points/payload?wait=true`,
        })
        expect(requests[0]?.body).toEqual({
            payload: {
                workspace_id: WS,
                source_id: "s1",
                module: null,
                installation_id: null,
                is_public: true,
                customer_ready: true,
                in_force: true,
            },
            filter: { must: [{ key: "workspace_id", match: { value: WS } }, { has_id: ["p1"] }] },
        })
    })

    it("writes vectors in batches of 64 so one call stays small", async () => {
        const { client, requests } = await build()

        await client.upsert(
            "passage",
            Array.from({ length: 130 }, (_, at) => point(`p${String(at)}`)),
        )

        expect(requests.map((request) => pointsOf(request).length)).toEqual([
            64, 64, 2,
        ])
    })
}

/** The setup and the check of a collection. */
const registerCollectionCases = () => {
    it("creates a missing collection with cosine vectors of the stored size and the payload indexes, the tenant marked", async () => {
        const { client, requests } = await build((request) =>
            request.method === "GET" ? { result: { exists: false } } : { result: true },
        )

        await client.ensure("passage")

        expect(requests[1]).toMatchObject({
            method: "PUT",
            url: `${BASE}/collections/nivo_passages`,
            body: { vectors: { size: 1536, distance: "Cosine" } },
        })
        expect(requests[2]?.body).toEqual({
            field_name: "workspace_id",
            field_schema: { type: "keyword", is_tenant: true },
        })
        expect(requests).toHaveLength(10)
    })

    it("keeps a collection of the app's own vector size and refuses one of another size or distance", async () => {
        const described = (size: number, distance: string) => (request: HttpRequest) => {
            if (request.url.endsWith("/exists")) return { result: { exists: true } }
            return request.method === "GET"
                ? { result: { config: { params: { vectors: { size, distance } } } } }
                : { result: true }
        }
        const same = await build(described(1536, "Cosine"))
        await expect(same.client.ensure("truth")).resolves.toBeUndefined()
        expect(
            same.requests.filter(
                (request) => request.url.endsWith("/collections/nivo_truths") && request.method === "PUT",
            ),
        ).toEqual([])

        const other = await build(described(3072, "Cosine"))
        await expect(other.client.ensure("truth")).rejects.toMatchObject({
            code: QdrantErrorCode.Mismatch,
            params: { collection: "nivo_truths", expected: "1536 Cosine", found: "3072 Cosine" },
        })
        // Nothing is created or indexed over a collection that does not agree.
        expect(other.requests.every((request) => request.method === "GET")).toBe(true)

        await expect((await build(described(1536, "Dot"))).client.ensure("truth")).rejects.toMatchObject({
            code: QdrantErrorCode.Mismatch,
        })
    })
}

/** The health of the client and what a refusal or a network failure turns into. */
const registerFailureCases = () => {
    it("says it is down after a call that did not reach the service and ok again after one that did", async () => {
        const { client, http } = await build()
        expect(client.health()).toBe("ok")

        http.request.mockRejectedValueOnce(new Error("ECONNREFUSED"))
        await expect(client.count("passage", customer)).rejects.toMatchObject({ code: QdrantErrorCode.Unavailable })
        expect(client.health()).toBe("down")

        await client.count("passage", customer)
        expect(client.health()).toBe("ok")
    })

    it("turns a refusal and a network failure into its own errors", async () => {
        const refused = await build(() => ({ status: { error: "bad" } }), 400)
        await expect(refused.client.count("passage", customer)).rejects.toMatchObject({
            code: QdrantErrorCode.Rejected,
            params: { call: "count", status: "400" },
        })

        const down = await build()
        down.http.request.mockRejectedValue(new Error("ECONNREFUSED"))
        await expect(down.client.search("passage", customer, [1], { limit: 1 })).rejects.toMatchObject({
            code: QdrantErrorCode.Unavailable,
        })
    })
}

/** The collection setup when api and mcp boot together and both create the same collection. */
const registerSetupRaceCases = () => {
    it("takes a 409 on create (another process created the collection first) as created, then checks it like an existing one", async () => {
        /** Qdrant as the loser of the api/mcp race sees it: `exists` says no, the create says 409, the describe says what is there. */
        const raced = async (size: number) => {
            const scripted = await build()
            scripted.http.request.mockImplementation((request) => {
                scripted.requests.push(request)
                if (request.url.endsWith("/exists"))
                    return Promise.resolve({ status: 200, body: { result: { exists: false } } })
                if (request.method === "PUT" && request.url.endsWith("/collections/nivo_truths")) {
                    return Promise.resolve({
                        status: 409,
                        body: { status: { error: "Collection `nivo_truths` already exists!" } },
                    })
                }
                if (request.method === "GET") {
                    return Promise.resolve({
                        status: 200,
                        body: { result: { config: { params: { vectors: { size, distance: "Cosine" } } } } },
                    })
                }
                return Promise.resolve({ status: 200, body: { result: true } })
            })
            return scripted
        }

        const same = await raced(1536)
        await expect(same.client.ensure("truth")).resolves.toBeUndefined()
        expect(
            same.requests.map((request) => `${request.method} ${request.url.replace(BASE, "")}`).slice(0, 4),
        ).toEqual([
            "GET /collections/nivo_truths/exists",
            "PUT /collections/nivo_truths",
            "GET /collections/nivo_truths",
            "PUT /collections/nivo_truths/index?wait=true",
        ])

        const other = await raced(3072)
        await expect(other.client.ensure("truth")).rejects.toMatchObject({
            code: QdrantErrorCode.Mismatch,
            params: { collection: "nivo_truths", expected: "1536 Cosine", found: "3072 Cosine" },
        })
        expect(other.requests.some((request) => request.url.includes("/index"))).toBe(false)
    })

    it("still refuses any other status of the create as QDRANT_REJECTED", async () => {
        const scripted = await build()
        scripted.http.request.mockImplementation((request) =>
            Promise.resolve(
                request.url.endsWith("/exists")
                    ? { status: 200, body: { result: { exists: false } } }
                    : { status: 500, body: { status: { error: "boom" } } },
            ),
        )
        await expect(scripted.client.ensure("passage")).rejects.toMatchObject({
            code: QdrantErrorCode.Rejected,
            params: { call: "create", status: "500" },
        })
    })
}

describe("QdrantClient", () => {
    describe("filter", registerFilterCases)
    describe("reads", registerSearchCases)
    describe("stamps", registerStampCases)
    describe("writes", registerWriteCases)
    describe("flags", registerFlagCases)
    describe("collections", registerCollectionCases)
    describe("failures", registerFailureCases)
    describe("collection setup race", registerSetupRaceCases)
})
