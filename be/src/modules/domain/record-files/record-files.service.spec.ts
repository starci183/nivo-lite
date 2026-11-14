import type { LookupAddress } from "node:dns"
import { lookup } from "node:dns/promises"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { createMemoryObjectStorage, type MemoryObjectStorage } from "@starci/object-storage/testing"
import { FILE_LIST_SCHEMA, FILE_REF_SCHEMA, defineEntity, field, type EntityDefinition, type FileRef } from "@nivo-lite/agent-sdk/entity"
import type { EngineResult, EntitiesApi, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { mutationProblems } from "@nivo-lite/agent-sdk/mutation"
import { BillingError, BillingErrorCode, EntitlementsService } from "@modules/domain/billing"
import { EntityEngineService, EntityPortsService, type RunIn, type ScopedTx } from "@modules/domain/entity-engine"
import { IDS, type Ids } from "@modules/platform/ids"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { Secret } from "@modules/platform/config"
import { StorageFilesService } from "@modules/integrations/object-storage/object-storage-files.service"
import { REMOTE_FILES, type RemoteFileAnswer, type RemoteFiles } from "@modules/integrations/remote-files"
import { RecordFilesErrorCode } from "./errors/record-files.error"
import { RECORD_FILES_STORAGE } from "./record-files.decorators"
import { RecordFilesService } from "./record-files.service"
import { RecordFileFetchService } from "./record-files-fetch.service"
import { TestWorldError, TestWorldErrorCode } from "@tests/world/test-world.error"

/** The provider host names of these specs resolve to a public address; a spec that wants another answer says so. */
jest.mock("node:dns/promises", () => ({ lookup: jest.fn().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]) }))

/** The module double as the service calls it: asking for every address of a name (`all: true`), which the overloaded `lookup` type cannot say once mocked. */
const lookupAll = jest.mocked<(host: string, options: { readonly all: true }) => Promise<Array<LookupAddress>>>(lookup)

const MB = 1024 * 1024

/** A record type as a package declares it, with a file field and no code of its own in be. */
const PROJECT = defineEntity({
    name: "fixture.project",
    dataKind: "fixture-project",
    fields: {
        title: field.text({ maxLength: 40 }),
        cover: field.file({ accept: ["image/png", "image/webp"], maxBytes: 8 }),
        voice: field.file({ accept: ["audio/*"], maxBytes: 2 * MB }),
        photos: field.file({ accept: ["image/png", "image/webp"], maxBytes: 8, many: true, max: 3 }),
    },
})

const WS_A = "11111111-1111-4111-8111-111111111111"
const WS_B = "22222222-2222-4222-8222-222222222222"
const RECORD = "0b9f1c2e-6d1a-4f0e-9a37-000000000001"
const OTHER_RECORD = "0b9f1c2e-6d1a-4f0e-9a37-000000000002"
const AGENT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const AGENT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"

type Rows = Map<string, Map<string, RecordRow & { readonly entity: string; readonly agent: string | null }>>

/** The data of a record no file was linked to. */
const emptyData = (): Record<string, unknown> => ({ title: "a", cover: null, voice: null, photos: [] })

/** The records the fake store holds, by workspace: what the engine's scope shows one workspace, and nothing of another. */
const rowsOf = (): Rows => {
    const row = (id: string, workspaceId: string) => ({
        entity: PROJECT.name,
        id,
        workspaceId,
        agent: id === RECORD ? AGENT_A : AGENT_B,
        version: "1",
        createdAt: "2026-11-13T00:00:00.000Z",
        updatedAt: "2026-11-13T00:00:00.000Z",
        data: emptyData(),
    })
    return new Map([
        [WS_A, new Map([[RECORD, row(RECORD, WS_A)], [OTHER_RECORD, row(OTHER_RECORD, WS_A)]])],
        [WS_B, new Map()],
    ])
}

/** The refusal of a fake that a spec never reaches. */
const notUsed = (): TestWorldError => new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { what: "not used" } })

