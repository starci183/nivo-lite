import { mock } from "@starci/jest-preset"
import { createMemoryObjectStorage } from "@starci/object-storage/testing"
import { defineEntity, field } from "@nivo-lite/agent-sdk/entity"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import type { EngineResult, EntitiesApi, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { BillingError, BillingErrorCode, EntitlementsService } from "@modules/domain/billing"
import { EntityEngineService, EntityPortsService } from "@modules/domain/entity-engine"
import type { RunIn, ScopedTx } from "@modules/domain/entity-engine"
import { ToolsError, ToolsErrorCode } from "@modules/domain/tools"
import type { ToolJson, NativeCaller } from "@modules/domain/tools"
import { RecordFileFetchService } from "@modules/domain/record-files/record-files-fetch.service"
import { RecordFilesService } from "@modules/domain/record-files"
import { StorageFilesService } from "@modules/integrations/object-storage/object-storage-files.service"
import { Secret } from "@modules/platform/config"
import type { Ids } from "@modules/platform/ids"
import type { Logger } from "@modules/platform/logging"
import type { RemoteFileAnswer, RemoteFiles } from "@modules/integrations/remote-files"
import { FILE_TOOL } from "./file-native.names.policy"
import { FILE_REFUSAL_CLASS } from "./file-native.policy"
import { FILE_GET_SCHEMA, FILE_URL_SECONDS_MAX } from "./file-native.schema"
import { FILE_MANIFEST, FileNativeService } from "./file-native.service"
import { RecordNativeService } from "./record-native.service"

/** The provider host names of these specs resolve to a public address; a spec that wants another answer says so. */
jest.mock("node:dns/promises", () => ({ lookup: jest.fn().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]) }))

/** A record type as a package declares it, with a file field: no code of its own in be. */
const RENDER = defineEntity({
    name: "fixture.render",
    dataKind: "fixture-render",
    fields: {
        title: field.text({ maxLength: 40 }),
        voice: field.file({ accept: ["audio/*"], maxBytes: 16 }),
        photos: field.file({ accept: ["image/png", "audio/*"], maxBytes: 16, many: true, max: 2 }),
    },
})
const SECRET = defineEntity({
    name: "fixture.secret",
    dataKind: "fixture-secret",
    fields: { scan: field.file({ accept: ["image/*"], maxBytes: 16 }) },
})

const WS_A = "11111111-1111-4111-8111-111111111111"
const WS_B = "22222222-2222-4222-8222-222222222222"
const RECORD = "0b9f1c2e-6d1a-4f0e-9a37-000000000001"
const AGENT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const AGENT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const STEP: NativeCaller = { agentId: AGENT_A, conversationId: null, graphStep: true, opKey: "run-1:step-1:d1" }
const OTHER_AGENT: NativeCaller = { agentId: AGENT_B, conversationId: null, graphStep: true, opKey: "run-2:step-1:d1" }

type Rows = Map<string, Map<string, RecordRow & { readonly entity: string; readonly agent: string | null }>>

/** The fake store shows a scope confined to one agent only that agent's rows, as the entity engine does. */
const entitiesOf = (rows: Rows, runIn: RunIn): EntitiesApi => {
    const held = (tx: ScopedTx) => rows.get(tx.workspaceId) ?? new Map()
    const of = (tx: ScopedTx) => new Map([...held(tx)].filter(([, row]) => tx.agent?.sees !== "own" || row.agent === tx.agent.id))
    const unsupported = (): Promise<EngineResult> => Promise.reject(new Error("not used"))
    return {
        get: (entity, id) => runIn((tx) => Promise.resolve((of(tx).get(id)?.entity === entity ? (of(tx).get(id) ?? null) : null))),
        list: () => Promise.reject(new Error("not used")),
        aggregate: () => Promise.reject(new Error("not used")),
        insert: unsupported,
        update: (entity, key, expected, values) =>
            runIn<EngineResult>((tx) => {
                const row = of(tx).get(key)
                if (row?.entity !== entity) return Promise.resolve({ ok: false, reason: "missing" })
                if (row.version !== expected) return Promise.resolve({ ok: false, reason: "stale" })
                const changed = { ...row, version: String(Number(row.version) + 1), data: { ...row.data, ...values } }
                held(tx).set(key, changed)
                return Promise.resolve({ ok: true, row: changed, version: changed.version })
            }),
        upsert: unsupported,
        ensure: unsupported,
        delete: unsupported,
        link: unsupported,
        unlink: unsupported,
    }
}

