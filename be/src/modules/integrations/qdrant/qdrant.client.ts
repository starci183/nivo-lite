import { Injectable } from "@nestjs/common"
import { InjectHttpClient, type HttpClient, type HttpRequest, type HttpResponse } from "@modules/platform/http"
import { eachInOrder, isRecord } from "@modules/platform/primitives"
import { QdrantError, QdrantErrorCode } from "./errors/qdrant.error"
import type {
    VectorHealth,
    VectorIndex,
    VectorKind,
    VectorMatch,
    VectorFlags,
    VectorPoint,
    VectorScope,
    VectorSearchPage,
    VectorStamp,
    VectorStampCursor,
    VectorStampFilter,
    VectorStampPage,
} from "./qdrant.contracts"
import { InjectQdrantEndpoint } from "./qdrant.decorators"
import type { QdrantEndpoint } from "./qdrant.options"
import {
    BATCH_MAX,
    COLLECTION_OF,
    DISTANCE,
    PAYLOAD_INDEXES,
    SEARCH_MAX,
    UPSERT_MAX,
    countOf,
    filterOf,
    matchesOf,
    nextOf,
    ownedFilterOf,
    flagsOf,
    pointOf,
    shapeOf,
    stampFilterOf,
    stampsOf,
    vectorsOf,
} from "./qdrant.policy"

/** Qdrant's answer to creating a collection that exists: another process of the app created it first. */
const CONFLICT = 409

/** The start offsets of the batches of `step` items that cover `length` items, in order. */
const startsOf = (length: number, step: number): ReadonlyArray<number> =>
    Array.from({ length: Math.ceil(length / step) }, (_, index) => index * step)

/** A count inside 1 and the most. */
const bounded = (wanted: number, most: number): number => Math.max(1, Math.min(Math.trunc(wanted), most))

@Injectable()
/**
 * The one place that speaks Qdrant's REST protocol, over the platform HTTP port (no client library): the vector index of the app.
 * Every search and count is filtered by `filterOf(scope)`, built here from the caller's scope; no method takes a filter. A point id
 * is the id of a Postgres row; a point carries no text. A failure is a `QdrantError`; the API key is never logged.
 */
export class QdrantClient implements VectorIndex {
    /** Whether the last call reached the service; a process that has not called yet reads as reachable. */
    private reached = true

    constructor(
        @InjectHttpClient() private readonly http: HttpClient,
        @InjectQdrantEndpoint() private readonly endpoint: QdrantEndpoint,
    ) {}

    /** Whether the last call reached the service. */
    health(): VectorHealth {
        return this.reached ? "ok" : "down"
    }

    /**
     * Creates the collection of a kind and its payload indexes when they are missing; safe to repeat. A collection that exists with
     * another vector size or distance than the app embeds with is refused: nothing is created over it and nothing is compared with it.
     */
    async ensure(kind: VectorKind): Promise<void> {
        const collection = COLLECTION_OF[kind]
        const exists = await this.call("GET", `/collections/${collection}/exists`, undefined, "exists")
        const known = isRecord(exists) && isRecord(exists.result) && exists.result.exists === true
        if (known) await this.agree(collection)
        else await this.create(collection)
        await eachInOrder(PAYLOAD_INDEXES, async (index) => {
            await this.call(
                "PUT",
                `/collections/${collection}/index?wait=true`,
                { field_name: index.field, field_schema: index.schema },
                "index",
            )
        })
    }

    /** Stores points in place of the points of the same ids, in batches; the write is acknowledged before it returns. */
    async upsert(kind: VectorKind, points: ReadonlyArray<VectorPoint>): Promise<void> {
        await eachInOrder(startsOf(points.length, UPSERT_MAX), async (from) => {
            const batch = points.slice(from, from + UPSERT_MAX).map((point) => pointOf(point))
            await this.call("PUT", `/collections/${COLLECTION_OF[kind]}/points?wait=true`, { points: batch }, "upsert")
        })
    }

    /** Removes the points of these row ids inside one workspace: an id of another workspace is never touched. */
    async remove(kind: VectorKind, workspaceId: string, ids: ReadonlyArray<string>): Promise<void> {
        await eachInOrder(startsOf(ids.length, BATCH_MAX), async (from) => {
            const filter = ownedFilterOf(workspaceId, ids.slice(from, from + BATCH_MAX))
            await this.call("POST", `/collections/${COLLECTION_OF[kind]}/points/delete?wait=true`, { filter }, "delete")
        })
    }

    /** Rewrites the mirror of these points inside one workspace; their vectors stay. */
    async mark(kind: VectorKind, workspaceId: string, ids: ReadonlyArray<string>, flags: VectorFlags): Promise<void> {
        await eachInOrder(startsOf(ids.length, BATCH_MAX), async (from) => {
            const filter = ownedFilterOf(workspaceId, ids.slice(from, from + BATCH_MAX))
            await this.call(
                "POST",
                `/collections/${COLLECTION_OF[kind]}/points/payload?wait=true`,
                { payload: flagsOf(flags), filter },
                "payload",
            )
        })
    }

    /** The points nearest to a vector inside the scope, nearest first: ids and scores only. */
    async search(
        kind: VectorKind,
        scope: VectorScope,
        vector: ReadonlyArray<number>,
        page: VectorSearchPage,
    ): Promise<ReadonlyArray<VectorMatch>> {
        const body = await this.call(
            "POST",
            `/collections/${COLLECTION_OF[kind]}/points/query`,
            {
                query: [...vector],
                filter: filterOf(scope),
                limit: bounded(page.limit, SEARCH_MAX),
                offset: Math.max(0, Math.trunc(page.offset ?? 0)),
                with_payload: false,
                with_vector: false,
            },
            "query",
        )
        return matchesOf(body)
    }

