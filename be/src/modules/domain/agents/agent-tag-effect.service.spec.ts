import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { WORKFLOW_CALL_TRIGGER } from "@modules/domain/agent-schedules/workflow-call.trigger"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeTurn } from "@modules/domain/graph-nodes"
import { ProviderTriggersService } from "@modules/domain/provider-triggers"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { agentInstallationOf } from "@tests/fixtures/builders/agents.builder"
import { AgentTagEffectService } from "./agent-tag-effect.service"
import { AgentsError, AgentsErrorCode } from "./errors/agents.error"
import { AGENTS_CHANNEL_OWNERS, AGENTS_INSTALLATIONS } from "./agents.decorators"
import type { ConversationChannelOwners, InstallationDirectory } from "./agents.port"

// Ledger (ROAD Opus-1d, 2026-11-14): ruling R34 deleted the plain (unpinned) tag road and the tag door (`AgentTagService`); every case
// that tagged through that door now hands a WORKFLOW CALL (the only tag a package node still writes: `core.call-workflow` always pins)
// to the one delivery function, and a plain tag is refused. The target resolution cases (one role, many agents) keep their meaning.

const TURN: NodeTurn = {
    turnId: "run-1",
    workspaceId: "ws-1",
    agentId: "chatbot-1",
    subject: null,
    conversationId: "c-1",
    locale: "vi",
}

const CALL = { key: "run-1:handoff:0", dedupeKey: "agent-tag:run-1:sales" }

/** The context `core.call-workflow` writes: the pin, the mapped params and the calling run. */
const CALLED = { workflowCall: { workflow: "consult", version: "latest" }, params: { leadId: "l-1" }, caller: { runId: "run-1" } }

const build = async () => {
    const registry = mock<GraphNodeRegistryService>()
    const installations = mock<InstallationDirectory>()
    installations.firstOfModule.mockResolvedValue(agentInstallationOf({ agentId: "sales-1" }))
    const channelOwners = mock<ConversationChannelOwners>()
    channelOwners.ownerAgentOf.mockResolvedValue(null)
    const triggers = mock<ProviderTriggersService>()
    triggers.deliver.mockResolvedValue({
        status: "delivered",
        events: 1,
        dropped: 0,
        woken: [{ agentId: "sales-1", workflowId: "wf-consult", eventId: "e", wakeId: "wake-9" }],
        repeats: 0,
        untaken: 0,
        held: 0,
    })
    const manager = mockEntityManager()
    const tx = mockEntityManager()
    manager.transaction.mockImplementation(((work: (inner: typeof tx) => Promise<unknown>) => work(tx)) as never)
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentTagEffectService,
            { provide: GraphNodeRegistryService, useValue: registry },
            { provide: AGENTS_INSTALLATIONS, useValue: installations },
            { provide: AGENTS_CHANNEL_OWNERS, useValue: channelOwners },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: manager },
            { provide: ProviderTriggersService, useValue: triggers },
        ],
    }).compile()
    return { executor: moduleRef.get(AgentTagEffectService), registry, installations, channelOwners, triggers, tx }
}

/** The target agent the one delivery of the call was for. */
const deliveredTo = (triggers: ReturnType<typeof mock<ProviderTriggersService>>): unknown => triggers.deliver.mock.calls[0]?.[0].agentId

const refusal = (code: AgentsErrorCode) => ({
    name: AgentsError.name,
    code,
    params: { refusal: "EFFECT_PAYLOAD_INVALID", effect: "nivo.tool.agent.tag" },
})