/** An in-memory `EntitiesApi`: get and update of the workspace of the transaction, never of an argument. */
const entitiesOf = (rows: Rows, runIn: RunIn): EntitiesApi => {
    const held = (tx: ScopedTx) => rows.get(tx.workspaceId) ?? new Map()
    const of = (tx: ScopedTx) => new Map([...held(tx)].filter(([, row]) => tx.agent?.sees !== "own" || row.agent === tx.agent.id))
    const unsupported = (): Promise<EngineResult> => Promise.reject(notUsed())
    return {
        get: (entity, id) => runIn((tx) => Promise.resolve((of(tx).get(id)?.entity === entity ? (of(tx).get(id) ?? null) : null))),
        list: () => Promise.reject(notUsed()),
        aggregate: () => Promise.reject(notUsed()),
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

/** What the fake provider address serves: a small PNG. */
const SERVED: RemoteFileAnswer = {
    status: 200,
    contentType: "image/png",
    location: undefined,
    length: 4,
    bytes: Buffer.from([137, 80, 78, 71]),
}

const build = async () => {
    const memory: MemoryObjectStorage = createMemoryObjectStorage()
    const remote = mock<RemoteFiles>({ maxRedirects: 3 })
    remote.read.mockResolvedValue(SERVED)
    const logger = mock<Logger>()
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
    const rows = rowsOf()
    const catalog: ReadonlyMap<string, EntityDefinition> = new Map<string, EntityDefinition>([[PROJECT.name, PROJECT]])
    const engine = mock<EntityEngineService>({ catalog })
    engine.scoped.mockImplementation((workspaceId, work, agent) => work(mock<ScopedTx>({ workspaceId, ...(agent === undefined ? {} : { agent }) })))
    const ports = mock<EntityPortsService>()
    ports.entitiesApi.mockImplementation((runIn) => entitiesOf(rows, runIn))
    const entitlements = mock<EntitlementsService>()
    entitlements.requireStorageFor.mockResolvedValue(undefined)
    let next = 0
    const ids: Ids = {
        next: () => {
            next += 1
            return `5c1d3e2a-0f4b-4c6d-8e9f-${String(next).padStart(12, "0")}`
        },
    }
    const moduleRef = await Test.createTestingModule({
        providers: [
            RecordFilesService,
            RecordFileFetchService,
            { provide: RECORD_FILES_STORAGE, useValue: storage },
            { provide: IDS, useValue: ids },
            { provide: LOGGER, useValue: logger },
            { provide: REMOTE_FILES, useValue: remote },
            { provide: EntityEngineService, useValue: engine },
            { provide: EntityPortsService, useValue: ports },
            { provide: EntitlementsService, useValue: entitlements },
        ],
    }).compile()
    const service = moduleRef.get(RecordFilesService)
    const records = (workspaceId: string): EntitiesApi =>
        entitiesOf(rows, (use) => use(mock<ScopedTx>({ workspaceId })))
    return { service, memory, rows, entitlements, records, remote, logger, storage, ports }
}

const PNG = new Uint8Array([137, 80, 78, 71])
const TARGET = { type: PROJECT.name, recordId: RECORD, field: "cover" }

/** The code of the record files error a call threw. */
const codeOf = async (call: Promise<unknown>): Promise<string> => {
    try {
        await call
    } catch (cause) {
        if (cause instanceof Error && "code" in cause) return String(cause.code)
        throw cause
    }
    throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { what: "the call was not refused" } })
}

describe("RecordFilesService: the calling agent's own records", () => {
    it("reaches a record through its agent: a call naming another agent's record is RecordNotFound, a person's call (no agent) reaches it", async () => {
        const { service, records } = await build()
        const mine = { ...TARGET, agentId: AGENT_A }
        const theirs = { ...TARGET, recordId: OTHER_RECORD, agentId: AGENT_A }

        const ticket = await service.upload(WS_A, mine, { name: "cover.png", mime: "image/png", size: PNG.length })
        expect(ticket.key).toContain(`/${RECORD}/cover/`)
        expect(await codeOf(service.upload(WS_A, theirs, { name: "cover.png", mime: "image/png", size: PNG.length }))).toBe(
            RecordFilesErrorCode.RecordNotFound,
        )
        expect(await codeOf(service.url(WS_A, theirs))).toBe(RecordFilesErrorCode.RecordNotFound)
        expect(await codeOf(service.delete(WS_A, theirs))).toBe(RecordFilesErrorCode.RecordNotFound)
        expect((await records(WS_A).get(PROJECT.name, OTHER_RECORD))?.data["cover"]).toBeNull()
        await expect(service.upload(WS_A, { type: PROJECT.name, recordId: OTHER_RECORD, field: "cover" }, { name: "c.png", mime: "image/png", size: PNG.length })).resolves.toMatchObject({
            method: "PUT",
        })
    })
})

