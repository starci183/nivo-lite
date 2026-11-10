import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { EngineResult, EntitiesApi, ListPage, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { EntityEngineService, EntityPortsService } from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { CLOCK } from "@modules/platform/clock"
import type { PaymentMovement } from "./payment-transactions.contracts"
import { PaymentTransactionsService } from "./payment-transactions.service"

const WORKSPACE = "11111111-1111-4111-8111-111111111111"
const NOW = new Date("2026-11-05T09:30:00.000Z")

const MOVEMENT: PaymentMovement = {
    direction: "credit",
    amountVnd: 5_000_000,
    reference: "NIVO8F3K2 chuyen tien",
    payer: "NGUYEN VAN DINH",
    externalRef: "sepay:95958515",
    account: "0123456789",
    connectionId: "77777777-7777-4777-8777-777777777777",
    occurredAt: "2026-11-05T07:02:37.000Z",
}

const recordOf = (data: Readonly<Record<string, unknown>>): RecordRow => ({
    id: "55555555-5555-4555-8555-555555555555",
    workspaceId: WORKSPACE,
    version: "1",
    createdAt: "2026-11-05T09:00:00.000Z",
    updatedAt: "2026-11-05T09:00:00.000Z",
    data,
})

const build = async () => {
    const engine = mock<EntityEngineService>()
    const ports = mock<EntityPortsService>()
    const api = mock<EntitiesApi>()
    const scoped = mock<ScopedTx>()
    engine.within.mockImplementation((_manager, _workspace, work) => work(scoped))
    engine.scoped.mockImplementation((_workspace, work) => work(scoped))
    ports.entitiesApi.mockReturnValue(api)
    const moduleRef = await Test.createTestingModule({
        providers: [
            PaymentTransactionsService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: EntityEngineService, useValue: engine },
            { provide: EntityPortsService, useValue: ports },
        ],
    }).compile()
    return { service: moduleRef.get(PaymentTransactionsService), engine, api, tx: fakeTransaction(mockEntityManager()) }
}

const made = (created: boolean | undefined): EngineResult => {
    const row = recordOf({})
    return created === undefined ? { ok: true, row, version: "1" } : { ok: true, row, version: "1", created }
}

describe("PaymentTransactionsService record", () => {
    it("ensures the record by its provider transaction id on the caller's transaction and says it was made", async () => {
        const { service, engine, api, tx } = await build()
        api.ensure.mockResolvedValue(made(true))

        await expect(service.record(tx.em, WORKSPACE, MOVEMENT)).resolves.toEqual({
            id: "55555555-5555-4555-8555-555555555555",
            created: true,
        })

        expect(engine.within).toHaveBeenCalledWith(tx.em, WORKSPACE, expect.any(Function))
        expect(api.ensure).toHaveBeenCalledWith("payment.transaction", "external_ref", {
            channel: "bank",
            direction: "credit",
            amountVnd: 5_000_000,
            reference: "NIVO8F3K2 chuyen tien",
            payer: "NGUYEN VAN DINH",
            externalRef: "sepay:95958515",
            account: "0123456789",
            connectionId: "77777777-7777-4777-8777-777777777777",
            occurredAt: "2026-11-05T07:02:37.000Z",
            status: "unmatched",
        })
    })

    it("answers created false for a transaction recorded before, and takes the clock for a movement with no time", async () => {
        const { service, api, tx } = await build()
        api.ensure.mockResolvedValue(made(undefined))

        await expect(service.record(tx.em, WORKSPACE, { ...MOVEMENT, occurredAt: null })).resolves.toMatchObject({
            created: false,
        })

        expect(api.ensure).toHaveBeenCalledWith(
            "payment.transaction",
            "external_ref",
            expect.objectContaining({ occurredAt: "2026-11-05T09:30:00.000Z" }),
        )
    })

    it("answers null when the engine refused the record", async () => {
        const { service, api, tx } = await build()
        api.ensure.mockResolvedValue({ ok: false, reason: "invalid" })

        await expect(service.record(tx.em, WORKSPACE, MOVEMENT)).resolves.toBeNull()
    })
})

describe("PaymentTransactionsService list", () => {
    const pageOf = (rows: ReadonlyArray<RecordRow>): ListPage => ({
        rows: rows.map((row) => ({ row, joined: {}, position: [], included: {} })),
        next: null,
    })

    it("reads the newest movements of the direction, narrowed by status and start", async () => {
        const { service, engine, api } = await build()
        api.list.mockResolvedValue(
            pageOf([
                recordOf({
                    amountVnd: 5_000_000,
                    reference: "NIVO8F3K2",
                    payer: "NGUYEN VAN DINH",
                    status: "matched",
                    occurredAt: "2026-11-05T07:02:37.000Z",
                }),
            ]),
        )

        await expect(
            service.list(WORKSPACE, {
                direction: "credit",
                status: "matched",
                since: "2026-11-01T00:00:00.000Z",
                limit: 5,
            }),
        ).resolves.toEqual([
            {
                id: "55555555-5555-4555-8555-555555555555",
                amountVnd: 5_000_000,
                reference: "NIVO8F3K2",
                payer: "NGUYEN VAN DINH",
                status: "matched",
                occurredAt: "2026-11-05T07:02:37.000Z",
            },
        ])

        expect(engine.scoped).toHaveBeenCalledWith(WORKSPACE, expect.any(Function))
        expect(api.list).toHaveBeenCalledWith({
            from: "payment.transaction",
            select: ["amountVnd", "reference", "payer", "status", "occurredAt"],
            where: {
                op: "and",
                of: [
                    { op: "eq", field: "direction", value: "credit" },
                    { op: "eq", field: "status", value: "matched" },
                    { op: "gte", field: "occurredAt", value: "2026-11-01T00:00:00.000Z" },
                ],
            },
            order: [
                ["occurredAt", "desc"],
                ["id", "desc"],
            ],
            page: { size: 5 },
        })
    })

    it("asks for the direction alone when there is no status or start, and fills what a record lacks", async () => {
        const { service, api } = await build()
        api.list.mockResolvedValue(pageOf([recordOf({ amountVnd: "x", reference: 5 })]))

        await expect(
            service.list(WORKSPACE, { direction: "debit", status: null, since: null, limit: 20 }),
        ).resolves.toEqual([
            {
                id: "55555555-5555-4555-8555-555555555555",
                amountVnd: 0,
                reference: null,
                payer: null,
                status: "unmatched",
                occurredAt: "2026-11-05T09:00:00.000Z",
            },
        ])

        expect(api.list).toHaveBeenCalledWith(
            expect.objectContaining({ where: { op: "and", of: [{ op: "eq", field: "direction", value: "debit" }] } }),
        )
    })
})
