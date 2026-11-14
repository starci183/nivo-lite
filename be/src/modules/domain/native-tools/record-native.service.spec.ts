import { mock } from "@starci/jest-preset"
import { defineEntity, field } from "@nivo-lite/agent-sdk/entity"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import type { EngineResult, EntitiesApi, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { Query } from "@nivo-lite/agent-sdk/query"
import { EntityEngineService, EntityPortsService } from "@modules/domain/entity-engine"
import type { RunIn, ScopedTx } from "@modules/domain/entity-engine"
import { EntityEngineError, EntityEngineErrorCode } from "@modules/domain/entity-engine/errors/entity-engine.error"
import { ToolsError, ToolsErrorCode } from "@modules/domain/tools"
import type { ToolJson, NativeCaller } from "@modules/domain/tools"
import { RECORD_TOOL } from "./record-native.names.policy"
import { RECORD_MANIFEST, RecordNativeService } from "./record-native.service"

/** A record type as a package declares it, with no code of its own in be. */
const PROJECT = defineEntity({
    name: "fixture.project",
    dataKind: "fixture-project",
    fields: {
        title: field.text({ maxLength: 40 }),
        status: field.enum({ of: ["draft", "done"], default: { literal: "draft" } }),
    },
    indexes: [{ name: "status_created", on: ["status", { desc: "createdAt" }, { desc: "id" }] }],
    constraints: [{ kind: "unique", name: "title_unique", on: ["title"], refusal: "taken" }],
})

/** A second declared type: the same tools serve every declared type. */
const SECRET = defineEntity({
    name: "fixture.secret",
    dataKind: "fixture-secret",
    fields: { note: field.text({ maxLength: 40 }) },
    indexes: [{ name: "by_id", on: ["id"] }],
})

/** A type whose records REQUIRE a relation to a record of another declared type (as a line requires its thread), declared with no code in be. */
const NOTE = defineEntity({
    name: "fixture.note",
    dataKind: "fixture-note",
    fields: { body: field.text({ maxLength: 40 }) },
    relations: {
        project: { kind: "toOne", target: PROJECT.name, required: true },
        other: { kind: "toOne", target: PROJECT.name },
    },
    indexes: [{ name: "by_id", on: ["id"] }],
})

const WS_A = "11111111-1111-4111-8111-111111111111"
const WS_B = "22222222-2222-4222-8222-222222222222"
const AGENT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const AGENT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const STEP: NativeCaller = { agentId: AGENT_A, conversationId: null, graphStep: true, opKey: "run-1:step-1:d1" }
const OTHER_AGENT: NativeCaller = { agentId: AGENT_B, conversationId: null, graphStep: true, opKey: "run-2:step-1:d1" }

/**
 * The records the fake store holds, by workspace then id: what the engine's scope (row-level security on `app_engine`) shows a
 * transaction entered for one workspace, and nothing of another. A row carries the agent the engine stamped on it.
 */
type Rows = Map<string, Map<string, RecordRow & { readonly entity: string; readonly agent: string | null }>>

/**
 * An in-memory `EntitiesApi` over `rows`: each call reads the workspace and the agent scope of the transaction it is run in, never an
 * argument, as the entity engine does (an insert is stamped with the scope's agent; a scope that sees `own` reaches only its agent's rows).
 */
const entitiesOf = (
    rows: Rows,
    runIn: RunIn,
    queries: Array<Query>,
    linked: Array<{ readonly entity: string; readonly links: Readonly<Record<string, string>> }>,
): EntitiesApi => {
    const of = (tx: ScopedTx) => {
        const held = rows.get(tx.workspaceId) ?? new Map<string, RecordRow & { readonly entity: string; readonly agent: string | null }>()
        rows.set(tx.workspaceId, held)
        return new Map([...held].filter(([, row]) => tx.agent?.sees !== "own" || row.agent === tx.agent.id))
    }
    const store = (tx: ScopedTx) => rows.get(tx.workspaceId) ?? new Map<string, RecordRow & { readonly entity: string; readonly agent: string | null }>()
    const unsupported = (): Promise<EngineResult> => Promise.reject(new Error("not used by the record tools"))
    return {
        get: (entity, id) =>
            runIn((tx) => {
                const row = of(tx).get(id)
                return Promise.resolve(row?.entity === entity ? row : null)
            }),
        list: (query) =>
            runIn((tx) => {
                queries.push(query)
                if (query.page.after === "forged") return Promise.reject(new EntityEngineError({ code: EntityEngineErrorCode.CursorInvalid }))
                const found = [...of(tx).values()].filter((row) => row.entity === query.from)
                return Promise.resolve({ rows: found.slice(0, query.page.size).map((row) => ({ row, joined: {}, position: [], included: {} })), next: null })
            }),
        aggregate: () => Promise.reject(new Error("not used by the record tools")),
        insert: (entity, values, links) =>
            runIn<EngineResult>((tx) => {
                if (links !== undefined) linked.push({ entity, links })
                const held = store(tx)
                rows.set(tx.workspaceId, held)
                if ([...held.values()].some((row) => row.entity === entity && row.data["title"] === values["title"])) {
                    return Promise.resolve({ ok: false, reason: "taken", constraint: "title_unique", refusal: "taken" })
                }
                const id = `0b9f1c2e-6d1a-4f0e-9a37-${String(held.size + 1).padStart(12, "0")}`
                const row = {
                    entity,
                    id,
                    workspaceId: tx.workspaceId,
                    agent: tx.agent?.id ?? null,
                    version: "1",
                    createdAt: "2026-11-13T00:00:00.000Z",
                    updatedAt: "2026-11-13T00:00:00.000Z",
                    data: { status: "draft", ...values },
                }
                held.set(id, row)
                return Promise.resolve({ ok: true, row, version: row.version })
            }),
        update: (entity, key, expected, values) =>
            runIn<EngineResult>((tx) => {
                const row = of(tx).get(key)
                if (row?.entity !== entity) return Promise.resolve({ ok: false, reason: "missing" })
                if (row.version !== expected) return Promise.resolve({ ok: false, reason: "stale" })
                const changed = { ...row, version: String(Number(row.version) + 1), data: { ...row.data, ...values } }
                store(tx).set(key, changed)
                return Promise.resolve({ ok: true, row: changed, version: changed.version })
            }),
        upsert: unsupported,
        ensure: unsupported,
        delete: unsupported,
        link: unsupported,
        unlink: unsupported,
    }
}

/** The record tools over a fake store holding the two types. */
const build = (served = true) => {
    const rows: Rows = new Map()
    const queries: Array<Query> = []
    const linked: Array<{ readonly entity: string; readonly links: Readonly<Record<string, string>> }> = []
    const catalog: ReadonlyMap<string, EntityDefinition> = new Map<string, EntityDefinition>([
        [PROJECT.name, PROJECT],
        [SECRET.name, SECRET],
        [NOTE.name, NOTE],
    ])
    const engine = mock<EntityEngineService>({ catalog })
    engine.scoped.mockImplementation((workspaceId, work, agent) => work(mock<ScopedTx>({ workspaceId, ...(agent === undefined ? {} : { agent }) })))
    const ports = mock<EntityPortsService>()
    ports.entitiesApi.mockImplementation((runIn) => entitiesOf(rows, runIn, queries, linked))
    const service = served ? new RecordNativeService(engine, ports) : new RecordNativeService()
    return { service, rows, queries, linked, engine, ports }
}

/** The reason of the native refusal a call threw. */
const refusalOf = async (call: Promise<ToolJson>): Promise<unknown> => {
    try {
        await call
    } catch (cause) {
        if (cause instanceof ToolsError && cause.code === ToolsErrorCode.NativeRefused) return cause.params
        throw cause
    }
    throw new Error("the call was not refused")
}

/** The record a call answered, as far as this proof reads it. */
interface AnsweredRecord {
    readonly id: string
    readonly version: string
    readonly values: Record<string, unknown>
}

/** The record a call answered. */
const recordOf = (answer: ToolJson): AnsweredRecord => {
    const record: unknown = answer["record"]
    if (typeof record !== "object" || record === null) throw new Error("no record answered")
    return record as { readonly id: string; readonly version: string; readonly values: Record<string, unknown> }
}

describe("RecordNativeService", () => {
    it("serves the four record tools under nivo.tool.record, reads as reads and writes as writes under the gateway's receipt", () => {
        expect(RECORD_MANIFEST.tools.map((tool) => [`${RECORD_MANIFEST.namespace}.${tool.name}`, tool.scope, tool.ledgered])).toEqual([
            [RECORD_TOOL.get, "read", undefined],
            [RECORD_TOOL.list, "read", undefined],
            [RECORD_TOOL.create, "write", undefined],
            [RECORD_TOOL.update, "write", undefined],
        ])
        expect(RECORD_MANIFEST.tools.map((tool) => tool.domain)).toEqual(Object.values(RECORD_TOOL))
    })

    it("creates, gets, updates and lists a record of a declared type with no code of the type", async () => {
        const { service, engine, queries } = build()
        const created = recordOf(await service.invoke(WS_A, "create", { type: PROJECT.name, values: { title: "Spring promo" } }, STEP))
        expect(created.values).toEqual({ status: "draft", title: "Spring promo" })
        const got = recordOf(await service.invoke(WS_A, "get", { type: PROJECT.name, id: created.id }, STEP))
        expect(got).toEqual(created)
        const updated = recordOf(
            await service.invoke(WS_A, "update", { type: PROJECT.name, id: created.id, patch: { status: "done" } }, STEP),
        )
        expect(updated).toMatchObject({ id: created.id, version: "2", values: { title: "Spring promo", status: "done" } })
        const listed = await service.invoke(WS_A, "list", { type: PROJECT.name, where: { op: "eq", field: "status", value: "done" } }, STEP)
        expect(listed).toEqual({ records: [updated], next: null })
        expect(queries[0]?.order).toEqual([
            ["status", "asc"],
            ["createdAt", "desc"],
            ["id", "desc"],
        ])
        expect(engine.scoped.mock.calls.every(([workspaceId]) => workspaceId === WS_A)).toBe(true)
    })

    it("refuses a type no package declares as type_unknown, before any store is read", async () => {
        const { service, engine } = build()
        await expect(refusalOf(service.invoke(WS_A, "get", { type: "fixture.ghost", id: "x" }, STEP))).resolves.toEqual({
            reason: "type_unknown",
            refusalClass: "business",
        })
        expect(engine.scoped).not.toHaveBeenCalled()
    })

    it("stamps the calling agent on a create; a write runs in a scope confined to that agent's own records and a read in the whole workspace", async () => {
        const { service, rows, engine } = build()
        const created = recordOf(await service.invoke(WS_A, "create", { type: PROJECT.name, values: { title: "mine" } }, STEP))
        expect([...(rows.get(WS_A)?.values() ?? [])].map((row) => [row.id, row.agent])).toEqual([[created.id, AGENT_A]])
        await service.invoke(WS_A, "get", { type: PROJECT.name, id: created.id }, OTHER_AGENT)
            .catch(() => undefined)
        expect(engine.scoped.mock.calls.map(([workspaceId, , agent]) => [workspaceId, agent])).toEqual([
            [WS_A, { id: AGENT_A, sees: "own" }],
            [WS_A, { id: AGENT_B, sees: "all" }],
        ])
    })

    it("reads another agent's record with get and list, and refuses an update of it as not_found (the same answer as another workspace's)", async () => {
        const { service, rows } = build()
        const mine = recordOf(await service.invoke(WS_A, "create", { type: PROJECT.name, values: { title: "mine" } }, STEP))
        const theirs = recordOf(await service.invoke(WS_A, "create", { type: PROJECT.name, values: { title: "theirs" } }, OTHER_AGENT))
        expect(recordOf(await service.invoke(WS_A, "get", { type: PROJECT.name, id: theirs.id }, STEP)).id).toBe(theirs.id)
        await expect(
            refusalOf(service.invoke(WS_A, "update", { type: PROJECT.name, id: theirs.id, patch: { status: "done" } }, STEP)),
        ).resolves.toMatchObject({ reason: "not_found" })
        expect(rows.get(WS_A)?.get(theirs.id)?.data["status"]).toBe("draft")
        const listed = await service.invoke(WS_A, "list", { type: PROJECT.name, where: { op: "eq", field: "status", value: "draft" } }, STEP)
        expect(listed).toEqual({ records: [mine, theirs], next: null })
        expect(recordOf(await service.invoke(WS_A, "get", { type: PROJECT.name, id: theirs.id }, OTHER_AGENT)).id).toBe(theirs.id)
    })

    it("serves nothing where no entity engine is bound", async () => {
        const { service } = build(false)
        await expect(refusalOf(service.invoke(WS_A, "get", { type: PROJECT.name, id: "x" }, STEP))).resolves.toEqual({
            reason: "not_served",
            refusalClass: "infrastructure",
        })
    })

    it("refuses values the type's own declaration does not take, and a unique value another record holds", async () => {
        const { service } = build()
        await expect(
            refusalOf(service.invoke(WS_A, "create", { type: PROJECT.name, values: { title: "a", status: "archived" } }, STEP)),
        ).resolves.toMatchObject({ reason: "invalid_value" })
        await expect(refusalOf(service.invoke(WS_A, "create", { type: PROJECT.name, values: {} }, STEP))).resolves.toMatchObject({
            reason: "invalid_value",
        })
        await service.invoke(WS_A, "create", { type: PROJECT.name, values: { title: "same" } }, STEP)
        await expect(
            refusalOf(service.invoke(WS_A, "create", { type: PROJECT.name, values: { title: "same" } }, STEP)),
        ).resolves.toMatchObject({ reason: "taken" })
    })

    it("answers a record of another workspace not_found, whatever id the call names", async () => {
        const { service } = build()
        const created = recordOf(await service.invoke(WS_A, "create", { type: PROJECT.name, values: { title: "mine" } }, STEP))
        await expect(refusalOf(service.invoke(WS_B, "get", { type: PROJECT.name, id: created.id }, STEP))).resolves.toEqual({
            reason: "not_found",
            refusalClass: "business",
        })
        await expect(
            refusalOf(service.invoke(WS_B, "update", { type: PROJECT.name, id: created.id, patch: { status: "done" } }, STEP)),
        ).resolves.toMatchObject({ reason: "not_found" })
        await expect(refusalOf(service.invoke(WS_A, "get", { type: PROJECT.name, id: "not-an-id" }, STEP))).resolves.toMatchObject({
            reason: "not_found",
        })
        expect(await service.invoke(WS_B, "list", { type: PROJECT.name, where: { op: "eq", field: "status", value: "draft" } }, STEP)).toEqual({
            records: [],
            next: null,
        })
    })

    it("takes no workspace from the arguments", async () => {
        const { service } = build()
        await expect(
            service.invoke(WS_A, "get", { type: PROJECT.name, id: "x", workspaceId: WS_B }, STEP),
        ).rejects.toMatchObject({ code: ToolsErrorCode.InvalidArguments })
        await expect(
            refusalOf(service.invoke(WS_A, "create", { type: PROJECT.name, values: { title: "a", workspaceId: WS_B } }, STEP)),
        ).resolves.toMatchObject({ reason: "invalid_value" })
    })

    it("refuses an update at a version the record moved past as stale", async () => {
        const { service } = build()
        const created = recordOf(await service.invoke(WS_A, "create", { type: PROJECT.name, values: { title: "v" } }, STEP))
        await service.invoke(WS_A, "update", { type: PROJECT.name, id: created.id, patch: { status: "done" } }, STEP)
        await expect(
            refusalOf(
                service.invoke(WS_A, "update", { type: PROJECT.name, id: created.id, patch: { title: "w" }, version: created.version }, STEP),
            ),
        ).resolves.toMatchObject({ reason: "stale" })
    })

    it("refuses a list no declared index serves, and a cursor the engine does not take, as facts the agent can act on", async () => {
        const { service } = build()
        await expect(
            refusalOf(service.invoke(WS_A, "list", { type: PROJECT.name, order: [["title", "desc"], ["status", "asc"]] }, STEP)),
        ).resolves.toEqual({ reason: "query_not_indexed", refusalClass: "business" })
        await expect(
            refusalOf(service.invoke(WS_A, "list", { type: PROJECT.name, cursor: "forged", where: { op: "eq", field: "status", value: "draft" } }, STEP)),
        ).resolves.toEqual({ reason: "query_invalid", refusalClass: "business" })
    })

    it("creates a record whose type requires a relation with `links`, to a record of the caller's own, and refuses the other cases", async () => {
        const { service, linked } = build()
        const project = recordOf(await service.invoke(WS_A, "create", { type: PROJECT.name, values: { title: "thread" } }, STEP))
        const theirs = recordOf(await service.invoke(WS_A, "create", { type: PROJECT.name, values: { title: "theirs" } }, OTHER_AGENT))
        const note = recordOf(
            await service.invoke(WS_A, "create", { type: NOTE.name, values: { body: "hello" }, links: { project: project.id } }, STEP),
        )
        expect(note.values).toMatchObject({ body: "hello" })
        expect(linked).toEqual([{ entity: NOTE.name, links: { project: project.id } }])
        // The type requires the relation: a create that names none is refused before any write.
        await expect(refusalOf(service.invoke(WS_A, "create", { type: NOTE.name, values: { body: "x" } }, STEP))).resolves.toMatchObject({
            reason: "invalid_value",
        })
        // A relation the type does not declare, and a target that is no record id.
        await expect(
            refusalOf(service.invoke(WS_A, "create", { type: NOTE.name, values: { body: "x" }, links: { project: project.id, nope: project.id } }, STEP)),
        ).resolves.toMatchObject({ reason: "invalid_value" })
        await expect(
            service.invoke(WS_A, "create", { type: NOTE.name, values: { body: "x" }, links: { project: "" } }, STEP),
        ).rejects.toMatchObject({ code: ToolsErrorCode.InvalidArguments })
        // A target of another agent, and one that does not exist, are `invalid_value`: nothing is written.
        await expect(
            refusalOf(service.invoke(WS_A, "create", { type: NOTE.name, values: { body: "x" }, links: { project: theirs.id } }, STEP)),
        ).resolves.toMatchObject({ reason: "invalid_value" })
        await expect(
            refusalOf(
                service.invoke(WS_A, "create", { type: NOTE.name, values: { body: "x" }, links: { project: "0b9f1c2e-6d1a-4f0e-9a37-999999999999" } }, STEP),
            ),
        ).resolves.toMatchObject({ reason: "invalid_value" })
        expect(linked).toHaveLength(1)
    })

    it("caps a page at fifty records", async () => {
        const { service } = build()
        await expect(service.invoke(WS_A, "list", { type: PROJECT.name, limit: 51 }, STEP)).rejects.toMatchObject({
            code: ToolsErrorCode.InvalidArguments,
        })
    })
})
