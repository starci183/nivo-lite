import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { In } from "typeorm"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import { isRecord } from "@modules/platform/primitives"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { RecordEntity } from "../persistence/entities"
import { fileKeysOfAgent, recordsOfAgent, softDeleteAgentRecords } from "./agent-records.policy"
import { mintScopedTx } from "./scoped-tx.policy"

const WS = "11111111-1111-4111-8111-111111111111"
const AGENT = "22222222-2222-4222-8222-222222222222"

const typeOf = (name: `${string}.${string}`, fields: EntityDefinition["fields"] = {}): EntityDefinition => ({
    entry: "entity",
    name,
    dataKind: name,
    fields,
})

const ORDER = typeOf("blocks-core.sales.order", {
    receipt: { kind: "file", nullable: true, accept: ["image/*"], maxBytes: 1000 },
    photos: { kind: "file", nullable: false, many: true, max: 3, accept: ["image/*"], maxBytes: 1000 },
})
const LEAD = typeOf("blocks-core.sales.lead")
const catalog = new Map([ORDER, LEAD].map((entity) => [entity.name, entity]))

const row = (entity: string, id: string, data: Record<string, unknown> = {}): RecordEntity =>
    Object.assign(new RecordEntity(), { entity, id, workspaceId: WS, agentId: AGENT, data })

const ref = (key: string) => ({ key, mime: "image/png", size: 10, name: "a.png" })

const AGENT_RECORDS = Symbol("agent-records.policy")

interface AgentRecordsPolicy {
    readonly recordsOfAgent: typeof recordsOfAgent
    readonly fileKeysOfAgent: typeof fileKeysOfAgent
    readonly softDeleteAgentRecords: typeof softDeleteAgentRecords
}

const buildPolicy = async (): Promise<AgentRecordsPolicy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: AGENT_RECORDS,
                useFactory: (): AgentRecordsPolicy => ({ recordsOfAgent, fileKeysOfAgent, softDeleteAgentRecords }),
            },
        ],
    }).compile()
    return moduleRef.get<AgentRecordsPolicy>(AGENT_RECORDS)
}

/** True for the `set` object of a soft delete: the two SQL-expression functions that stamp `deleted_at` and bump the version. */
const isSoftDeleteSet = (
    value: unknown,
): value is { readonly deletedAt: () => string; readonly version: () => string } =>
    isRecord(value) && typeof value["deletedAt"] === "function" && typeof value["version"] === "function"

describe("recordsOfAgent: every record the agent owns, with the files they hold", () => {
    it("reads each declared type by workspace and agent (live records only), keeps the ids", async () => {
        const policy = await buildPolicy()
        const em = mockEntityManager()
        // The types are read one after the other, in the catalog's order: orders, then leads.
        em.find
            .mockResolvedValueOnce([
                row(ORDER.name, "o-1", { receipt: ref("k-receipt"), photos: [ref("k-1"), ref("k-2")] }),
                row(ORDER.name, "o-2", { receipt: null, photos: [] }),
            ])
            .mockResolvedValueOnce([row(LEAD.name, "l-1")])

        const sets = await policy.recordsOfAgent(mintScopedTx({ manager: em, workspaceId: WS }), catalog, AGENT)

        expect(sets).toEqual([
            { entity: ORDER.name, ids: ["o-1", "o-2"] },
            { entity: LEAD.name, ids: ["l-1"] },
        ])
        expect(em.find).toHaveBeenCalledWith(RecordEntity, {
            where: { entity: ORDER.name, workspaceId: WS, agentId: AGENT },
        })
        expect(em.find).toHaveBeenCalledWith(RecordEntity, {
            where: { entity: LEAD.name, workspaceId: WS, agentId: AGENT },
        })
    })

    it("leaves out a type the agent has no record of", async () => {
        const policy = await buildPolicy()
        const em = mockEntityManager()
        em.find.mockResolvedValue([])

        const sets = await policy.recordsOfAgent(mintScopedTx({ manager: em, workspaceId: WS }), catalog, AGENT)
        expect(sets).toEqual([])
    })
})

