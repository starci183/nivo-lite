import { mock, mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionRecord } from "@modules/domain/connections"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { answerByTable } from "@tests/fixtures/builders/table-query-builder.builder"
import { stampedValues } from "@tests/fixtures/builders/entity-row.builder"
import { SepayConnectionService } from "./sepay-connection.service"

const actor = { principalId: "owner-1", workspaceId: "ws-1" }
const BULLETS = "•".repeat(12)

const feed = (overrides: Partial<ConnectionRecord> = {}): ConnectionRecord => ({
    id: "c1",
    workspaceId: "ws-1",
    provider: "sepay",
    name: "VCB chinh",
    meta: {
        bank_code: "VCB",
        account_masked: "•••• 6789",
        account_number: "0123456789",
        account_holder: "LAN",
    },
    status: "connected",
    lastError: null,
    environment: "test",
    isDefault: false,
    lastEventAt: null,
    firstEvent: null,
    createdBy: "owner-1",
    createdAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
})

const build = async (connection: ConnectionRecord = feed()) => {
    const connections = mock<ConnectionsService>()
    connections.authorize.mockResolvedValue({ role: "owner", displayName: "Lan" })
    connections.get.mockResolvedValue(connection)
    connections.readSecret.mockResolvedValue({ plain: "nivo_secretvalue3f9a", webhookSecret: "digest" })
    connections.agentIds.mockResolvedValue(["agent-1"])
    connections.webhookUrl.mockReturnValue("https://app.example/api/connections/sepay/c1")
    connections.patch.mockResolvedValue(undefined)
    const manager = mockEntityManager()
    let answer: ReadonlyArray<unknown> = []
    let failure: Error | null = null
    const seen = answerByTable(manager, {
        "": () => (failure === null ? answer : Promise.reject(failure)),
    })
    const rows = {
        set: (next: ReadonlyArray<unknown>) => {
            answer = next
        },
        fail: (error: Error) => {
            failure = error
        },
    }
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            SepayConnectionService,
            { provide: ConnectionsService, useValue: connections },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: manager },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(SepayConnectionService), connections, manager, logger, rows, seen }
}

describe("SepayConnectionService read", () => {
    it("answers the page model with the key and the account masked and the health counters", async () => {
        const { service, rows } = await build()
        rows.set([
            {
                lastAt: "2026-10-28T06:59:00.000Z",
                pingAt: "2026-10-28T06:58:00.000Z",
                transactionAt: null,
                total24h: "3",
                valid24h: "2",
                duplicate24h: "1",
            },
        ])

        const view = await service.read(actor, "c1")

        expect(view).toMatchObject({
            id: "c1",
            environment: "test",
            accountMasked: "•••• 6789",
            hasFullAccount: true,
            apiKeyMasked: `${BULLETS}3f9a`,
            pingSeenAt: "2026-10-28T06:58:00.000Z",
            transactionSeenAt: null,
            health: { lastWebhookAt: "2026-10-28T06:59:00.000Z", validCount: 2, totalCount: 3, duplicateCount: 1 },
            agentIds: ["agent-1"],
        })
        expect(JSON.stringify(view)).not.toContain("secretvalue")
        expect(JSON.stringify(view)).not.toContain("0123456789")
    })

    it("reads a connection with no delivery yet as empty health", async () => {
        const { service } = await build()

        await expect(service.read(actor, "c1")).resolves.toMatchObject({
            pingSeenAt: null,
            health: { lastWebhookAt: null, validCount: 0, totalCount: 0, duplicateCount: 0 },
        })
    })

    it("refuses a connection of another provider", async () => {
        const { service } = await build(feed({ provider: "casso" }))

        await expect(service.read(actor, "c1")).rejects.toMatchObject({ code: "CONNECTIONS_NOT_FOUND" })
    })
})

describe("SepayConnectionService events", () => {
    it("lists the newest deliveries as typed events", async () => {
        const { service, rows } = await build()
        rows.set([
            {
                id: "e1",
                at: "2026-10-28T06:59:00.000Z",
                outcome: "duplicate",
                kind: "credit",
                amountVnd: "2000",
                providerEventId: "92704",
                environment: "test",
            },
        ])

        await expect(service.events(actor, "c1")).resolves.toEqual([
            {
                id: "e1",
                at: "2026-10-28T06:59:00.000Z",
                outcome: "duplicate",
                kind: "credit",
                amountVnd: 2000,
                providerEventId: "92704",
                environment: "test",
            },
        ])
    })
})

describe("SepayConnectionService setEnvironment", () => {
    it("lets only the owner switch and patches the environment", async () => {
        const { service, connections } = await build()

        await service.setEnvironment(actor, "c1", "live")

        expect(connections.authorize).toHaveBeenCalledWith(actor, ["owner"])
        expect(connections.patch).toHaveBeenCalledWith("ws-1", "c1", { environment: "live" })
    })
})

describe("SepayConnectionService deliveries", () => {
    it("remembers a ping before the intake and a credit after it", async () => {
        const { service, seen } = await build()
        const order: Array<string> = []
        const intake = jest.fn(() => {
            order.push(`intake after ${seen.queries.length} remembered`)
            return Promise.resolve()
        })

        await service.traceIntake("c1", Buffer.from(JSON.stringify({ id: 1 })), intake)
        await service.traceIntake(
            "c1",
            Buffer.from(JSON.stringify({ id: 2, transferType: "in", transferAmount: 2000 })),
            intake,
        )

        expect(order).toEqual(["intake after 1 remembered", "intake after 1 remembered"])
        expect(seen.queries).toHaveLength(2)
        expect(seen.queries[1]?.callsOf("setParameters")).toEqual([
            [{ connectionId: "c1", outcome: "accepted", kind: "credit", amount: 2000, eventId: "2" }],
        ])
        expect(Object.keys(stampedValues(seen.queries[1]?.callsOf("values")[0]?.[0]))).toEqual([
            "workspaceId",
            "connectionId",
            "environment",
            "outcome",
            "kind",
            "amountVnd",
            "providerEventId",
        ])
    })

    it("does not remember a credit whose intake failed", async () => {
        const { service, seen } = await build()
        const raw = Buffer.from(JSON.stringify({ id: 2, transferType: "in", transferAmount: 5 }))

        await expect(service.traceIntake("c1", raw, () => Promise.reject(new Error("intake")))).rejects.toThrow(
            "intake",
        )

        expect(seen.queries).toHaveLength(0)
    })

    it("remembers a refused key as unauthorized, and logs instead of failing when the write fails", async () => {
        const { service, rows, logger, seen } = await build()
        rows.fail(new Error("down"))

        await expect(service.traceRefusal("c1")).resolves.toBeUndefined()

        expect(seen.queries).toHaveLength(1)
        expect(seen.queries[0]?.callsOf("setParameters")).toEqual([
            [{ connectionId: "c1", outcome: "unauthorized", kind: "ping", amount: null, eventId: null }],
        ])
        expect(logger.warn).toHaveBeenCalledTimes(1)
    })
})
