import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentTagService } from "@modules/domain/agent-work"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeTurn } from "@modules/domain/graph-nodes"
import { agentInstallationOf } from "@tests/fixtures/builders/agents.builder"
import { AgentTagEffectService } from "./agent-tag-effect.service"
import { AgentsError, AgentsErrorCode } from "./errors/agents.error"
import { AGENTS_CHANNEL_OWNERS, AGENTS_INSTALLATIONS } from "./agents.decorators"
import type { ConversationChannelOwners, InstallationDirectory } from "./agents.port"

const TURN: NodeTurn = {
    turnId: "run-1",
    workspaceId: "ws-1",
    agentId: "chatbot-1",
    subject: null,
    conversationId: "c-1",
    locale: "vi",
}

const CALL = { key: "run-1:handoff:0", dedupeKey: "agent-tag:run-1:sales" }

const build = async () => {
    const registry = mock<GraphNodeRegistryService>()
    const tags = mock<AgentTagService>({ tagAgent: jest.fn().mockResolvedValue({ tagged: true, wakeId: "wake-9" }) })
    const installations = mock<InstallationDirectory>()
    installations.firstOfModule.mockResolvedValue(agentInstallationOf({ agentId: "sales-1" }))
    const channelOwners = mock<ConversationChannelOwners>()
    channelOwners.ownerAgentOf.mockResolvedValue(null)
    channelOwners.ownerAgentOfLead.mockResolvedValue(null)
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentTagEffectService,
            { provide: GraphNodeRegistryService, useValue: registry },
            { provide: AgentTagService, useValue: tags },
            { provide: AGENTS_INSTALLATIONS, useValue: installations },
            { provide: AGENTS_CHANNEL_OWNERS, useValue: channelOwners },
        ],
    }).compile()
    return { executor: moduleRef.get(AgentTagEffectService), registry, tags, installations, channelOwners }
}

describe("AgentTagEffectService", () => {
    it("registers as the executor of agent.tag", async () => {
        const { executor, registry } = await build()
        executor.onModuleInit()
        expect(registry.addExecutor).toHaveBeenCalledWith(executor)
        expect(executor.effect).toBe("agent.tag")
    })

    it("tags the agent a module runs through the tag door, with everything the tag carries and the ledger key as event key", async () => {
        const { executor, tags, installations } = await build()
        const payload = {
            toModuleKey: "sales",
            text: "Order 2 pots",
            subject: { kind: "order", id: "o-1" },
            leadId: "l-1",
            channel: "zalo",
            context: { items: [{ name: "Lan" }] },
            visibility: "redirect" as const,
        }

        await expect(executor.execute(TURN, payload, CALL)).resolves.toEqual({ kind: "wake", id: "wake-9" })

        expect(installations.firstOfModule).toHaveBeenCalledWith("ws-1", "sales")
        expect(tags.tagAgent).toHaveBeenCalledWith({
            fromAgentId: "chatbot-1",
            workspaceId: "ws-1",
            toAgentId: "sales-1",
            text: "Order 2 pots",
            conversationId: "c-1",
            locale: "vi",
            eventKey: "dedupe:agent-tag:run-1:sales",
            subject: "order:o-1",
            leadId: "l-1",
            channel: "zalo",
            context: { items: [{ name: "Lan" }] },
            visibility: "redirect",
        })
    })

    it("tags an agent by id in the conversation the payload names, and answers a duplicate with its event key", async () => {
        const { executor, tags } = await build()
        tags.tagAgent.mockResolvedValue({ tagged: false, reason: "duplicate" })

        await expect(
            executor.execute(
                TURN,
                { toAgentId: "care-1", text: "hi", conversationId: "c-2" },
                { key: "k", dedupeKey: null },
            ),
        ).resolves.toEqual({ kind: "wake", id: "call:k" })
        expect(tags.tagAgent).toHaveBeenCalledWith(
            expect.objectContaining({ toAgentId: "care-1", conversationId: "c-2" }),
        )
    })

    it("refuses a tag the rights refuse, one too large, and one whose module runs no agent", async () => {
        const { executor, tags, installations } = await build()
        const payload = { toModuleKey: "sales", text: "hi" }

        const refusal = (code: AgentsErrorCode, reported: string) => ({
            name: AgentsError.name,
            code,
            params: { refusal: reported, effect: "agent.tag" },
        })

        tags.tagAgent.mockResolvedValueOnce({ tagged: false, reason: "not_allowed" })
        await expect(executor.execute(TURN, payload, CALL)).rejects.toMatchObject(
            refusal(AgentsErrorCode.TagRefused, "RIGHTS_DENIED"),
        )
        tags.tagAgent.mockResolvedValueOnce({ tagged: false, reason: "too_large" })
        await expect(executor.execute(TURN, payload, CALL)).rejects.toMatchObject(
            refusal(AgentsErrorCode.TagRefused, "EFFECT_PAYLOAD_INVALID"),
        )
        installations.firstOfModule.mockResolvedValueOnce(null)
        await expect(executor.execute(TURN, payload, CALL)).rejects.toMatchObject(
            refusal(AgentsErrorCode.TagTargetMissing, "EFFECT_PAYLOAD_INVALID"),
        )
    })
})