describe("fileKeysOfAgent: the files of one type's records the agent owns, read without the other fields", () => {
    it("answers the object keys of the file fields, and reads only the data column", async () => {
        const policy = await buildPolicy()
        const em = mockEntityManager()
        em.find.mockResolvedValueOnce([row(ORDER.name, "o-1", { receipt: ref("k-receipt"), photos: [ref("k-1")] })])

        await expect(policy.fileKeysOfAgent(mintScopedTx({ manager: em, workspaceId: WS }), ORDER, AGENT)).resolves.toEqual([
            "k-receipt",
            "k-1",
        ])
        expect(em.find).toHaveBeenCalledWith(RecordEntity, {
            select: { id: true, data: true },
            where: { entity: ORDER.name, workspaceId: WS, agentId: AGENT },
        })
    })

    it("reads nothing for a type that declares no file field", async () => {
        const policy = await buildPolicy()
        const em = mockEntityManager()
        await expect(policy.fileKeysOfAgent(mintScopedTx({ manager: em, workspaceId: WS }), LEAD, AGENT)).resolves.toEqual([])
        expect(em.find).not.toHaveBeenCalled()
    })
})

describe("softDeleteAgentRecords: the records are soft-deleted, nothing is removed", () => {
    const IS_NULL: unknown = expect.objectContaining({ _type: "isNull" })

    const updating = (affected: ReadonlyArray<number>) => {
        const em = mockEntityManager()
        const fakes = queueQueryBuilders(
            em,
            affected.map((count) => ({ execute: { affected: count } })),
        )
        return { em, fakes }
    }

    it("sets deleted_at and bumps the version of the records of each type in one update, keeps every link, and counts the records", async () => {
        const policy = await buildPolicy()
        const { em, fakes } = updating([2, 1])
        const sets = [
            { entity: ORDER.name, ids: ["o-1", "o-2"] },
            { entity: LEAD.name, ids: ["l-1"] },
        ]

        await expect(policy.softDeleteAgentRecords(mintScopedTx({ manager: em, workspaceId: WS }), sets)).resolves.toBe(3)

        expect(fakes.flatMap((fake) => fake.callsOf("update"))).toEqual([[RecordEntity], [RecordEntity]])
        expect(fakes.flatMap((fake) => fake.callsOf("where"))).toEqual([
            [{ entity: ORDER.name, workspaceId: WS, id: In(["o-1", "o-2"]), deletedAt: IS_NULL }],
            [{ entity: LEAD.name, workspaceId: WS, id: In(["l-1"]), deletedAt: IS_NULL }],
        ])
        const [set] = fakes[0]?.callsOf("set")[0] ?? []
        expect(isSoftDeleteSet(set) ? [Object.keys(set).sort(), set.deletedAt(), set.version()] : null).toEqual([
            ["deletedAt", "version"],
            "now()",
            "version + 1",
        ])
        // No link and no record is removed.
        expect(em.delete).not.toHaveBeenCalled()
        expect(fakes.flatMap((fake) => fake.callsOf("delete"))).toEqual([])
    })

    it("works through a large agent in chunks of 500 ids", async () => {
        const policy = await buildPolicy()
        const { em, fakes } = updating([500, 500, 201])
        const ids = Array.from({ length: 1201 }, (_, index) => `o-${String(index)}`)

        await expect(
            policy.softDeleteAgentRecords(mintScopedTx({ manager: em, workspaceId: WS }), [{ entity: ORDER.name, ids }]),
        ).resolves.toBe(1201)

        expect(fakes.flatMap((fake) => fake.callsOf("update"))).toHaveLength(3)
    })

    it("does nothing for no sets", async () => {
        const policy = await buildPolicy()
        const { em } = updating([])
        await expect(policy.softDeleteAgentRecords(mintScopedTx({ manager: em, workspaceId: WS }), [])).resolves.toBe(0)
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})