describe("RecordFilesService: ticket, upload, confirm, link, url", () => {
    it("issues a ticket, proves the upload, links it onto the record and reads it back as a signed url", async () => {
        const { service, memory, entitlements, records } = await build()

        const ticket = await service.upload(WS_A, TARGET, { name: "cover.png", mime: "image/png", size: PNG.length })
        expect(ticket.key).toBe(`${WS_A}/fixture.project/${RECORD}/cover/5c1d3e2a-0f4b-4c6d-8e9f-000000000001`)
        expect(ticket.method).toBe("PUT")
        expect(entitlements.requireStorageFor).toHaveBeenCalledWith(WS_A, PNG.length)
        expect(await memory.upload(ticket.url, PNG, "image/png")).toBe(200)

        const ref: FileRef = await service.confirm(WS_A, TARGET, ticket.key, "cover.png")
        expect(ref).toEqual({ key: ticket.key, mime: "image/png", size: 4, name: "cover.png" })

        // Confirming writes nothing to the record; linking does, and the type's own declaration takes the reference.
        expect((await records(WS_A).get(PROJECT.name, RECORD))?.data["cover"]).toBeNull()
        expect(
            mutationProblems(
                { op: "update", entity: PROJECT.name, key: RECORD, expected: "1", values: { cover: ref } },
                [PROJECT],
                "action",
            ),
        ).toEqual([])
        expect(await service.link(WS_A, TARGET, { key: ticket.key, name: "cover.png" })).toEqual(ref)
        expect((await records(WS_A).get(PROJECT.name, RECORD))?.data["cover"]).toEqual(ref)

        const link = await service.url(WS_A, TARGET, 60)
        expect(link).toMatchObject({ name: "cover.png", mime: "image/png", size: 4 })
        expect(link.url).toContain("nivo-records")
    })

    it("refuses a content type the field does not accept, before anything is signed or counted", async () => {
        const { service, entitlements, memory } = await build()

        expect(await codeOf(service.upload(WS_A, TARGET, { name: "a.mp4", mime: "video/mp4", size: 4 }))).toBe(
            RecordFilesErrorCode.MimeNotAccepted,
        )
        expect(entitlements.requireStorageFor).not.toHaveBeenCalled()
        expect(memory.store.signed).toEqual([])
    })

    it("refuses a file larger than the field takes, and an empty one", async () => {
        const { service } = await build()

        expect(await codeOf(service.upload(WS_A, TARGET, { name: "a.png", mime: "image/png", size: 9 }))).toBe(
            RecordFilesErrorCode.SizeInvalid,
        )
        expect(await codeOf(service.upload(WS_A, TARGET, { name: "a.png", mime: "image/png", size: 0 }))).toBe(
            RecordFilesErrorCode.SizeInvalid,
        )
    })

    it("refuses a record of another workspace: the scope shows none", async () => {
        const { service } = await build()

        expect(await codeOf(service.upload(WS_B, TARGET, { name: "a.png", mime: "image/png", size: 4 }))).toBe(
            RecordFilesErrorCode.RecordNotFound,
        )
        expect(await codeOf(service.url(WS_B, TARGET))).toBe(RecordFilesErrorCode.RecordNotFound)
    })

    it("refuses a field the type does not declare as a file, and a type no package declares", async () => {
        const { service } = await build()

        expect(await codeOf(service.upload(WS_A, { ...TARGET, field: "title" }, { name: "a", mime: "image/png", size: 1 }))).toBe(
            RecordFilesErrorCode.FieldNotFile,
        )
        expect(await codeOf(service.upload(WS_A, { ...TARGET, field: "ghost" }, { name: "a", mime: "image/png", size: 1 }))).toBe(
            RecordFilesErrorCode.FieldNotFile,
        )
        expect(
            await codeOf(service.upload(WS_A, { ...TARGET, type: "fixture.secret" }, { name: "a", mime: "image/png", size: 1 })),
        ).toBe(RecordFilesErrorCode.TypeUnknown)
    })

    it("refuses the quota through the plan's own storage check", async () => {
        const { service, entitlements } = await build()
        entitlements.requireStorageFor.mockRejectedValue(new BillingError({ code: BillingErrorCode.StorageQuotaExceeded }))

        expect(await codeOf(service.upload(WS_A, TARGET, { name: "a.png", mime: "image/png", size: 4 }))).toBe(
            BillingErrorCode.StorageQuotaExceeded,
        )
    })

    it("refuses to confirm a key of another record, another workspace, or nothing uploaded", async () => {
        const { service } = await build()
        const ticket = await service.upload(WS_A, TARGET, { name: "a.png", mime: "image/png", size: 4 })

        expect(await codeOf(service.confirm(WS_A, { ...TARGET, recordId: OTHER_RECORD }, ticket.key, "a"))).toBe(
            RecordFilesErrorCode.KeyInvalid,
        )
        expect(await codeOf(service.confirm(WS_A, TARGET, `${WS_B}/fixture.project/${RECORD}/cover/x`, "a"))).toBe(
            RecordFilesErrorCode.KeyInvalid,
        )
        expect(await codeOf(service.confirm(WS_A, TARGET, ticket.key, "a"))).toBe(RecordFilesErrorCode.UploadMissing)
    })

    it("refuses and removes an object at an issued key that does not fit the field", async () => {
        const { service, memory } = await build()
        const key = `${WS_A}/fixture.project/${RECORD}/cover/5c1d3e2a-0f4b-4c6d-8e9f-0000000000ff`
        memory.seed("nivo-records", key, new Uint8Array(4), "application/pdf")

        expect(await codeOf(service.confirm(WS_A, TARGET, key, "a.pdf"))).toBe(RecordFilesErrorCode.MimeNotAccepted)
        expect(memory.store.buckets.get("nivo-records")?.has(key)).toBe(false)
    })

    it("gives a url only for what the record holds: nothing, or a reference to an object of another record, is refused", async () => {
        const { service, records } = await build()

        expect(await codeOf(service.url(WS_A, TARGET))).toBe(RecordFilesErrorCode.NoFile)
        const forged: FileRef = {
            key: `${WS_A}/fixture.project/${OTHER_RECORD}/cover/5c1d3e2a-0f4b-4c6d-8e9f-000000000001`,
            mime: "image/png",
            size: 4,
            name: "x.png",
        }
        await records(WS_A).update(PROJECT.name, RECORD, "1", { cover: forged })
        expect(await codeOf(service.url(WS_A, TARGET))).toBe(RecordFilesErrorCode.KeyInvalid)
    })
})

