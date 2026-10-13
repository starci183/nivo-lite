import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import type { AgentRegistryService, GatewayClient } from "@modules/integrations/openclaw"
import type { InstallationDirectory } from "@modules/domain/agents"
import type { Logger } from "@modules/platform/logging"
import { KnowledgeRecallService, ModuleProfilesService } from "@modules/domain/agent-knowledge"
import { AGENTS_INSTALLATIONS } from "@modules/domain/agents"
import { UsageGateService } from "@modules/domain/ai-usage-events"
import { AuthorityService } from "@modules/domain/authority"
import type { CustomerTurn } from "@modules/domain/conversations"
import { HiringPublicService } from "@modules/domain/hiring"
import { AgentSyncService } from "@modules/domain/openclaw-agent-sync"
import { OPENCLAW_AGENT_REGISTRY, OPENCLAW_GATEWAY } from "@modules/integrations/openclaw"
import { CLOCK } from "@modules/platform/clock"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import { CustomerTurnRuntimeService } from "./customer-turn-runtime.service"

const WS = "11111111-1111-4111-8111-111111111111"
const catalog: MessageCatalog = { get: (key: string) => key }

const turn: CustomerTurn = {
    conversation: {
        id: "c1",
        workspaceId: WS,
        channel: "telegram",
        externalId: "42",
        connectionId: null,
        leadId: null,
        handledBy: null,
        visitorName: "Lan",
        installationId: "i1",
        agent: {
            id: "a1",
            name: "Bot",
            handle: "bot",
            role: "Chatbot",
            module: "chatbot",
            instructions: "",
            knowledge: "",
            approvalRule: "",
            greeting: "",
        },
    },
    messageId: "m1",
    body: "How much is the tea?",
    channelEventId: "tg:42:1",
    transcript: [{ role: "user", body: "How much is the tea?" }],
}

const build = async (
    options: { readonly enabled?: boolean; readonly blocked?: boolean; readonly text?: string } = {},
) => {
    const gateway = {
        enabled: options.enabled ?? true,
        runTurn: jest.fn().mockResolvedValue({
            text: options.text ?? '{"reply":"50k","needs_human":false}',
            usage: null,
            timings: {},
        }),
    }
    const usage = {
        blockedBy: jest.fn().mockResolvedValue(options.blocked === true ? { message: "over" } : null),
        record: jest.fn().mockResolvedValue(undefined),
    }
    const moduleRef = await Test.createTestingModule({
        providers: [
            CustomerTurnRuntimeService,
            { provide: OPENCLAW_GATEWAY, useValue: mock<GatewayClient>(gateway) },
            {
                provide: OPENCLAW_AGENT_REGISTRY,
                useValue: mock<AgentRegistryService>({ has: jest.fn().mockReturnValue(true) }),
            },
            {
                provide: AGENTS_INSTALLATIONS,
                useValue: mock<InstallationDirectory>({ ofAgent: jest.fn().mockResolvedValue(null) }),
            },
            { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>(catalog) },
            { provide: CLOCK, useValue: new FakeClock("2026-10-13T10:00:00.000Z") },
            { provide: LOGGER, useValue: mock<Logger>({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }) },
            {
                provide: AgentSyncService,
                useValue: mock<AgentSyncService>({ syncInstallation: jest.fn(), ensureInternalAgent: jest.fn() }),
            },
            { provide: UsageGateService, useValue: mock<UsageGateService>(usage) },
            {
                provide: AuthorityService,
                useValue: mock<AuthorityService>({ load: jest.fn().mockResolvedValue(null) }),
            },
            {
                provide: KnowledgeRecallService,
                useValue: mock<KnowledgeRecallService>({
                    recall: jest.fn().mockResolvedValue({ brief: "KNOW", passages: [] }),
                }),
            },
            {
                provide: HiringPublicService,
                useValue: mock<HiringPublicService>({ chatBrief: jest.fn().mockResolvedValue("") }),
            },
            {
                provide: ModuleProfilesService,
                useValue: mock<ModuleProfilesService>({
                    applicationClause: () => "",
                    applicationShape: () => "",
                    replyContractOf: (_module: string, base: string) => base,
                }),
            },
        ],
    }).compile()
    return { runtime: moduleRef.get(CustomerTurnRuntimeService), gateway, usage }
}

describe("CustomerTurnRuntimeService", () => {
    it("runs the turn on the module's agent with the recalled knowledge and meters it", async () => {
        const { runtime, gateway, usage } = await build()
        const answer = await runtime.propose(turn)
        expect(answer).toMatchObject({ reply: "50k", needsHuman: false })
        const request = gateway.runTurn.mock.calls[0]?.[0]
        expect(request?.threadKey).toBe(`agent:${request?.agentId}:c1`)
        expect(request?.message).toContain("KNOW")
        expect(usage.record).toHaveBeenCalledWith(expect.objectContaining({ kind: "chat_reply", module: "chatbot" }))
    })

    it("answers the reason instead of a proposal when no gateway or no allowance is left", async () => {
        await expect((await build({ enabled: false })).runtime.propose(turn)).resolves.toBe("openclaw_not_configured")
        await expect((await build({ blocked: true })).runtime.propose(turn)).resolves.toBe("quota_exceeded")
    })

    it("never sends an answer that ignored the contract: it becomes a question for a person", async () => {
        const { runtime } = await build({ text: "Sure, it is cheap!" })
        await expect(runtime.propose(turn)).resolves.toMatchObject({
            reply: "conversations.holdingReply",
            needsHuman: true,
            proposedAnswer: "Sure, it is cheap!",
        })
    })
})