describe("AgentTagEffectService", () => {
    it("registers as the executor of nivo.tool.agent.tag", async () => {
        const { executor, registry } = await build()
        executor.onModuleInit()
        expect(registry.addExecutor).toHaveBeenCalledWith(executor)
        expect(executor.effect).toBe("nivo.tool.agent.tag")
    })

    it("delivers a workflow call to the agent a module runs: pinned, its params as the event's data, the caller beside it, keyed once", async () => {
        const { executor, installations, triggers, tx } = await build()

        await expect(executor.execute(TURN, { toModuleKey: "sales", text: "consult", context: CALLED }, CALL)).resolves.toEqual({
            kind: "wake",
            id: "wake-9",
        })

        expect(installations.firstOfModule).toHaveBeenCalledWith("ws-1", "sales")
        expect(triggers.deliver).toHaveBeenCalledWith(
            {
                workspaceId: "ws-1",
                declaration: WORKFLOW_CALL_TRIGGER,
                connectionId: null,
                agentId: "sales-1",
                events: [
                    {
                        event: { id: "dedupe:agent-tag:run-1:sales", data: { leadId: "l-1" } },
                        pin: { workflow: "consult", version: "latest" },
                        caller: { agentId: "chatbot-1", runId: "run-1" },
                        contactId: null,
                        routeId: "c-1",
                    },
                ],
            },
            tx,
        )
    })

    it("answers a repeat of the same call with its event key", async () => {
        const { executor, triggers } = await build()
        triggers.deliver.mockResolvedValue({ status: "delivered", events: 1, dropped: 0, woken: [], repeats: 1, untaken: 0, held: 0 })

        await expect(
            executor.execute(
                TURN,
                { toAgentId: "care-1", text: "consult", conversationId: "c-2", context: CALLED },
                { key: "k", dedupeKey: null },
            ),
        ).resolves.toEqual({ kind: "wake", id: "call:k" })
        expect(triggers.deliver).toHaveBeenCalledWith(
            expect.objectContaining({ agentId: "care-1", events: [expect.objectContaining({ routeId: "c-2" })] }),
            expect.anything(),
        )
    })

    it("refuses a plain tag (no call), a call no registration takes, and one whose module runs no agent; a plain tag delivers nothing", async () => {
        const { executor, installations, triggers } = await build()

        await expect(executor.execute(TURN, { toModuleKey: "sales", text: "hi" }, CALL)).rejects.toMatchObject(
            refusal(AgentsErrorCode.TagRefused),
        )
        expect(triggers.deliver).not.toHaveBeenCalled()
        triggers.deliver.mockResolvedValueOnce({ status: "delivered", events: 1, dropped: 0, woken: [], repeats: 0, untaken: 1, held: 0 })
        await expect(executor.execute(TURN, { toModuleKey: "sales", text: "consult", context: CALLED }, CALL)).rejects.toMatchObject(
            refusal(AgentsErrorCode.TagRefused),
        )
        installations.firstOfModule.mockResolvedValueOnce(null)
        await expect(executor.execute(TURN, { toModuleKey: "sales", text: "consult", context: CALLED }, CALL)).rejects.toMatchObject(
            refusal(AgentsErrorCode.TagTargetMissing),
        )
    })
})

describe("AgentTagEffectService > one role, many agents", () => {
    it("hands the call to the agent of the module that answers the conversation's channel", async () => {
        const { executor, triggers, installations, channelOwners } = await build()
        channelOwners.ownerAgentOf.mockResolvedValue("sales-lan")

        await executor.execute(TURN, { toModuleKey: "sales", text: "consult", context: CALLED }, CALL)

        expect(channelOwners.ownerAgentOf).toHaveBeenCalledWith("ws-1", "c-1", "sales")
        expect(deliveredTo(triggers)).toBe("sales-lan")
        expect(installations.firstOfModule).not.toHaveBeenCalled()
    })

    it("asks the channel of the conversation the tag names over the turn's own", async () => {
        const { executor, channelOwners } = await build()
        channelOwners.ownerAgentOf.mockResolvedValue("sales-lan")

        await executor.execute(TURN, { toModuleKey: "sales", text: "consult", conversationId: "c-9", context: CALLED }, CALL)

        expect(channelOwners.ownerAgentOf).toHaveBeenCalledWith("ws-1", "c-9", "sales")
    })

    it("falls back to the oldest agent of the module when no agent of it answers the channel", async () => {
        const { executor, triggers, installations } = await build()

        await executor.execute(TURN, { toModuleKey: "sales", text: "consult", context: CALLED }, CALL)

        expect(installations.firstOfModule).toHaveBeenCalledWith("ws-1", "sales")
        expect(deliveredTo(triggers)).toBe("sales-1")
    })

    it("asks no channel for a turn with no conversation", async () => {
        const { executor, triggers, channelOwners } = await build()

        await executor.execute({ ...TURN, conversationId: null }, { toModuleKey: "sales", text: "consult", context: CALLED }, CALL)

        expect(channelOwners.ownerAgentOf).not.toHaveBeenCalled()
        expect(deliveredTo(triggers)).toBe("sales-1")
    })
})