describe("RecordFilesService: what a tool produced, staged then put", () => {
    it("stages bytes for the workspace and puts them into the field, removing the staged object", async () => {
        const { service, memory } = await build()
        const voice = { ...TARGET, field: "voice" }

        const staged = await service.stage(WS_A, new Uint8Array([1, 2, 3]), "audio/mpeg")
        expect(staged).toBe(`${WS_A}/staged/5c1d3e2a-0f4b-4c6d-8e9f-000000000001`)
        const ref = await service.put(WS_A, voice, { staged, name: "voice.mp3" })

        expect(ref).toEqual({
            key: `${WS_A}/fixture.project/${RECORD}/voice/5c1d3e2a-0f4b-4c6d-8e9f-000000000002`,
            mime: "audio/mpeg",
            size: 3,
            name: "voice.mp3",
        })
        expect(memory.store.buckets.get("nivo-records")?.has(staged)).toBe(false)
        expect(memory.store.buckets.get("nivo-records")?.has(ref.key)).toBe(true)
    })

    it("refuses a staged object of another workspace, one the field does not accept, and a missing one", async () => {
        const { service } = await build()
        const staged = await service.stage(WS_B, new Uint8Array([1]), "audio/mpeg")

        expect(await codeOf(service.put(WS_A, { ...TARGET, field: "voice" }, { staged, name: "v" }))).toBe(
            RecordFilesErrorCode.KeyInvalid,
        )
        const picture = await service.stage(WS_A, new Uint8Array([1]), "image/gif")
        expect(await codeOf(service.put(WS_A, TARGET, { staged: picture, name: "p" }))).toBe(RecordFilesErrorCode.MimeNotAccepted)
        expect(await codeOf(service.put(WS_A, TARGET, { staged: `${WS_A}/staged/5c1d3e2a-0f4b-4c6d-8e9f-0000000000ee`, name: "p" }))).toBe(
            RecordFilesErrorCode.UploadMissing,
        )
    })

    it("refuses to stage nothing or a malformed content type", async () => {
        const { service } = await build()

        expect(await codeOf(service.stage(WS_A, new Uint8Array(0), "audio/mpeg"))).toBe(RecordFilesErrorCode.SizeInvalid)
        expect(await codeOf(service.stage(WS_A, new Uint8Array(1), "audio"))).toBe(RecordFilesErrorCode.MimeNotAccepted)
    })
})

/** Uploads and confirms one object of a field, as a person's browser would, and answers its reference. */
const uploaded = async (
    built: Awaited<ReturnType<typeof build>>,
    target: typeof TARGET,
    bytes: Uint8Array,
    mime: string,
    name: string,
): Promise<FileRef> => {
    const ticket = await built.service.upload(WS_A, target, { name, mime, size: bytes.length })
    await built.memory.upload(ticket.url, bytes, mime)
    return built.service.confirm(WS_A, target, ticket.key, name)
}

const REPLACEMENT = new Uint8Array([137, 80, 78, 71, 1])