    /** How many points the scope holds, exactly. */
    async count(kind: VectorKind, scope: VectorScope): Promise<number> {
        const body = await this.call(
            "POST",
            `/collections/${COLLECTION_OF[kind]}/points/count`,
            { filter: filterOf(scope), exact: true },
            "count",
        )
        return countOf(body)
    }

    /** One page of the stamps (the mirrors) of the points a filter names, in the index's order. */
    async stamps(kind: VectorKind, where: VectorStampFilter, page: VectorStampCursor): Promise<VectorStampPage> {
        const body = await this.call(
            "POST",
            `/collections/${COLLECTION_OF[kind]}/points/scroll`,
            {
                filter: stampFilterOf(where),
                limit: bounded(page.limit, BATCH_MAX),
                ...(page.after === null ? {} : { offset: page.after }),
                with_payload: true,
                with_vector: false,
            },
            "scroll",
        )
        return { points: stampsOf(body), next: nextOf(body) }
    }

    /** The stamps of the points of these row ids, read by id in batches; an id with no point is not answered. */
    async stampsOf(kind: VectorKind, ids: ReadonlyArray<string>): Promise<ReadonlyArray<VectorStamp>> {
        const found: Array<VectorStamp> = []
        await eachInOrder(startsOf(ids.length, BATCH_MAX), async (from) => {
            const body = await this.call(
                "POST",
                `/collections/${COLLECTION_OF[kind]}/points`,
                { ids: ids.slice(from, from + BATCH_MAX), with_payload: true, with_vector: false },
                "retrieve",
            )
            found.push(...stampsOf(body))
        })
        return found
    }

    /** The vectors of these points of one workspace, by id. */
    async vectorsOf(
        kind: VectorKind,
        workspaceId: string,
        ids: ReadonlyArray<string>,
    ): Promise<ReadonlyMap<string, ReadonlyArray<number>>> {
        if (ids.length === 0) return new Map()
        const body = await this.call(
            "POST",
            `/collections/${COLLECTION_OF[kind]}/points/scroll`,
            {
                filter: ownedFilterOf(workspaceId, ids.slice(0, BATCH_MAX)),
                limit: bounded(ids.length, BATCH_MAX),
                with_payload: false,
                with_vector: true,
            },
            "vectors",
        )
        return vectorsOf(body)
    }

    /**
     * Creates a collection. Another process of the app (api and mcp boot together) may create it between the `exists` read and this
     * call: Qdrant then answers 409, which is the outcome this call wanted, so the collection is checked like one that already existed
     * (`agree`) and a real mismatch still refuses the start. Every other status outside 2xx is `QDRANT_REJECTED`.
     */
    private async create(collection: string): Promise<void> {
        const answer = await this.send("PUT", `/collections/${collection}`, {
            vectors: { size: this.endpoint.dimensions, distance: DISTANCE },
            on_disk_payload: true,
        })
        if (answer.status === CONFLICT) {
            await this.agree(collection)
            return
        }
        this.accepted(answer.status, "create")
    }

    /** Refuses a collection whose vectors the app's could not be compared with: another size, another distance, or a shape it does not name. */
    private async agree(collection: string): Promise<void> {
        const shape = shapeOf(await this.call("GET", `/collections/${collection}`, undefined, "describe"))
        if (shape !== null && shape.size === this.endpoint.dimensions && shape.distance === DISTANCE) return
        throw new QdrantError({
            code: QdrantErrorCode.Mismatch,
            params: {
                collection,
                expected: `${String(this.endpoint.dimensions)} ${DISTANCE}`,
                found: shape === null ? "unknown" : `${String(shape.size)} ${shape.distance}`,
            },
        })
    }

    /** One call of the REST API; a network failure is `QDRANT_UNAVAILABLE`, any status outside 2xx `QDRANT_REJECTED`. */
    private async call(method: HttpRequest["method"], path: string, body: unknown, call: string): Promise<unknown> {
        const answer = await this.send(method, path, body)
        this.accepted(answer.status, call)
        return answer.body
    }

    /** Refuses a status outside 2xx as `QDRANT_REJECTED`, naming the call. */
    private accepted(status: number, call: string): void {
        if (status < 200 || status >= 300) {
            throw new QdrantError({ code: QdrantErrorCode.Rejected, params: { call, status: String(status) } })
        }
    }

    /** One request of the REST API with its status as Qdrant answered it; a network failure is `QDRANT_UNAVAILABLE`. */
    private async send(method: HttpRequest["method"], path: string, body: unknown): Promise<HttpResponse> {
        const { apiKey } = this.endpoint
        const answer = await this.http
            .request({
                method,
                url: `${this.endpoint.url}${path}`,
                ...(body === undefined ? {} : { body }),
                ...(apiKey === null ? {} : { headers: { "api-key": apiKey.reveal() } }),
                timeoutMs: this.endpoint.timeoutMs,
            })
            .catch((cause: unknown) => {
                this.reached = false
                throw new QdrantError({ code: QdrantErrorCode.Unavailable, cause })
            })
        this.reached = true
        return answer
    }
}
