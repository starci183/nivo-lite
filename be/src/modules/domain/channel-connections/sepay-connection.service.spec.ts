import { mock, mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { ConnectionsErrorCode, ConnectionsService } from "@modules/domain/connections"
import type { ConnectionRecord } from "@modules/domain/connections"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { answerByTable } from "@tests/fixtures/builders/table-query-builder.builder"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
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
    let failure: unknown = null
    const seen = answerByTable(manager, {
        "": () => (failure === null ? answer : Promise.reject(failure)),
    })
    const rows = {
        set: (next: ReadonlyArray<unknown>) => {
            answer = next
        },
        fail: (error: unknown) => {
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

describe("SepayConnectionService rotateKey", () => {
    it("seals a new key with its hash and answers it with the webhook address", async () => {
        const { service, connections } = await build()
        const result = await service.rotateKey(actor, "c1")
        expect(result.apiKey).toMatch(/^nivo_[0-9a-f]{64}$/u)
        expect(result.webhookUrl).toBe("https://app.example/api/connections/sepay/c1")
        expect(connections.authorize).toHaveBeenCalledWith(actor, ["owner"])
        expect(connections.writeSecret).toHaveBeenCalledWith(
            "c1",
            result.apiKey,
            expect.stringMatching(/^[0-9a-f]{64}$/u),
        )
    })

    it("refuses a connection that is not a SePay feed and writes nothing", async () => {
        const { service, connections } = await build(feed({ provider: "casso" }))
        await expect(service.rotateKey(actor, "c1")).rejects.toMatchObject({ code: ConnectionsErrorCode.NotFound })
        expect(connections.writeSecret).not.toHaveBeenCalled()
    })
})

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

const eventRow = (changes: Record<string, string | null>) => ({
    id: "e2",
    at: "2026-10-28T07:00:00.000Z",
    outcome: "accepted",
    kind: "ping",
    amountVnd: null,
    providerEventId: null,
    environment: "live",
    ...changes,
})

describe("SepayConnectionService event kinds", () => {
    it.each([
        ["unauthorized", "debit", "live"],
        ["accepted", "credit", "test"],
        ["mystery", "mystery", "mystery"],
    ])("types an event of outcome %s, kind %s and environment %s", async (outcome, kind, environment) => {
        const { service, rows } = await build()
        rows.set([eventRow({ outcome, kind, environment, amountVnd: kind === "debit" ? "150000" : null })])

        const [event] = await service.events(actor, "c1")

        expect(event).toEqual({
            id: "e2",
            at: "2026-10-28T07:00:00.000Z",
            outcome: outcome === "unauthorized" ? "unauthorized" : "accepted",
            kind: kind === "mystery" ? "ping" : kind,
            amountVnd: kind === "debit" ? 150000 : null,
            providerEventId: null,
            environment: environment === "test" ? "test" : "live",
        })
    })
})

describe("SepayConnectionService read of a bare connection", () => {
    it("shows empty account facts and a bullets-only key when the connection has none", async () => {
        const { service, connections } = await build(feed({ meta: {} }))
        connections.readSecret.mockResolvedValue(null)

        await expect(service.read(actor, "c1")).resolves.toMatchObject({
            bankCode: "",
            bank: "",
            accountMasked: "",
            hasFullAccount: false,
            holder: "",
            apiKeyMasked: BULLETS,
        })
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
        const feedOf = (column: string) =>
            `(SELECT c.${column} FROM public.connections c WHERE c.id = :connectionId AND c.provider = 'sepay')`
        expect(evaluatedValues(seen.queries[1]?.callsOf("values")[0]?.[0])).toEqual({
            workspaceId: feedOf("workspace_id"),
            connectionId: feedOf("id"),
            environment: feedOf("environment"),
            outcome: `CASE WHEN CAST(:outcome AS text) = 'accepted' AND CAST(:eventId AS text) IS NOT NULL AND EXISTS (SELECT 1 FROM public.channel_connections_sepay_events e WHERE e.connection_id = :connectionId AND e.outcome = 'accepted' AND e.provider_event_id = CAST(:eventId AS text)) THEN 'duplicate' ELSE CAST(:outcome AS text) END`,
            kind: "CAST(:kind AS text)",
            amountVnd: "CAST(:amount AS bigint)",
            providerEventId: "CAST(:eventId AS text)",
        })
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

    it("logs an unknown reason when the write fails with something that is not an error", async () => {
        const { service, rows, logger } = await build()
        rows.fail("down")

        await expect(service.traceRefusal("c1")).resolves.toBeUndefined()

        expect(logger.warn).toHaveBeenCalledWith("channel-connections.sepay.event_not_recorded", {
            connectionId: "c1",
            reason: "unknown",
        })
    })
})
