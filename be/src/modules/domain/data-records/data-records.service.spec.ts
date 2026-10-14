import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { DataRecordInput } from "./data-records.contracts"
import { DataRecordsService } from "./data-records.service"
import { COUNT_DATA_RECORDS, COUNT_EXISTING_DATA_RECORDS, UPSERT_DATA_RECORDS } from "./persistence/data-records.sql"

const build = async () => {
    const entityManager = mockEntityManager()
    const moduleRef = await Test.createTestingModule({
        providers: [DataRecordsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return { service: moduleRef.get(DataRecordsService), entityManager }
}

describe("DataRecordsService", () => {
    describe("upsert", () => {
        it("upsert has its first case written", async () => {
            const { service } = await build()
            expect(service.upsert).toBeInstanceOf(Function)
        })

        it("skips unusable ids and writes the mapped fields with bounded titles and normalized dates", async () => {
            const { service, entityManager } = await build()
            entityManager.query.mockResolvedValue([])
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

            await expect(service.upsert("ws-1", "c-1", "order", rows)).resolves.toBe(4)

            expect(entityManager.query).toHaveBeenCalledTimes(1)
            expect(entityManager.query).toHaveBeenCalledWith(UPSERT_DATA_RECORDS, [
                "ws-1",
                "c-1",
                "order",
                JSON.stringify([
                    { external_id: boundaryId, title: "t".repeat(300), occurred_at: null, data: { amount: 12 } },
                    { external_id: "null-time", title: "", occurred_at: null, data: { nested: { active: true } } },
                    {
                        external_id: "string-time",
                        title: "Order 1",
                        occurred_at: "2026-01-02T03:30:00.000Z",
                        data: { tags: ["paid"] },
                    },
                    { external_id: "date-time", title: "", occurred_at: "2026-02-03T04:05:06.789Z", data: {} },
                ]),
            ])
        })

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

            expect(entityManager.query).not.toHaveBeenCalled()
        })

        it("writes at most 500 usable rows in each query, preserving the input order", async () => {
            const { service, entityManager } = await build()
            entityManager.query.mockResolvedValue([])
            const rows = Array.from({ length: 501 }, (_unused, index) => ({ externalId: `id-${index}`, data: {} }))
            const firstChunk = Array.from({ length: 500 }, (_unused, index) => ({
                external_id: `id-${index}`,
                title: "",
                occurred_at: null,
                data: {},
            }))

            await expect(service.upsert("ws-2", "c-2", "product", rows)).resolves.toBe(501)

            expect(entityManager.query).toHaveBeenCalledTimes(2)
            expect(entityManager.query).toHaveBeenNthCalledWith(1, UPSERT_DATA_RECORDS, [
                "ws-2",
                "c-2",
                "product",
                JSON.stringify(firstChunk),
            ])
            expect(entityManager.query).toHaveBeenNthCalledWith(2, UPSERT_DATA_RECORDS, [
                "ws-2",
                "c-2",
                "product",
                JSON.stringify([{ external_id: "id-500", title: "", occurred_at: null, data: {} }]),
            ])
        })

        it("propagates a rejected write and does not start a later batch", async () => {
            const { service, entityManager } = await build()
            const failure = new TypeError("write refused")
            entityManager.query.mockRejectedValue(failure)
            const rows = Array.from({ length: 501 }, (_unused, index) => ({ externalId: `id-${index}`, data: {} }))

            await expect(service.upsert("ws-1", "c-1", "message", rows)).rejects.toBe(failure)

            expect(entityManager.query).toHaveBeenCalledTimes(1)
        })

        it("rejects an invalid occurrence date before querying", async () => {
            const { service, entityManager } = await build()

            await expect(
                service.upsert("ws-1", "c-1", "document", [{ externalId: "id-1", occurredAt: "invalid", data: {} }]),
            ).rejects.toBeInstanceOf(RangeError)

            expect(entityManager.query).not.toHaveBeenCalled()
        })
    })

    describe("countExisting", () => {
        it("countExisting has its first case written", async () => {
            const { service } = await build()
            expect(service.countExisting).toBeInstanceOf(Function)
        })

        it("adds counts across 500-id batches and treats a missing result row as zero", async () => {
            const { service, entityManager } = await build()
            entityManager.query
                .mockResolvedValueOnce([{ n: 7 }])
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([{ n: 2 }])
            const ids = Array.from({ length: 1001 }, (_unused, index) => `id-${index}`)

            await expect(service.countExisting("c-1", "customer", ids)).resolves.toBe(9)

            expect(entityManager.query).toHaveBeenCalledTimes(3)
            expect(entityManager.query).toHaveBeenNthCalledWith(1, COUNT_EXISTING_DATA_RECORDS, [
                "c-1",
                "customer",
                ids.slice(0, 500),
            ])
            expect(entityManager.query).toHaveBeenNthCalledWith(2, COUNT_EXISTING_DATA_RECORDS, [
                "c-1",
                "customer",
                ids.slice(500, 1000),
            ])
            expect(entityManager.query).toHaveBeenNthCalledWith(3, COUNT_EXISTING_DATA_RECORDS, [
                "c-1",
                "customer",
                ["id-1000"],
            ])
        })

        it("answers zero without querying an empty id list", async () => {
            const { service, entityManager } = await build()

            await expect(service.countExisting("c-1", "transaction", [])).resolves.toBe(0)

            expect(entityManager.query).not.toHaveBeenCalled()
        })

        it("propagates a rejected count query", async () => {
            const { service, entityManager } = await build()
            const failure = new TypeError("count refused")
            entityManager.query.mockRejectedValue(failure)

            await expect(service.countExisting("c-1", "other", ["id-1"])).rejects.toBe(failure)

            expect(entityManager.query).toHaveBeenCalledWith(COUNT_EXISTING_DATA_RECORDS, ["c-1", "other", ["id-1"]])
        })
    })

    describe("count", () => {
        it("count has its first case written", async () => {
            const { service } = await build()
            expect(service.count).toBeInstanceOf(Function)
        })

        it.each([
            [[{ n: 12 }], 12],
            [[{ n: 0 }], 0],
            [[], 0],
        ] as const)("answers the returned count or zero when the result row is absent (%j)", async (rows, expected) => {
            const { service, entityManager } = await build()
            entityManager.query.mockResolvedValue(rows)

            await expect(service.count("c-2")).resolves.toBe(expected)

            expect(entityManager.query).toHaveBeenCalledTimes(1)
            expect(entityManager.query).toHaveBeenCalledWith(COUNT_DATA_RECORDS, ["c-2"])
        })
    })
})