/** What a remote file read answers: the file the fake provider address serves. */
const SERVED: RemoteFileAnswer = {
    status: 200,
    contentType: "audio/mpeg",
    location: undefined,
    length: 3,
    bytes: Buffer.from([1, 2, 3]),
}

/** The file tools and the record tools over one fake store and the real record files on an in-memory object store. */
const build = (remoteBound = true) => {
    const rows: Rows = new Map([
        [
            WS_A,
            new Map([
                [
                    RECORD,
                    {
                        entity: RENDER.name,
                        id: RECORD,
                        workspaceId: WS_A,
                        agent: AGENT_A,
                        version: "1",
                        createdAt: "2026-11-13T00:00:00.000Z",
                        updatedAt: "2026-11-13T00:00:00.000Z",
                        data: { title: "a", voice: null, photos: [] } as Record<string, unknown>,
                    },
                ],
            ]),
        ],
        [WS_B, new Map()],
    ])
    const catalog: ReadonlyMap<string, EntityDefinition> = new Map<string, EntityDefinition>([
        [RENDER.name, RENDER],
        [SECRET.name, SECRET],
    ])
    const engine = mock<EntityEngineService>({ catalog })
    engine.scoped.mockImplementation((workspaceId, work, agent) => work(mock<ScopedTx>({ workspaceId, ...(agent === undefined ? {} : { agent }) })))
    const ports = mock<EntityPortsService>()
    ports.entitiesApi.mockImplementation((runIn) => entitiesOf(rows, runIn))
    const remote = mock<RemoteFiles>({ maxRedirects: 3 })
    remote.read.mockResolvedValue(SERVED)
    const memory = createMemoryObjectStorage()
    const storage = new StorageFilesService(
        memory,
        {
            endpoint: "https://minio.test",
            region: "us-east-1",
            accessKey: new Secret("a"),
            secretKey: new Secret("b"),
            bucketPrefix: "nivo",
            publicUrl: "https://minio.test",
            timeoutMs: 1000,
        },
        mock<Logger>(),
    )
    const entitlements = mock<EntitlementsService>()
    entitlements.requireStorageFor.mockResolvedValue(undefined)
    let next = 0
    const ids: Ids = {
        next: () => {
            next += 1
            return `5c1d3e2a-0f4b-4c6d-8e9f-${String(next).padStart(12, "0")}`
        },
    }
    const files = new RecordFilesService(storage, ids, mock<Logger>(), engine, ports, entitlements, new RecordFileFetchService(remoteBound ? remote : undefined))
    return {
        tools: new FileNativeService(engine, files),
        records: new RecordNativeService(engine, ports),
        files,
        entitlements,
        remote,
        rows,
        memory,
    }
}

const refusalOf = async (call: Promise<ToolJson>): Promise<unknown> => {
    try {
        await call
    } catch (cause) {
        if (cause instanceof ToolsError && cause.code === ToolsErrorCode.NativeRefused) return cause.params
        throw cause
    }
    throw new Error("the call was not refused")
}

