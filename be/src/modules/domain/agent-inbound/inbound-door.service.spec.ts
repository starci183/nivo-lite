import { Test } from "@nestjs/testing"
import { fakeIds, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { AgentRunsService } from "@modules/domain/agent-runs"
import { AgentEventWakesService } from "@modules/domain/agent-schedules"
import { AgentWakeService, AgentWorkAccessService, decodeInbound } from "@modules/domain/agent-work"
import { IDS } from "@modules/platform/ids"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { INBOUND_ADAPTER_REGISTRY, INBOUND_STOP_REPORTER } from "./agent-inbound.decorators"
import { AgentInboundError, AgentInboundErrorCode } from "./errors/agent-inbound.error"
import { CHAIN_DEPTH_MAX } from "./inbound-chain.policy"
import { PAYLOAD_BYTES_MAX } from "./inbound-event.policy"
import { InboundDoorService } from "./inbound-door.service"
import type { InboundAdapter, InboundEvent } from "./agent-inbound.contracts"
import type { InboundStopReporter } from "./agent-inbound-door.contracts"
import type { InboundAdapterRegistry } from "./agent-inbound.port"

const KEY = "door_spec_hook"

const adapter: InboundAdapter = {
    key: KEY,
    authentication: "signature",
    trustOf: () => "outsider",
    awaitsAnswer: false,
    replyStep: null,
    doorStep: "door",
    priority: 27,
    maxAttempts: 3,
}

const event = (over: Partial<InboundEvent> = {}): InboundEvent => ({
    adapter: KEY,
    eventType: "invoice.paid",
    actor: { kind: "webhook", id: "conn-1", role: null },
    chain: null,
    payload: { amount: 120 },
    attachments: [],
    evidence: [{ key: "endpoint", value: "conn-1", kind: "connection", via: KEY }],
    idempotencyKey: "conn-1:evt-1",
    workspaceId: "ws-1",
    agentId: null,
    scopeKey: null,
    ...over,
})

interface Options {
    readonly targets?: ReadonlyArray<{ readonly agentId: string; readonly probeKey: string | null }>
    readonly written?: ReadonlyArray<string | null>
    readonly reporter?: boolean
}

const NO_REPORTER: InboundStopReporter | null = null

const build = async ({
    targets = [{ agentId: "agent-1", probeKey: null }],
    written = ["wake-1"],
    reporter = true,
}: Options = {}) => {
    const tx = fakeTransaction(mockEntityManager())
    const events = mock<AgentEventWakesService>({ agentsFor: jest.fn().mockResolvedValue(targets) })
    const access = mock<AgentWorkAccessService>({ agent: jest.fn().mockResolvedValue(undefined) })
    const write = jest.fn()
    written.forEach((id) => write.mockResolvedValueOnce(id))
    const wakes = mock<AgentWakeService>({ write })
    const runs = mock<AgentRunsService>({ open: jest.fn().mockResolvedValue(undefined) })
    const logger = mock<Logger>()
    const stopReporter = mock<InboundStopReporter>({ report: jest.fn().mockResolvedValue(undefined) })
    const registry = mock<InboundAdapterRegistry>({
        of: jest.fn((key: string) => {
            if (key !== KEY) throw new AgentInboundError({ code: AgentInboundErrorCode.AdapterUnknown })
            return adapter
        }),
    })
    const builder = reporter
        ? Test.createTestingModule({
              providers: [
                  InboundDoorService,
                  { provide: INBOUND_ADAPTER_REGISTRY, useValue: registry },
                  { provide: AgentEventWakesService, useValue: events },
                  { provide: AgentWorkAccessService, useValue: access },
                  { provide: AgentWakeService, useValue: wakes },
                  { provide: AgentRunsService, useValue: runs },
                  { provide: IDS, useValue: fakeIds() },
                  { provide: LOGGER, useValue: logger },
                  { provide: INBOUND_STOP_REPORTER, useValue: stopReporter },
              ],
          })
        : Test.createTestingModule({
              providers: [
                  InboundDoorService,
                  { provide: INBOUND_ADAPTER_REGISTRY, useValue: registry },
                  { provide: AgentEventWakesService, useValue: events },
                  { provide: AgentWorkAccessService, useValue: access },
                  { provide: AgentWakeService, useValue: wakes },
                  { provide: AgentRunsService, useValue: runs },
                  { provide: IDS, useValue: fakeIds() },
                  { provide: LOGGER, useValue: logger },
                  { provide: INBOUND_STOP_REPORTER, useValue: NO_REPORTER },
              ],
          })
    const container = await builder.compile()
    return {
        door: container.get(InboundDoorService),
        registry,
        tx: tx.em,
        events,
        access,
        wakes,
        runs,
        logger,
        stopReporter,
    }
}

const codeOf = async (run: Promise<unknown>): Promise<unknown> => {
    try {
        await run
        return null
    } catch (cause) {
        return cause instanceof AgentInboundError ? cause.code : cause
    }
}

describe("InboundDoorService.accept, the wake", () => {
    it("wakes the agents holding a trigger for the event type and the adapter, keyed by the idempotency key, with the event in the wake context", async () => {
        const { door, tx, events, wakes } = await build({
            targets: [{ agentId: "agent-1", probeKey: "money_in" }],
        })

        await expect(door.accept(tx, event())).resolves.toEqual({ accepted: true, agentIds: ["agent-1"] })

        expect(events.agentsFor).toHaveBeenCalledWith("ws-1", "invoice.paid", KEY)
        const [written, wake] = wakes.write.mock.calls[0] ?? []
        expect(written).toBe(tx)
        expect(wake).toMatchObject({
            workspaceId: "ws-1",
            agentId: "agent-1",
            source: KEY,
            eventKey: "conn-1:evt-1",
            actorMemberId: null,
            context: { eventName: "invoice.paid", probeKey: "money_in" },
        })
        expect(decodeInbound(wake?.context.inbound)).toMatchObject({
            eventType: "invoice.paid",
            trust: "outsider",
            payload: { amount: 120 },
            chain: { depth: 1, agentIds: ["agent-1"], cause: null },
        })
        expect(wake).not.toHaveProperty("scopeKey")
    })

    it("opens the run of the wake in the same transaction, with the trigger intact for a person", async () => {
        const { door, tx, runs } = await build({ written: ["wake-77"] })

        await door.accept(tx, event())

        const [opened, input] = runs.open.mock.calls[0] ?? []
        expect(opened).toBe(tx)
        expect(input).toMatchObject({
            workspaceId: "ws-1",
            agentId: "agent-1",
            wakeId: "wake-77",
            trigger: "invoice.paid",
            versionId: null,
            context: { adapter: KEY, idempotencyKey: "conn-1:evt-1" },
        })
        expect(input?.context.inbound).toMatchObject({ eventType: "invoice.paid", payload: { amount: 120 } })
    })

    it("takes the agent the adapter already knows without matching triggers, after proving it belongs to the workspace", async () => {
        const { door, tx, events, access, wakes } = await build()

        await door.accept(tx, event({ agentId: "agent-9" }))

        expect(access.agent).toHaveBeenCalledWith("ws-1", "agent-9")
        expect(events.agentsFor).not.toHaveBeenCalled()
        expect(wakes.write.mock.calls[0]?.[1]).toMatchObject({ agentId: "agent-9" })
        expect(wakes.write.mock.calls[0]?.[1].context).not.toHaveProperty("probeKey")
    })
})

describe("InboundDoorService.accept, the context an adapter asks for", () => {
    it("adds the ids the adapter asks for to the context of the wake", async () => {
        const { door, tx, wakes, registry } = await build()
        const withContext: InboundAdapter = { ...adapter, wakeContextOf: () => ({ conversationId: "conv-1" }) }
        registry.of.mockReturnValue(withContext)

        await door.accept(tx, event())

        expect(wakes.write.mock.calls[0]?.[1].context).toMatchObject({
            conversationId: "conv-1",
            eventName: "invoice.paid",
        })
    })

    it("carries the member behind the wake and the scope the adapter asked for", async () => {
        const { door, tx, wakes } = await build()

        await door.accept(
            tx,
            event({ actor: { kind: "member", id: "member-4", role: "staff" }, scopeKey: "order:o-1" }),
        )

        expect(wakes.write.mock.calls[0]?.[1]).toMatchObject({ actorMemberId: "member-4", scopeKey: "order:o-1" })
    })
})

describe("InboundDoorService.accept, a fact seen before or never wanted", () => {
    it("opens no run and accepts nothing for a fact that was already written, so a redelivery is one wake", async () => {
        const { door, tx, runs } = await build({ written: [null] })

        await expect(door.accept(tx, event())).resolves.toEqual({ accepted: false, agentIds: [] })
        expect(runs.open).not.toHaveBeenCalled()
    })

    it("wakes each matched agent in order and answers only the ones it woke", async () => {
        const { door, tx, wakes } = await build({
            targets: [
                { agentId: "agent-1", probeKey: null },
                { agentId: "agent-2", probeKey: null },
            ],
            written: ["wake-1", null],
        })

        await expect(door.accept(tx, event())).resolves.toEqual({ accepted: true, agentIds: ["agent-1"] })
        expect(wakes.write).toHaveBeenCalledTimes(2)
    })

    it("accepts nothing, and says so in the log, when no agent holds a trigger for the event", async () => {
        const { door, tx, wakes, logger } = await build({ targets: [] })

        await expect(door.accept(tx, event())).resolves.toEqual({ accepted: false, agentIds: [] })
        expect(wakes.write).not.toHaveBeenCalled()
        expect(logger.info).toHaveBeenCalledWith("agent_inbound.no_target", { adapter: KEY })
    })

    it("refuses an event of an adapter nobody registered, an event with no key and a payload too large to keep", async () => {
        const { door, tx } = await build()

        expect(await codeOf(door.accept(tx, event({ adapter: "door_spec_nobody" })))).toBe(
            AgentInboundErrorCode.AdapterUnknown,
        )
        expect(await codeOf(door.accept(tx, event({ idempotencyKey: "" })))).toBe(AgentInboundErrorCode.KeyMissing)
        expect(await codeOf(door.accept(tx, event({ payload: { text: "x".repeat(PAYLOAD_BYTES_MAX) } })))).toBe(
            AgentInboundErrorCode.PayloadTooLarge,
        )
    })
})

describe("InboundDoorService.accept, a chain of agents", () => {
    const chain = (over: Partial<NonNullable<InboundEvent["chain"]>> = {}) => ({
        id: "chain-1",
        depth: 1,
        agentIds: ["agent-0"],
        cause: null,
        ...over,
    })

    it("carries the chain on to the next wake, one deeper, with the agent added", async () => {
        const { door, tx, wakes } = await build()

        await door.accept(tx, event({ chain: chain() }))

        expect(decodeInbound(wakes.write.mock.calls[0]?.[1].context.inbound)?.chain).toEqual({
            id: "chain-1",
            depth: 2,
            agentIds: ["agent-0", "agent-1"],
            cause: null,
        })
    })

    it("stops at the depth limit: no wake, no run, and a person is told with the whole chain", async () => {
        const { door, tx, wakes, runs, stopReporter, logger } = await build()
        const deep = chain({ depth: CHAIN_DEPTH_MAX })

        await expect(door.accept(tx, event({ chain: deep }))).resolves.toEqual({ accepted: false, agentIds: [] })

        expect(wakes.write).not.toHaveBeenCalled()
        expect(runs.open).not.toHaveBeenCalled()
        expect(stopReporter.report).toHaveBeenCalledWith(tx, {
            workspaceId: "ws-1",
            agentId: "agent-1",
            chainId: "chain-1",
            depth: CHAIN_DEPTH_MAX,
            agentIds: ["agent-0"],
            reason: "depth_limit",
            adapter: KEY,
            eventType: "invoice.paid",
            idempotencyKey: "conn-1:evt-1",
        })
        expect(logger.warn).toHaveBeenCalledWith("agent_inbound.chain_stopped", {
            agentId: "agent-1",
            chainId: "chain-1",
            reason: "depth_limit",
        })
    })

    it("does not wake an agent already in the chain without a new cause, and tells a person", async () => {
        const { door, tx, wakes, stopReporter } = await build()

        await door.accept(tx, event({ chain: chain({ agentIds: ["agent-1"] }) }))

        expect(wakes.write).not.toHaveBeenCalled()
        expect(stopReporter.report).toHaveBeenCalledWith(tx, expect.objectContaining({ reason: "agent_in_chain" }))
    })

    it("never drops a stopped event silently: with nobody to tell, the delivery fails and rolls back", async () => {
        const { door, tx, wakes } = await build({ reporter: false })

        expect(await codeOf(door.accept(tx, event({ chain: chain({ depth: CHAIN_DEPTH_MAX }) })))).toBe(
            AgentInboundErrorCode.StopNotReportable,
        )
        expect(wakes.write).not.toHaveBeenCalled()
    })

    it("lets a report that fails fail the delivery too", async () => {
        const { door, tx, stopReporter } = await build()
        stopReporter.report.mockRejectedValue(new Error("office down"))

        await expect(door.accept(tx, event({ chain: chain({ depth: CHAIN_DEPTH_MAX }) }))).rejects.toThrow(
            "office down",
        )
    })
})
