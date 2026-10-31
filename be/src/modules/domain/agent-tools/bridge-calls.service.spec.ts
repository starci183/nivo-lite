import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { EventsService } from "@modules/domain/events"
import type { BridgeTurn } from "./agent-tools.contracts"
import { BRIDGE_TURNS, INTERNAL_TOOLS } from "./agent-tools.decorators"
import type { BridgeTurns, InternalTools } from "./agent-tools.port"
import { BridgeCallsService } from "./bridge-calls.service"
import { AgentToolsErrorCode } from "./errors/agent-tools.error"

const tagTurn: BridgeTurn = {
    jobId: "wake-2",
    workspaceId: "ws-1",
    agentId: "agent-1",
    turnId: "turn-1",
    wakeId: "wake-2",
    source: "tag",
    conversationId: null,
    authorUserId: "user-1",
}

const build = async (admitted: BridgeTurn | null = tagTurn) => {
    const bridge = mock<BridgeTurns>({ admit: jest.fn(() => Promise.resolve(admitted)) })
    const internal = mock<InternalTools>({ run: jest.fn(() => Promise.resolve({ tools: [] })) })
    const events = mock<EventsService>({ record: jest.fn(() => Promise.resolve()) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            BridgeCallsService,
            { provide: BRIDGE_TURNS, useValue: bridge },
            { provide: INTERNAL_TOOLS, useValue: internal },
            { provide: EventsService, useValue: events },
        ],
    }).compile()
    return { calls: moduleRef.get(BridgeCallsService), bridge, internal, events }
}

describe("BridgeCallsService.admit", () => {
    it("answers the running turn the credential names", async () => {
        const { calls, bridge } = await build()

        await expect(calls.admit("bridge.body.mac")).resolves.toBe(tagTurn)
        expect(bridge.admit).toHaveBeenCalledWith("bridge.body.mac")
    })

    it("refuses a credential that names no running turn", async () => {
        const { calls } = await build(null)

        await expect(calls.admit("bridge.body.mac")).rejects.toMatchObject({ code: AgentToolsErrorCode.TokenInvalid })
    })
})

describe("BridgeCallsService.runInternal", () => {
    it.each(["tool.search", "tool.describe", "tool.call"] as const)(
        "gives a turn with no conversation %s as its own agent and traces it with no lead",
        async (tool) => {
            const { calls, internal, events } = await build()

            await expect(calls.runInternal(tagTurn, tool, { query: "x" })).resolves.toEqual({ tools: [] })

            expect(internal.run).toHaveBeenCalledWith(tagTurn, tool, { query: "x" })
            expect(events.record).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                kind: `engine.tool.${tool}`,
                actor: "NIVO engine",
                summary: `Connector ${tool} in a tag turn`,
                evidence: "wake-2",
            })
        },
    )

    it.each(["knowledge.search", "lead.create_or_update", "booking.find_slots", "tool.sequence"] as const)(
        "tells a turn with no conversation that %s needs one",
        async (tool) => {
            const { calls, internal, events } = await build()

            await expect(calls.runInternal(tagTurn, tool, {})).resolves.toEqual({ error: "needs_conversation" })
            expect(internal.run).not.toHaveBeenCalled()
            expect(events.record).not.toHaveBeenCalled()
        },
    )
})