describe("FileNativeService", () => {
    it("serves put and link as writes and get as a read under nivo.tool.file", () => {
        expect(FILE_MANIFEST.tools.map((tool) => [`${FILE_MANIFEST.namespace}.${tool.name}`, tool.scope])).toEqual([
            [FILE_TOOL.put, "write"],
            [FILE_TOOL.link, "write"],
            [FILE_TOOL.get, "read"],
        ])
        expect(FILE_MANIFEST.tools.map((tool) => tool.domain)).toEqual(Object.values(FILE_TOOL))
        expect(Object.values(FILE_REFUSAL_CLASS).filter((kind) => kind === "infrastructure")).toHaveLength(2)
    })

    it("puts a staged file on the record (the field now holds it), and get answers a short-lived signed address", async () => {
        const { tools, files, rows } = build()
        const staged = await files.stage(WS_A, new Uint8Array([1, 2, 3]), "audio/mpeg")

        const put = await tools.invoke(WS_A, "put", { type: RENDER.name, id: RECORD, field: "voice", staged, name: "voice.mp3" }, STEP)
        const file = {
            key: `${WS_A}/fixture.render/${RECORD}/voice/5c1d3e2a-0f4b-4c6d-8e9f-000000000002`,
            mime: "audio/mpeg",
            size: 3,
            name: "voice.mp3",
        }
        expect(put["file"]).toEqual(file)
        expect(rows.get(WS_A)?.get(RECORD)?.data["voice"]).toEqual(file)

        const got = await tools.invoke(WS_A, "get", { type: RENDER.name, id: RECORD, field: "voice", expiresInSeconds: 600 }, STEP)
        expect(got["file"]).toMatchObject({ name: "voice.mp3", mime: "audio/mpeg", size: 3 })
    })

    it("puts the file a provider result address serves, fetched server-side within the field's limits", async () => {
        const { tools, remote, rows } = build()

        const put = await tools.invoke(
            WS_A,
            "put",
            { type: RENDER.name, id: RECORD, field: "voice", url: "https://cdn.provider.test/out/voice.mp3", name: "voice.mp3" },
            STEP,
        )

        expect(remote.read).toHaveBeenCalledWith(expect.objectContaining({ url: "https://cdn.provider.test/out/voice.mp3", maxBytes: 16 }))
        expect(put["file"]).toMatchObject({ mime: "audio/mpeg", size: 3, name: "voice.mp3" })
        expect(rows.get(WS_A)?.get(RECORD)?.data["voice"]).toEqual(put["file"])
    })

    it("refuses a put that gives both a staged file and an address, or neither", async () => {
        const { tools } = build()
        const base = { type: RENDER.name, id: RECORD, field: "voice", name: "v" }

        await expect(tools.invoke(WS_A, "put", base, STEP)).rejects.toThrow()
        await expect(
            tools.invoke(WS_A, "put", { ...base, staged: `${WS_A}/staged/5c1d3e2a-0f4b-4c6d-8e9f-0000000000aa`, url: "https://a.test/x" }, STEP),
        ).rejects.toThrow()
    })

    it("refuses an address that is not public https, one that answers the wrong type, and one too big", async () => {
        const { tools, remote } = build()
        const put = (url: string) =>
            refusalOf(tools.invoke(WS_A, "put", { type: RENDER.name, id: RECORD, field: "voice", url, name: "v" }, STEP))

        await expect(put("http://cdn.provider.test/a.mp3")).resolves.toMatchObject({ reason: "url_invalid" })
        await expect(put("https://127.0.0.1/a.mp3")).resolves.toMatchObject({ reason: "url_invalid" })
        await expect(put("https://user:pw@cdn.provider.test/a.mp3")).resolves.toMatchObject({ reason: "url_invalid" })
        remote.read.mockResolvedValueOnce({ ...SERVED, contentType: "video/mp4", bytes: null })
        await expect(put("https://cdn.provider.test/a.mp4")).resolves.toMatchObject({ reason: "mime_not_accepted" })
        remote.read.mockResolvedValueOnce({ ...SERVED, length: 99, bytes: null })
        await expect(put("https://cdn.provider.test/big.mp3")).resolves.toMatchObject({ reason: "too_big" })
        remote.read.mockResolvedValueOnce({ ...SERVED, status: 404, bytes: null, length: 0 })
        await expect(put("https://cdn.provider.test/gone.mp3")).resolves.toMatchObject({ reason: "url_unreachable" })
    })

    it("attaches a staged file with link, and the file the field held before leaves the store", async () => {
        const { tools, files, rows, memory } = build()
        const first = await files.stage(WS_A, new Uint8Array([1]), "audio/mpeg")
        const second = await files.stage(WS_A, new Uint8Array([1, 2]), "audio/mpeg")
        const link = (key: string, name: string) =>
            tools.invoke(WS_A, "link", { type: RENDER.name, id: RECORD, field: "voice", key, name }, STEP)

        const one = await link(first, "a.mp3")
        const two = await link(second, "b.mp3")

        expect(rows.get(WS_A)?.get(RECORD)?.data["voice"]).toEqual(two["file"])
        const stored = memory.store.buckets.get("nivo-records")
        expect(stored?.has((one["file"] as { key: string }).key)).toBe(false)
        expect(stored?.has((two["file"] as { key: string }).key)).toBe(true)
    })

    it("refuses a type no package declares, before any store is read", async () => {
        const { tools } = build()

        await expect(refusalOf(tools.invoke(WS_A, "get", { type: "fixture.ghost", id: RECORD, field: "voice" }, STEP))).resolves.toEqual({
            reason: "type_unknown",
            refusalClass: "business",
        })
    })

    it("reaches a file only through a record of the calling agent: another agent's record is not_found for put, link and get", async () => {
        const { tools, files, rows } = build()
        const staged = await files.stage(WS_A, new Uint8Array([1]), "audio/mpeg")

        await expect(
            refusalOf(tools.invoke(WS_A, "put", { type: RENDER.name, id: RECORD, field: "voice", staged, name: "v" }, OTHER_AGENT)),
        ).resolves.toEqual({ reason: "not_found", refusalClass: "business" })
        await expect(
            refusalOf(tools.invoke(WS_A, "link", { type: RENDER.name, id: RECORD, field: "voice", key: staged, name: "v" }, OTHER_AGENT)),
        ).resolves.toMatchObject({ reason: "not_found" })
        await expect(
            refusalOf(tools.invoke(WS_A, "get", { type: RENDER.name, id: RECORD, field: "voice" }, OTHER_AGENT)),
        ).resolves.toMatchObject({ reason: "not_found" })
        expect(rows.get(WS_A)?.get(RECORD)?.data["voice"]).toBeNull()
        await expect(refusalOf(tools.invoke(WS_A, "get", { type: RENDER.name, id: RECORD, field: "voice" }, STEP))).resolves.toMatchObject({
            reason: "no_file",
        })
    })

    it("refuses an undeclared field, a wrong type, a file too big, another workspace's record or staged file", async () => {
        const { tools, files } = build()
        const put = (args: Record<string, unknown>, workspaceId = WS_A) =>
            refusalOf(tools.invoke(workspaceId, "put", { type: RENDER.name, id: RECORD, field: "voice", name: "v", ...args } as ToolJson, STEP))

        const audio = await files.stage(WS_A, new Uint8Array([1]), "audio/mpeg")
        await expect(put({ staged: audio, field: "title" })).resolves.toMatchObject({ reason: "field_not_file" })
        const picture = await files.stage(WS_A, new Uint8Array([1]), "image/png")
        await expect(put({ staged: picture })).resolves.toMatchObject({ reason: "mime_not_accepted" })
        const big = await files.stage(WS_A, new Uint8Array(17), "audio/mpeg")
        await expect(put({ staged: big })).resolves.toMatchObject({ reason: "too_big" })
        await expect(put({ staged: audio }, WS_B)).resolves.toMatchObject({ reason: "not_found" })
        const foreign = await files.stage(WS_B, new Uint8Array([1]), "audio/mpeg")
        await expect(put({ staged: foreign })).resolves.toMatchObject({ reason: "key_invalid" })
        await expect(put({ staged: `${WS_A}/staged/5c1d3e2a-0f4b-4c6d-8e9f-0000000000ee` })).resolves.toMatchObject({
            reason: "object_missing",
        })
    })

    it("refuses a link key that is another record's object or a forged key", async () => {
        const { tools } = build()
        const link = (key: string) =>
            refusalOf(tools.invoke(WS_A, "link", { type: RENDER.name, id: RECORD, field: "voice", key, name: "v" }, STEP))

        await expect(link(`${WS_A}/fixture.render/0b9f1c2e-6d1a-4f0e-9a37-000000000002/voice/5c1d3e2a-0f4b-4c6d-8e9f-000000000001`)).resolves.toMatchObject({
            reason: "key_invalid",
        })
        await expect(link(`${WS_B}/fixture.render/${RECORD}/voice/5c1d3e2a-0f4b-4c6d-8e9f-000000000001`)).resolves.toMatchObject({
            reason: "key_invalid",
        })
        await expect(link(`${WS_A}/fixture.render/${RECORD}/voice/5c1d3e2a-0f4b-4c6d-8e9f-000000000001`)).resolves.toMatchObject({
            reason: "object_missing",
        })
    })

    it("refuses a full plan as quota_exceeded, by the plan's own storage check", async () => {
        const { tools, files, entitlements } = build()
        const staged = await files.stage(WS_A, new Uint8Array([1]), "audio/mpeg")
        entitlements.requireStorageFor.mockRejectedValue(new BillingError({ code: BillingErrorCode.StorageQuotaExceeded }))

        await expect(
            refusalOf(tools.invoke(WS_A, "put", { type: RENDER.name, id: RECORD, field: "voice", staged, name: "v" }, STEP)),
        ).resolves.toEqual({ reason: "quota_exceeded", refusalClass: "business" })
    })

    it("serves nothing where no file store is bound, and refuses a workspaceId argument", async () => {
        const tools = new FileNativeService(mock<EntityEngineService>(), undefined)
        await expect(refusalOf(tools.invoke(WS_A, "get", { type: RENDER.name, id: RECORD, field: "voice" }, STEP))).resolves.toEqual({
            reason: "not_served",
            refusalClass: "infrastructure",
        })
        const { tools: served } = build()
        await expect(
            served.invoke(WS_A, "get", { type: RENDER.name, id: RECORD, field: "voice", workspaceId: WS_B }, STEP),
        ).rejects.toThrow()
    })

    it("answers not_served for a put by address in an app that binds no reader of remote files", async () => {
        const { tools } = build(false)

        await expect(
            refusalOf(tools.invoke(WS_A, "put", { type: RENDER.name, id: RECORD, field: "voice", url: "https://a.test/x.mp3", name: "v" }, STEP)),
        ).resolves.toEqual({ reason: "not_served", refusalClass: "infrastructure" })
    })
})

