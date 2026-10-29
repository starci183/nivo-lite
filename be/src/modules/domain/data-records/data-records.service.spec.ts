import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { DataRecordInput } from "./data-records.contracts"
import { DataRecordsService } from "./data-records.service"
import { DataRecordEntity } from "./persistence/entities"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"

const KEYS = ["connectionId", "entity", "externalId"]

/** The rows of one upsert with their sync stamp (a function expression) called, so the SQL it writes can be compared. */
const stamped = (rows: unknown): ReadonlyArray<unknown> => (Array.isArray(rows) ? rows.map(evaluatedValues) : [])

/** What each upsert wrote: the entity, the stamped rows, and the conflict keys. */
const upsertsOf = (em: MockEntityManager) =>
    em.upsert.mock.calls.map(([target, rows, keys]) => [target, stamped(rows), keys])

const build = async () => {
    const entityManager = mockEntityManager()
    const moduleRef = await Test.createTestingModule({
        providers: [DataRecordsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return { service: moduleRef.get(DataRecordsService), entityManager }
}

describe("DataRecordsService upsert", () => {
    it("upsert has its first case written", async () => {
        const { service } = await build()
        expect(service.upsert).toBeInstanceOf(Function)
    })
    it("skips unusable ids and writes the mapped fields with bounded titles and normalized dates", async () => {
        const { service, entityManager } = await build()
        entityManager.upsert.mockResolvedValue({ identifiers: [], generatedMaps: [], raw: [] })
        const boundaryId = "i".repeat(300)
        const rows: ReadonlyArray<DataRecordInput> = [
            { externalId: "", data: { skipped: true } },
            { externalId: "i".repeat(301), data: { skipped: true } },
            { externalId: boundaryId, title: "t".repeat(301), data: { amount: 12 } },
            { externalId: "null-time", occurredAt: null, data: { nested: { active: true } } },
            {
                externalId: "string-time",
                title: "Order 1",
                occurredAt: "2026-01-02T10:30:00+07:00",
                data: { tags: ["paid"] },
            },
            {
                externalId: "date-time",
                title: "",
                occurredAt: new Date("2026-02-03T04:05:06.789Z"),
                data: {},
            },
        ]
        const stamp = { workspaceId: "ws-1", connectionId: "c-1", entity: "order", syncedAt: "now()" }

        await expect(service.upsert("ws-1", "c-1", "order", rows)).resolves.toBe(4)

        expect(entityManager.upsert).toHaveBeenCalledTimes(1)
        expect(upsertsOf(entityManager)).toEqual([
            [
                DataRecordEntity,
                [
                    {
                        ...stamp,
                        externalId: boundaryId,
                        title: "t".repeat(300),
                        occurredAt: null,
                        data: { amount: 12 },
                    },
                    {
                        ...stamp,
                        externalId: "null-time",
                        title: "",
                        occurredAt: null,
                        data: { nested: { active: true } },
                    },
                    {
                        ...stamp,
                        externalId: "string-time",
                        title: "Order 1",
                        occurredAt: new Date("2026-01-02T03:30:00.000Z"),
                        data: { tags: ["paid"] },
                    },
                    {
                        ...stamp,
                        externalId: "date-time",
                        title: "",
                        occurredAt: new Date("2026-02-03T04:05:06.789Z"),
                        data: {},
                    },
                ],
                KEYS,
            ],
        ])
    })
})

describe("DataRecordsService upsert input", () => {
    it.each([
        { label: "empty", rows: [] },
        {
            label: "unusable",
            rows: [
                { externalId: "", data: {} },
                { externalId: "i".repeat(301), data: {} },
            ],
        },
    ])("answers zero without a query when the input is $label", async ({ rows }) => {
        const { service, entityManager } = await build()

        await expect(service.upsert("ws-1", "c-1", "other", rows)).resolves.toBe(0)

        expect(entityManager.upsert).not.toHaveBeenCalled()
    })
})

describe("DataRecordsService upsert", () => {
    it("writes at most 500 usable rows in each query, preserving the input order", async () => {
        const { service, entityManager } = await build()
        entityManager.upsert.mockResolvedValue({ identifiers: [], generatedMaps: [], raw: [] })
        const rows = Array.from({ length: 501 }, (_unused, index) => ({ externalId: `id-${index}`, data: {} }))
        const written = (index: number) => ({
            workspaceId: "ws-2",
            connectionId: "c-2",
            entity: "product",
            externalId: `id-${index}`,
            title: "",
            occurredAt: null,
            data: {},
            syncedAt: "now()",
        })

        await expect(service.upsert("ws-2", "c-2", "product", rows)).resolves.toBe(501)

        expect(upsertsOf(entityManager)).toEqual([
            [DataRecordEntity, Array.from({ length: 500 }, (_unused, index) => written(index)), KEYS],
            [DataRecordEntity, [written(500)], KEYS],
        ])
    })
    it("propagates a rejected write and does not start a later batch", async () => {
        const { service, entityManager } = await build()
        const failure = new TypeError("write refused")
        entityManager.upsert.mockRejectedValue(failure)
        const rows = Array.from({ length: 501 }, (_unused, index) => ({ externalId: `id-${index}`, data: {} }))

        await expect(service.upsert("ws-1", "c-1", "message", rows)).rejects.toBe(failure)

        expect(entityManager.upsert).toHaveBeenCalledTimes(1)
    })
    it("rejects an invalid occurrence date before querying", async () => {
        const { service, entityManager } = await build()

        await expect(
            service.upsert("ws-1", "c-1", "document", [{ externalId: "id-1", occurredAt: "invalid", data: {} }]),
        ).rejects.toBeInstanceOf(RangeError)

        expect(entityManager.upsert).not.toHaveBeenCalled()
    })
})

describe("DataRecordsService countExisting", () => {
    it("countExisting has its first case written", async () => {
        const { service } = await build()
        expect(service.countExisting).toBeInstanceOf(Function)
    })
    it("counts the held ids in one statement with the ids as one array parameter", async () => {
        const { service, entityManager } = await build()
        const [counter] = queueQueryBuilders(entityManager, [{ getCount: 9 }])
        const ids = Array.from({ length: 1001 }, (_unused, index) => `id-${index}`)

        await expect(service.countExisting("c-1", "customer", ids)).resolves.toBe(9)

        expect(entityManager.createQueryBuilder).toHaveBeenCalledTimes(1)
        expect(entityManager.createQueryBuilder).toHaveBeenCalledWith(DataRecordEntity, "d")
        expect(counter?.callsOf("where")).toEqual([
            ["d.connection_id = :connectionId AND d.entity = :entity", { connectionId: "c-1", entity: "customer" }],
        ])
        expect(counter?.callsOf("andWhere")).toEqual([["d.external_id = ANY(:ids)", { ids }]])
    })
    it("answers zero without querying an empty id list", async () => {
        const { service, entityManager } = await build()

        await expect(service.countExisting("c-1", "transaction", [])).resolves.toBe(0)

        expect(entityManager.createQueryBuilder).not.toHaveBeenCalled()
    })
})

describe("DataRecordsService count", () => {
    it("count has its first case written", async () => {
        const { service } = await build()
        expect(service.count).toBeInstanceOf(Function)
    })
    it.each([12, 0])("answers the number of rows the connection holds (%j)", async (expected) => {
        const { service, entityManager } = await build()
        entityManager.count.mockResolvedValue(expected)

        await expect(service.count("c-2")).resolves.toBe(expected)

        expect(entityManager.count).toHaveBeenCalledTimes(1)
        expect(entityManager.count).toHaveBeenCalledWith(DataRecordEntity, { where: { connectionId: "c-2" } })
    })
})
