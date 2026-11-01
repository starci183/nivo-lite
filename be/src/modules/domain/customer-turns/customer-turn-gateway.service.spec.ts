import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { Installation } from "@modules/domain/agents"
import type { CustomerTurn } from "@modules/domain/conversations"
import { AgentTurnsLogEvent } from "@modules/domain/agent-turns"
import { AgentSyncService } from "@modules/domain/openclaw-agent-sync"
import { OPENCLAW_AGENT_REGISTRY, OPENCLAW_GATEWAY, agentIdFor, threadKeyFor } from "@modules/integrations/openclaw"
import type { AgentRegistryService, GatewayClient, TurnResult } from "@modules/integrations/openclaw"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CustomerTurnGatewayService } from "./customer-turn-gateway.service"

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111"
const MODULE = "chatbot"
const installation = mock<Installation>({ id: "i1" })
const turn = mock<CustomerTurn>({
    conversation: mock<CustomerTurn["conversation"]>({ id: "c1" }),
    messageId: "m1",
})
const result: TurnResult = { text: "Prepared answer", usage: null, timings: {} }

const build = async () => {
    const configured = jest.fn(() => true)
    const gateway = mock<GatewayClient>({ runTurn: jest.fn(() => Promise.resolve(result)) })
    Object.defineProperty(gateway, "enabled", { get: configured })
    const registry = mock<AgentRegistryService>({ has: jest.fn(() => false) })
    const sync = mock<AgentSyncService>({
        syncInstallation: jest.fn(() => Promise.resolve(null)),
        ensureInternalAgent: jest.fn(() => Promise.resolve("internal-agent")),
    })
    const logger = mock<Logger>({ error: jest.fn() })
    const moduleRef = await Test.createTestingModule({
        providers: [
            CustomerTurnGatewayService,
            { provide: OPENCLAW_GATEWAY, useValue: gateway },
            { provide: OPENCLAW_AGENT_REGISTRY, useValue: registry },
            { provide: AgentSyncService, useValue: sync },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return {
        service: moduleRef.get(CustomerTurnGatewayService),
        configured,
        gateway,
        registry,
        sync,
        logger,
    }
}

describe("CustomerTurnGatewayService", () => {
    afterEach(() => jest.restoreAllMocks())

    it("reads the current gateway configuration without selecting an agent", async () => {
        const { service, configured, registry, sync } = await build()

        expect(service.configured()).toBe(true)
        configured.mockReturnValueOnce(false)
        expect(service.configured()).toBe(false)
        expect(configured).toHaveBeenCalledTimes(2)
        expect(registry.has).not.toHaveBeenCalled()
        expect(sync.ensureInternalAgent).not.toHaveBeenCalled()
    })

    it("uses the registered module agent before attempting a sync or fallback", async () => {
        const { service, registry, sync } = await build()
        registry.has.mockReturnValueOnce(true)

        await expect(service.agentFor(WORKSPACE_ID, MODULE, installation)).resolves.toBe(
            agentIdFor(WORKSPACE_ID, MODULE),
        )
        expect(registry.has).toHaveBeenCalledWith(agentIdFor(WORKSPACE_ID, MODULE))
        expect(sync.syncInstallation).not.toHaveBeenCalled()
        expect(sync.ensureInternalAgent).not.toHaveBeenCalled()
    })

    it("uses the installation's freshly synced agent", async () => {
        const { service, registry, sync, logger } = await build()
        sync.syncInstallation.mockResolvedValueOnce({
            agentId: "synced-agent",
            contextVersion: 1,
            contentHash: "content-hash",
            files: 1,
            changed: false,
            written: 0,
            removed: 0,
            registered: false,
        })

        await expect(service.agentFor(WORKSPACE_ID, MODULE, installation)).resolves.toBe("synced-agent")
        expect(registry.has.mock.invocationCallOrder[0]).toBeLessThan(
            sync.syncInstallation.mock.invocationCallOrder[0] ?? 0,
        )
        expect(sync.syncInstallation).toHaveBeenCalledWith(WORKSPACE_ID, "i1", true)
        expect(sync.ensureInternalAgent).not.toHaveBeenCalled()
        expect(logger.error).not.toHaveBeenCalled()
    })

    it("uses the internal agent without syncing when no installation remains", async () => {
        const { service, sync, logger } = await build()

        await expect(service.agentFor(WORKSPACE_ID, MODULE, null)).resolves.toBe("internal-agent")
        expect(sync.syncInstallation).not.toHaveBeenCalled()
        expect(sync.ensureInternalAgent).toHaveBeenCalledWith(WORKSPACE_ID)
        expect(logger.error).not.toHaveBeenCalled()
    })

    it("uses the internal agent when syncing finds no installation", async () => {
        const { service, sync, logger } = await build()

        await expect(service.agentFor(WORKSPACE_ID, MODULE, installation)).resolves.toBe("internal-agent")
        expect(sync.syncInstallation).toHaveBeenCalledWith(WORKSPACE_ID, "i1", true)
        expect(sync.ensureInternalAgent).toHaveBeenCalledWith(WORKSPACE_ID)
        expect(sync.syncInstallation.mock.invocationCallOrder[0]).toBeLessThan(
            sync.ensureInternalAgent.mock.invocationCallOrder[0] ?? 0,
        )
        expect(logger.error).not.toHaveBeenCalled()
    })
})

describe("CustomerTurnGatewayService", () => {
    afterEach(() => jest.restoreAllMocks())

    it("logs a failed installation sync before falling back to the internal agent", async () => {
        const { service, sync, logger } = await build()
        const cause = new Error("installation sync failed")
        sync.syncInstallation.mockRejectedValueOnce(cause)

        await expect(service.agentFor(WORKSPACE_ID, MODULE, installation)).resolves.toBe("internal-agent")
        expect(logger.error).toHaveBeenCalledWith(AgentTurnsLogEvent.AgentSyncFailed, cause, {
            installationId: "i1",
        })
        expect(logger.error.mock.invocationCallOrder[0]).toBeLessThan(
            sync.ensureInternalAgent.mock.invocationCallOrder[0] ?? 0,
        )
    })

    it("leaves an internal-agent failure for the runtime's turn failure handler", async () => {
        const { service, sync, logger } = await build()
        const cause = new Error("internal agent unavailable")
        sync.ensureInternalAgent.mockRejectedValueOnce(cause)

        await expect(service.agentFor(WORKSPACE_ID, MODULE, null)).rejects.toBe(cause)
        expect(logger.error).not.toHaveBeenCalled()
    })

    it("sends the prepared message with the same thread, message replay key, timeout and abort grace", async () => {
        const { service, gateway } = await build()
        const signal = new AbortController().signal
        const timeout = jest.spyOn(AbortSignal, "timeout").mockReturnValue(signal)

        await expect(
            service.run(turn, turn.conversation, "module-agent", "Prepared context and message", 25_000),
        ).resolves.toBe(result)
        expect(gateway.runTurn).toHaveBeenCalledWith(
            {
                agentId: "module-agent",
                threadKey: threadKeyFor("module-agent", "c1"),
                message: "Prepared context and message",
                idempotencyKey: "chat-m1",
                attachments: [],
                timeoutMs: 25_000,
            },
            signal,
        )
        expect(timeout).toHaveBeenCalledWith(30_000)
        expect(timeout).toHaveBeenCalledTimes(1)
    })

    it("leaves a gateway rejection for the runtime's turn failure handler", async () => {
        const { service, gateway, logger } = await build()
        const cause = new Error("gateway unavailable")
        gateway.runTurn.mockRejectedValueOnce(cause)
        jest.spyOn(AbortSignal, "timeout").mockReturnValue(new AbortController().signal)

        await expect(
            service.run(turn, turn.conversation, "module-agent", "Prepared context and message", 25_000),
        ).rejects.toBe(cause)
        expect(logger.error).not.toHaveBeenCalled()
    })
})

describe("CustomerTurnGatewayService", () => {
    afterEach(() => jest.restoreAllMocks())

    it("uses the conversation already captured by the runtime without reading it again from the turn", async () => {
        const { service, gateway } = await build()
        const currentTurn = mock<CustomerTurn>({ messageId: "m2" })
        const conversation = jest.fn(() => mock<CustomerTurn["conversation"]>({ id: "new-conversation" }))
        Object.defineProperty(currentTurn, "conversation", { get: conversation })
        jest.spyOn(AbortSignal, "timeout").mockReturnValue(new AbortController().signal)

        await service.run(currentTurn, turn.conversation, "module-agent", "Prepared context and message", 25_000)

        expect(gateway.runTurn).toHaveBeenCalledWith(
            expect.objectContaining({ threadKey: threadKeyFor("module-agent", "c1") }),
            expect.any(AbortSignal),
        )
        expect(conversation).not.toHaveBeenCalled()
    })

    it("replays the same gateway action after a later retry while keeping another message distinct", async () => {
        jest.useFakeTimers({ now: new Date("2026-10-13T10:00:00.000Z") })
        try {
            const { service, gateway } = await build()
            const executed = jest.fn()
            const receipts = new Set<string>()
            gateway.runTurn.mockImplementation((request) => {
                if (!receipts.has(request.idempotencyKey)) {
                    receipts.add(request.idempotencyKey)
                    executed(request.message)
                }
                return Promise.resolve(result)
            })

            await service.run(turn, turn.conversation, "module-agent", "First request", 25_000)
            jest.advanceTimersByTime(60_000)
            await service.run(turn, turn.conversation, "module-agent", "Retried request", 25_000)

            expect(executed).toHaveBeenCalledTimes(1)
            expect(gateway.runTurn).toHaveBeenCalledTimes(2)

            await service.run({ ...turn, messageId: "m2" }, turn.conversation, "module-agent", "Next request", 25_000)

            expect(executed).toHaveBeenCalledTimes(2)
            expect(executed).toHaveBeenLastCalledWith("Next request")
        } finally {
            jest.useRealTimers()
        }
    })
})