/** The lifetime in seconds the signed address was asked for (the in-memory store writes it in the address). */
const lifeOf = (answer: ToolJson): number => {
    const file = answer["file"] as { readonly url: string }
    return Number(new URL(file.url).searchParams.get("X-Test-Expires"))
}

describe("nivo.tool.file.get: how long the address lives", () => {
    const GET = { type: RENDER.name, id: RECORD, field: "voice" }

    const stored = async (built: ReturnType<typeof build>): Promise<void> => {
        const staged = await built.files.stage(WS_A, new Uint8Array([1, 2, 3]), "audio/mpeg")
        await built.tools.invoke(WS_A, "put", { ...GET, staged, name: "voice.mp3" }, STEP)
    }

    it("is one hour when the caller asks for nothing, and seven days when the caller asks for them", async () => {
        const built = build()
        await stored(built)

        expect(lifeOf(await built.tools.invoke(WS_A, "get", GET, STEP))).toBe(3600)
        expect(FILE_URL_SECONDS_MAX).toBe(604_800)
        const week = await built.tools.invoke(WS_A, "get", { ...GET, expiresInSeconds: 604_800 }, STEP)
        expect(lifeOf(week)).toBe(604_800)
        const short = await built.tools.invoke(WS_A, "get", { ...GET, expiresInSeconds: 1 }, STEP)
        expect(lifeOf(short)).toBe(1)
    })

    it("refuses a lifetime over seven days, zero, negative or fractional, and the old name of the argument", () => {
        const base = { type: RENDER.name, id: RECORD, field: "voice" }
        expect(FILE_GET_SCHEMA.safeParse({ ...base, expiresInSeconds: 604_800 }).success).toBe(true)
        expect(FILE_GET_SCHEMA.safeParse({ ...base, expiresInSeconds: 1 }).success).toBe(true)
        for (const bad of [604_801, 0, -1, 1.5, "3600"]) {
            expect(FILE_GET_SCHEMA.safeParse({ ...base, expiresInSeconds: bad }).success).toBe(false)
        }
        expect(FILE_GET_SCHEMA.safeParse({ ...base, seconds: 600 }).success).toBe(false)
    })
})