describe("RecordFilesService: link attaches, replaces and removes", () => {
    it("replacing the reference removes the old object from the store, and keeps the new one", async () => {
        const built = await build()
        const first = await uploaded(built, TARGET, PNG, "image/png", "one.png")
        await built.service.link(WS_A, TARGET, { key: first.key, name: "one.png" })
        const second = await uploaded(built, TARGET, REPLACEMENT, "image/png", "two.png")

        await built.service.link(WS_A, TARGET, { key: second.key, name: "two.png" })

        const stored = built.memory.store.buckets.get("nivo-records")
        expect(stored?.has(first.key)).toBe(false)
        expect(stored?.has(second.key)).toBe(true)
        expect((await built.records(WS_A).get(PROJECT.name, RECORD))?.data["cover"]).toEqual(second)
    })

    it("linking the object the field already holds removes nothing", async () => {
        const built = await build()
        const first = await uploaded(built, TARGET, PNG, "image/png", "one.png")
        await built.service.link(WS_A, TARGET, { key: first.key, name: "one.png" })

        await built.service.link(WS_A, TARGET, { key: first.key, name: "renamed.png" })

        expect(built.memory.store.buckets.get("nivo-records")?.has(first.key)).toBe(true)
        expect(FILE_REF_SCHEMA.parse((await built.records(WS_A).get(PROJECT.name, RECORD))?.data["cover"]).name).toBe("renamed.png")
    })

    it("refuses to link a key of another record, another field, another workspace, a forged one, or one nothing was uploaded to", async () => {
        const built = await build()
        const other = await uploaded(built, { ...TARGET, recordId: OTHER_RECORD }, PNG, "image/png", "o.png")
        const voice = await uploaded(built, { ...TARGET, field: "voice" }, new Uint8Array([1]), "audio/mpeg", "v.mp3")
        const link = (key: string) => codeOf(built.service.link(WS_A, TARGET, { key, name: "x" }))

        expect(await link(other.key)).toBe(RecordFilesErrorCode.KeyInvalid)
        expect(await link(voice.key)).toBe(RecordFilesErrorCode.KeyInvalid)
        expect(await link(`${WS_B}/fixture.project/${RECORD}/cover/5c1d3e2a-0f4b-4c6d-8e9f-0000000000aa`)).toBe(RecordFilesErrorCode.KeyInvalid)
        expect(await link("../../etc/passwd")).toBe(RecordFilesErrorCode.KeyInvalid)
        expect(await link(`${WS_A}/fixture.project/${RECORD}/cover/5c1d3e2a-0f4b-4c6d-8e9f-0000000000bb`)).toBe(RecordFilesErrorCode.UploadMissing)
        expect((await built.records(WS_A).get(PROJECT.name, RECORD))?.data["cover"]).toBeNull()
    })

    it("refuses and removes an object that does not fit the field, and refuses a record of another workspace", async () => {
        const built = await build()
        const key = `${WS_A}/fixture.project/${RECORD}/cover/5c1d3e2a-0f4b-4c6d-8e9f-0000000000ff`
        built.memory.seed("nivo-records", key, new Uint8Array(4), "application/pdf")

        expect(await codeOf(built.service.link(WS_A, TARGET, { key, name: "a.pdf" }))).toBe(RecordFilesErrorCode.MimeNotAccepted)
        expect(built.memory.store.buckets.get("nivo-records")?.has(key)).toBe(false)
        expect(await codeOf(built.service.link(WS_B, TARGET, { key, name: "a" }))).toBe(RecordFilesErrorCode.RecordNotFound)
    })

    it("refuses an undeclared type and an undeclared field", async () => {
        const { service } = await build()
        const file = { key: `${WS_A}/x/y/z/w`, name: "a" }

        expect(await codeOf(service.link(WS_A, { ...TARGET, type: "fixture.secret" }, file))).toBe(RecordFilesErrorCode.TypeUnknown)
        expect(await codeOf(service.link(WS_A, { ...TARGET, field: "title" }, file))).toBe(RecordFilesErrorCode.FieldNotFile)
    })

    it("a record that refuses the write leaves no object this call made, and the staged file stays for another try", async () => {
        const built = await build()
        built.ports.entitiesApi.mockImplementation((runIn) => ({
            ...entitiesOf(built.rows, runIn),
            update: () => Promise.resolve({ ok: false, reason: "stale" }),
        }))
        const staged = await built.service.stage(WS_A, PNG, "image/png")

        expect(await codeOf(built.service.link(WS_A, TARGET, { key: staged, name: "p.png" }))).toBe(
            RecordFilesErrorCode.RecordRejected,
        )

        expect([...(built.memory.store.buckets.get("nivo-records")?.keys() ?? [])]).toEqual([staged])
    })
})

describe("RecordFilesService: delete", () => {
    it("clears the field and removes its object; a second delete finds nothing to remove", async () => {
        const built = await build()
        const ref = await uploaded(built, TARGET, PNG, "image/png", "one.png")
        await built.service.link(WS_A, TARGET, { key: ref.key, name: "one.png" })

        expect(await built.service.delete(WS_A, TARGET)).toEqual({ removed: true })

        expect((await built.records(WS_A).get(PROJECT.name, RECORD))?.data["cover"]).toBeNull()
        expect(built.memory.store.buckets.get("nivo-records")?.has(ref.key)).toBe(false)
        expect(await built.service.delete(WS_A, TARGET)).toEqual({ removed: false })
    })

    it("refuses another workspace's record, an undeclared field and an undeclared type", async () => {
        const { service } = await build()

        expect(await codeOf(service.delete(WS_B, TARGET))).toBe(RecordFilesErrorCode.RecordNotFound)
        expect(await codeOf(service.delete(WS_A, { ...TARGET, field: "title" }))).toBe(RecordFilesErrorCode.FieldNotFile)
        expect(await codeOf(service.delete(WS_A, { ...TARGET, type: "fixture.secret" }))).toBe(RecordFilesErrorCode.TypeUnknown)
    })

    it("clears a forged reference but never removes an object of another record", async () => {
        const built = await build()
        const other = await uploaded(built, { ...TARGET, recordId: OTHER_RECORD }, PNG, "image/png", "o.png")
        await built.records(WS_A).update(PROJECT.name, RECORD, "1", { cover: other })

        expect(await built.service.delete(WS_A, TARGET)).toEqual({ removed: true })

        expect(built.memory.store.buckets.get("nivo-records")?.has(other.key)).toBe(true)
        expect((await built.records(WS_A).get(PROJECT.name, RECORD))?.data["cover"]).toBeNull()
    })

    it("keeps the answer when the store cannot remove the old object: the record was changed, the object is logged", async () => {
        const built = await build()
        const ref = await uploaded(built, TARGET, PNG, "image/png", "one.png")
        await built.service.link(WS_A, TARGET, { key: ref.key, name: "one.png" })
        jest.spyOn(built.storage, "remove").mockResolvedValue({ kind: "refused", code: "OBJECT_STORAGE_UNAVAILABLE" })

        expect(await built.service.delete(WS_A, TARGET)).toEqual({ removed: true })

        expect(built.logger.warn).toHaveBeenCalled()
    })
})