describe("AgentTagEffectService > one role, many agents", () => {
    it("hands the conversation to the agent of the module that answers its channel", async () => {
        const { executor, tags, installations, channelOwners } = await build()
        channelOwners.ownerAgentOf.mockResolvedValue("sales-lan")

        await executor.execute(TURN, { toModuleKey: "sales", text: "Order 2 pots" }, CALL)

        expect(channelOwners.ownerAgentOf).toHaveBeenCalledWith("ws-1", "c-1", "sales")
        expect(tags.tagAgent).toHaveBeenCalledWith(expect.objectContaining({ toAgentId: "sales-lan" }))
        expect(installations.firstOfModule).not.toHaveBeenCalled()
    })

    it("asks the channel of the conversation the tag names over the turn's own", async () => {
        const { executor, channelOwners } = await build()
        channelOwners.ownerAgentOf.mockResolvedValue("sales-lan")

        await executor.execute(TURN, { toModuleKey: "sales", text: "Order", conversationId: "c-9" }, CALL)

        expect(channelOwners.ownerAgentOf).toHaveBeenCalledWith("ws-1", "c-9", "sales")
    })

    it("falls back to the oldest agent of the module when no agent of it answers the channel", async () => {
        const { executor, tags, installations } = await build()

        await executor.execute(TURN, { toModuleKey: "sales", text: "Order" }, CALL)

        expect(installations.firstOfModule).toHaveBeenCalledWith("ws-1", "sales")
        expect(tags.tagAgent).toHaveBeenCalledWith(expect.objectContaining({ toAgentId: "sales-1" }))
    })

    it("asks no channel for a turn with no conversation", async () => {
        const { executor, tags, channelOwners } = await build()

        await executor.execute({ ...TURN, conversationId: null }, { toModuleKey: "sales", text: "Order" }, CALL)

        expect(channelOwners.ownerAgentOf).not.toHaveBeenCalled()
        expect(tags.tagAgent).toHaveBeenCalledWith(expect.objectContaining({ toAgentId: "sales-1" }))
    })

    it("hands a tag that names a customer and no conversation to the agent that answers the customer's channel, outside any conversation", async () => {
        const { executor, tags, channelOwners } = await build()
        channelOwners.ownerAgentOfLead.mockResolvedValue("sales-lan")

        await executor.execute(
            { ...TURN, conversationId: null },
            { toModuleKey: "sales", text: "Paid", leadId: "l-1" },
            CALL,
        )

        expect(channelOwners.ownerAgentOfLead).toHaveBeenCalledWith("ws-1", "l-1", "sales")
        const [request] = tags.tagAgent.mock.calls[0] ?? []
        expect(request).toMatchObject({ toAgentId: "sales-lan", leadId: "l-1" })
        expect(request?.conversationId ?? null).toBeNull()
    })

    it("falls back to the oldest agent of the module when the customer's channel has no agent of it", async () => {
        const { executor, tags } = await build()

        await executor.execute(
            { ...TURN, conversationId: null },
            { toModuleKey: "sales", text: "Paid", leadId: "l-1" },
            CALL,
        )

        expect(tags.tagAgent).toHaveBeenCalledWith(expect.objectContaining({ toAgentId: "sales-1" }))
    })
})