describe("nivo.tool.file: a list field", () => {
    const LIST = { type: RENDER.name, id: RECORD, field: "photos" }

    const staged = (built: ReturnType<typeof build>, mime = "image/png") => built.files.stage(WS_A, new Uint8Array([1, 2, 3]), mime)

    it("put appends in order, get names one file by its key, and a full list is the typed refusal list_full", async () => {
        const built = build()
        const one = await built.tools.invoke(WS_A, "put", { ...LIST, staged: await staged(built), name: "one.png" }, STEP)
        const two = await built.tools.invoke(WS_A, "put", { ...LIST, staged: await staged(built), name: "two.png" }, STEP)
        const first = one["file"] as { readonly key: string }
        const second = two["file"] as { readonly key: string }

        expect((built.rows.get(WS_A)?.get(RECORD)?.data["photos"] as ReadonlyArray<{ readonly key: string }>).map((ref) => ref.key)).toEqual([
            first.key,
            second.key,
        ])
        expect((await built.tools.invoke(WS_A, "get", { ...LIST, key: second.key }, STEP))["file"]).toMatchObject({ name: "two.png" })
        expect(await refusalOf(built.tools.invoke(WS_A, "get", LIST, STEP))).toMatchObject({ reason: "key_required" })
        expect(await refusalOf(built.tools.invoke(WS_A, "get", { ...LIST, key: `${first.key}0` }, STEP))).toMatchObject({ reason: "no_file" })
        expect(await refusalOf(built.tools.invoke(WS_A, "put", { ...LIST, staged: await staged(built), name: "three.png" }, STEP))).toMatchObject({
            reason: "list_full",
        })
        expect(await refusalOf(built.tools.invoke(WS_A, "put", { ...LIST, url: "https://cdn.provider.test/a.mp3", name: "a" }, STEP))).toMatchObject({
            reason: "list_full",
        })
    })

    it("put with replaces takes the place of the named file, at its position", async () => {
        const built = build()
        const one = (await built.tools.invoke(WS_A, "put", { ...LIST, staged: await staged(built), name: "one.png" }, STEP))["file"] as { readonly key: string }
        await built.tools.invoke(WS_A, "put", { ...LIST, staged: await staged(built), name: "two.png" }, STEP)

        await built.tools.invoke(WS_A, "put", { ...LIST, staged: await staged(built), name: "fresh.png", replaces: one.key }, STEP)

        expect((built.rows.get(WS_A)?.get(RECORD)?.data["photos"] as ReadonlyArray<{ readonly name: string }>).map((ref) => ref.name)).toEqual([
            "fresh.png",
            "two.png",
        ])
    })

    it("answers the list field's records to the calling agent only", async () => {
        const built = build()
        expect(await refusalOf(built.tools.invoke(WS_A, "put", { ...LIST, staged: await staged(built), name: "x.png" }, OTHER_AGENT))).toMatchObject({
            reason: "not_found",
        })
    })
})