describe("RecordFilesService: put by address", () => {
    it("fetches the file at a provider address and writes it to the record, replacing and removing the old one", async () => {
        const built = await build()
        const old = await uploaded(built, TARGET, REPLACEMENT, "image/png", "old.png")
        await built.service.link(WS_A, TARGET, { key: old.key, name: "old.png" })

        const ref = await built.service.put(WS_A, TARGET, { url: "https://cdn.provider.test/out.png", name: "out.png" })

        expect(ref).toMatchObject({ mime: "image/png", size: 4, name: "out.png" })
        expect(ref.key.startsWith(`${WS_A}/fixture.project/${RECORD}/cover/`)).toBe(true)
        expect(built.remote.read).toHaveBeenCalledWith(
            expect.objectContaining({ url: "https://cdn.provider.test/out.png", redirect: "manual", maxBytes: 8, pin: expect.any(Object) }),
        )
        expect(built.remote.read).toHaveBeenCalledWith(
            expect.objectContaining({ limits: { maxBytes: 100 * 1024 * 1024, timeoutMs: 300_000 } }),
        )
        const stored = built.memory.store.buckets.get("nivo-records")
        expect(stored?.has(ref.key)).toBe(true)
        expect(stored?.has(old.key)).toBe(false)
        expect((await built.records(WS_A).get(PROJECT.name, RECORD))?.data["cover"]).toEqual(ref)
    })

    it("refuses an address that is not public https before anything is fetched", async () => {
        const { service, remote } = await build()
        const put = (url: string) => codeOf(service.put(WS_A, TARGET, { url, name: "x" }))

        expect(await put("http://cdn.provider.test/a.png")).toBe(RecordFilesErrorCode.UrlInvalid)
        expect(await put("https://10.0.0.5/a.png")).toBe(RecordFilesErrorCode.UrlInvalid)
        expect(await put("https://169.254.169.254/latest")).toBe(RecordFilesErrorCode.UrlInvalid)
        expect(await put("https://user:pw@cdn.provider.test/a.png")).toBe(RecordFilesErrorCode.UrlInvalid)
        expect(await put("not a url")).toBe(RecordFilesErrorCode.UrlInvalid)
        expect(remote.read).not.toHaveBeenCalled()
    })

    it("refuses an answer of the wrong type, one too big, an empty or failed one, and a network failure", async () => {
        const { service, remote, memory } = await build()
        const put = () => codeOf(service.put(WS_A, TARGET, { url: "https://cdn.provider.test/a.png", name: "x" }))

        remote.read.mockResolvedValueOnce({ ...SERVED, contentType: "video/mp4", bytes: null })
        expect(await put()).toBe(RecordFilesErrorCode.MimeNotAccepted)
        remote.read.mockResolvedValueOnce({ ...SERVED, length: 9999, bytes: null })
        expect(await put()).toBe(RecordFilesErrorCode.SizeInvalid)
        remote.read.mockResolvedValueOnce({ ...SERVED, status: 500, length: 0, bytes: null })
        expect(await put()).toBe(RecordFilesErrorCode.UrlUnreachable)
        remote.read.mockRejectedValueOnce(new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { what: "socket hang up" } }))
        expect(await put()).toBe(RecordFilesErrorCode.UrlUnreachable)
        expect(memory.store.buckets.get("nivo-records")?.size ?? 0).toBe(0)
    })

    it("follows a redirect hop by hop and refuses one to a private address", async () => {
        const { service, remote } = await build()
        remote.read
            .mockResolvedValueOnce({ ...SERVED, status: 302, location: "https://cdn2.provider.test/b.png", length: 0, bytes: null })
            .mockResolvedValueOnce(SERVED)
        const ref = await service.put(WS_A, TARGET, { url: "https://cdn.provider.test/a.png", name: "x" })
        expect(ref.size).toBe(4)
        expect(remote.read).toHaveBeenLastCalledWith(expect.objectContaining({ url: "https://cdn2.provider.test/b.png" }))

        remote.read.mockResolvedValueOnce({ ...SERVED, status: 302, location: "https://192.168.1.1/b.png", length: 0, bytes: null })
        expect(await codeOf(service.put(WS_A, TARGET, { url: "https://cdn.provider.test/a.png", name: "x" }))).toBe(
            RecordFilesErrorCode.UrlInvalid,
        )
    })

    it("refuses a host name that resolves to a private address, whatever the name says", async () => {
        const { service, remote } = await build()
        const rebinding: Array<LookupAddress> = [
            { address: "93.184.216.34", family: 4 },
            { address: "10.0.0.7", family: 4 },
        ]
        lookupAll.mockResolvedValueOnce(rebinding)

        expect(await codeOf(service.put(WS_A, TARGET, { url: "https://rebind.provider.test/a.png", name: "x" }))).toBe(
            RecordFilesErrorCode.UrlInvalid,
        )
        lookupAll.mockRejectedValueOnce(new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { what: "ENOTFOUND" } }))
        expect(await codeOf(service.put(WS_A, TARGET, { url: "https://nowhere.provider.test/a.png", name: "x" }))).toBe(
            RecordFilesErrorCode.UrlUnreachable,
        )
        expect(remote.read).not.toHaveBeenCalled()
    })

    it("refuses a fetched file by the plan's storage check, and another workspace's record", async () => {
        const { service, entitlements } = await build()

        expect(await codeOf(service.put(WS_B, TARGET, { url: "https://cdn.provider.test/a.png", name: "x" }))).toBe(
            RecordFilesErrorCode.RecordNotFound,
        )
        entitlements.requireStorageFor.mockRejectedValue(new BillingError({ code: BillingErrorCode.StorageQuotaExceeded }))
        expect(await codeOf(service.put(WS_A, TARGET, { url: "https://cdn.provider.test/a.png", name: "x" }))).toBe(
            BillingErrorCode.StorageQuotaExceeded,
        )
    })

    it("answers FetchNotServed where no reader of remote files is bound", async () => {
        const built = await build()
        const bare = new RecordFileFetchService(undefined)

        await expect(bare.fetch("https://cdn.provider.test/a.png", PROJECT.fields.cover)).rejects.toMatchObject({
            code: RecordFilesErrorCode.FetchNotServed,
        })
        expect(built.remote.read).not.toHaveBeenCalled()
    })
})

const PHOTOS = { ...TARGET, field: "photos" }

/** The references the record holds in the list field, in order. */
const photosOf = async (built: Awaited<ReturnType<typeof build>>): Promise<ReadonlyArray<FileRef>> =>
    FILE_LIST_SCHEMA.parse((await built.records(WS_A).get(PROJECT.name, RECORD))?.data["photos"] ?? [])

const keysIn = (built: Awaited<ReturnType<typeof build>>): ReadonlyArray<string> => [
    ...(built.memory.store.buckets.get("nivo-records")?.keys() ?? []),
]

describe("RecordFilesService: a list field holds several files in order", () => {
    it("appends each linked file in order, answers the reference, and refuses a link past the maximum with ListFull", async () => {
        const built = await build()
        const one = await uploaded(built, PHOTOS, PNG, "image/png", "one.png")
        const two = await uploaded(built, PHOTOS, REPLACEMENT, "image/png", "two.png")
        const three = await uploaded(built, PHOTOS, PNG, "image/webp", "three.webp")
        expect(await built.service.link(WS_A, PHOTOS, { key: one.key, name: "one.png" })).toEqual(one)
        await built.service.link(WS_A, PHOTOS, { key: two.key, name: "two.png" })
        await built.service.link(WS_A, PHOTOS, { key: three.key, name: "three.webp" })

        expect((await photosOf(built)).map((ref) => ref.name)).toEqual(["one.png", "two.png", "three.webp"])
        expect(await codeOf(built.service.upload(WS_A, PHOTOS, { name: "four.png", mime: "image/png", size: 4 }))).toBe(
            RecordFilesErrorCode.ListFull,
        )
        const staged = await built.service.stage(WS_A, PNG, "image/png")
        expect(await codeOf(built.service.put(WS_A, PHOTOS, { staged, name: "four.png" }))).toBe(RecordFilesErrorCode.ListFull)
        expect(keysIn(built)).toContain(staged)
        expect(await codeOf(built.service.put(WS_A, PHOTOS, { url: "https://cdn.provider.test/x.png", name: "x.png" }))).toBe(
            RecordFilesErrorCode.ListFull,
        )
        expect(built.remote.read).not.toHaveBeenCalled()
        expect(await photosOf(built)).toHaveLength(3)
    })

    it("linking an item the list already holds adds nothing; put by staged file and by address append", async () => {
        const built = await build()
        const one = await uploaded(built, PHOTOS, PNG, "image/png", "one.png")
        await built.service.link(WS_A, PHOTOS, { key: one.key, name: "one.png" })
        await built.service.link(WS_A, PHOTOS, { key: one.key, name: "again.png" })
        const staged = await built.service.stage(WS_A, PNG, "image/png")
        const adopted = await built.service.put(WS_A, PHOTOS, { staged, name: "two.png" })
        const fetched = await built.service.put(WS_A, PHOTOS, { url: "https://cdn.provider.test/x.png", name: "three.png" })

        expect((await photosOf(built)).map((ref) => ref.key)).toEqual([one.key, adopted.key, fetched.key])
        expect(keysIn(built)).not.toContain(staged)
    })

    it("a replacement takes the item's place and removes its object; a key the list does not hold is refused", async () => {
        const built = await build()
        const one = await uploaded(built, PHOTOS, PNG, "image/png", "one.png")
        const two = await uploaded(built, PHOTOS, PNG, "image/png", "two.png")
        await built.service.link(WS_A, PHOTOS, { key: one.key, name: "one.png" })
        await built.service.link(WS_A, PHOTOS, { key: two.key, name: "two.png" })
        const fresh = await uploaded(built, PHOTOS, REPLACEMENT, "image/png", "fresh.png")

        await built.service.link(WS_A, PHOTOS, { key: fresh.key, name: "fresh.png", replaces: one.key })

        expect((await photosOf(built)).map((ref) => ref.name)).toEqual(["fresh.png", "two.png"])
        expect(keysIn(built)).not.toContain(one.key)
        const other = await uploaded(built, PHOTOS, PNG, "image/png", "other.png")
        expect(await codeOf(built.service.link(WS_A, PHOTOS, { key: other.key, name: "o.png", replaces: one.key }))).toBe(
            RecordFilesErrorCode.KeyInvalid,
        )
        expect(await photosOf(built)).toHaveLength(2)
    })

    it("reads one item by its key from the record; a list field without a key, or a key the list does not hold, is refused", async () => {
        const built = await build()
        const one = await uploaded(built, PHOTOS, PNG, "image/png", "one.png")
        const two = await uploaded(built, PHOTOS, REPLACEMENT, "image/png", "two.png")
        await built.service.link(WS_A, PHOTOS, { key: one.key, name: "one.png" })
        await built.service.link(WS_A, PHOTOS, { key: two.key, name: "two.png" })

        expect(await built.service.url(WS_A, { ...PHOTOS, key: two.key })).toMatchObject({ name: "two.png", size: 5 })
        expect(await codeOf(built.service.url(WS_A, PHOTOS))).toBe(RecordFilesErrorCode.ItemKeyRequired)
        expect(await codeOf(built.service.url(WS_A, { ...PHOTOS, key: `${WS_A}/fixture.project/${RECORD}/photos/${"0".repeat(8)}-0000-4000-8000-000000000000` }))).toBe(
            RecordFilesErrorCode.NoFile,
        )
    })

    it("deletes one item by its key, removes its object and keeps the others in order", async () => {
        const built = await build()
        const refs: Array<FileRef> = []
        for (const name of ["a.png", "b.png", "c.png"]) {
            const ref = await uploaded(built, PHOTOS, PNG, "image/png", name)
            await built.service.link(WS_A, PHOTOS, { key: ref.key, name })
            refs.push(ref)
        }

        expect(await built.service.delete(WS_A, { ...PHOTOS, key: refs[1]?.key ?? "" })).toEqual({ removed: true })

        expect((await photosOf(built)).map((ref) => ref.name)).toEqual(["a.png", "c.png"])
        expect(keysIn(built)).not.toContain(refs[1]?.key)
        expect(keysIn(built)).toContain(refs[0]?.key)
        expect(await built.service.delete(WS_A, { ...PHOTOS, key: refs[1]?.key ?? "" })).toEqual({ removed: false })
        expect(await codeOf(built.service.delete(WS_A, PHOTOS))).toBe(RecordFilesErrorCode.ItemKeyRequired)
    })

    it("a single field takes a key only for its own file: another key reads and removes nothing", async () => {
        const built = await build()
        const ref = await uploaded(built, TARGET, PNG, "image/png", "one.png")
        await built.service.link(WS_A, TARGET, { key: ref.key, name: "one.png" })
        const stranger = `${WS_A}/fixture.project/${RECORD}/cover/5c1d3e2a-0f4b-4c6d-8e9f-0000000000ff`

        expect(await built.service.url(WS_A, { ...TARGET, key: ref.key })).toMatchObject({ name: "one.png" })
        expect(await codeOf(built.service.url(WS_A, { ...TARGET, key: stranger }))).toBe(RecordFilesErrorCode.NoFile)
        expect(await built.service.delete(WS_A, { ...TARGET, key: stranger })).toEqual({ removed: false })
        expect(keysIn(built)).toContain(ref.key)
    })

    it("reordering is a plain update of the same set: the declaration takes it, and no object is touched by the order", async () => {
        const built = await build()
        const refs: Array<FileRef> = []
        for (const name of ["a.png", "b.png"]) {
            const ref = await uploaded(built, PHOTOS, PNG, "image/png", name)
            await built.service.link(WS_A, PHOTOS, { key: ref.key, name })
            refs.push(ref)
        }
        const [head] = refs
        if (head === undefined) throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { what: "no reference was linked" } })
        const reversed = [...refs].reverse()
        const write = (photos: ReadonlyArray<FileRef>) =>
            mutationProblems(
                { op: "update", entity: PROJECT.name, key: RECORD, expected: "1", values: { photos: [...photos] } },
                [PROJECT],
                "action",
            ).map((problem) => problem.code)

        expect(write(reversed)).toEqual([])
        expect(write([...refs, ...refs])).toEqual(["MUTATION_VALUE_INVALID"])
        expect(write([...refs, { ...head, key: `${head.key}x` }, { ...head, key: `${head.key}y` }])).toEqual(["MUTATION_VALUE_INVALID"])
        expect(write([{ ...head, mime: "video/mp4" }])).toEqual(["MUTATION_VALUE_INVALID"])
        expect(write([])).toEqual([])
        expect(keysIn(built)).toEqual(expect.arrayContaining(refs.map((ref) => ref.key)))
    })

    it("a record that refuses the write leaves no object an append made", async () => {
        const built = await build()
        const staged = await built.service.stage(WS_A, PNG, "image/png")
        const stale: EngineResult = { ok: false, reason: "stale" }
        jest.spyOn(built.ports, "entitiesApi").mockImplementation((runIn) => ({
            ...entitiesOf(built.rows, runIn),
            update: () => Promise.resolve(stale),
        }))

        expect(await codeOf(built.service.put(WS_A, PHOTOS, { staged, name: "a.png" }))).toBe(RecordFilesErrorCode.RecordRejected)

        expect(keysIn(built).filter((key) => key.includes("/photos/"))).toEqual([])
        expect(keysIn(built)).toContain(staged)
    })
})
