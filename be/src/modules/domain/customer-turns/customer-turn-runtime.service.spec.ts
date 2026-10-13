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
import { CustomerTurnsLogEvent } from "./customer-turns.log-events"
import { TurnModulesService } from "./turn-modules.service"

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
    const modules = { briefs: jest.fn().mockResolvedValue([]) }
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
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
            { provide: LOGGER, useValue: mock<Logger>(logger) },
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
            { provide: TurnModulesService, useValue: mock<TurnModulesService>(modules) },
        ],
    }).compile()
    return { runtime: moduleRef.get(CustomerTurnRuntimeService), gateway, usage, modules, logger }
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

    it("answers the reason without reading module briefs when no gateway is configured", async () => {
        const { runtime, modules, gateway } = await build({ enabled: false })
        await expect(runtime.propose(turn)).resolves.toBe("openclaw_not_configured")
        expect(modules.briefs).not.toHaveBeenCalled()
        expect(gateway.runTurn).not.toHaveBeenCalled()
    })

    it("answers the reason without reading module briefs when no allowance is left", async () => {
        const { runtime, modules, gateway } = await build({ blocked: true })
        await expect(runtime.propose(turn)).resolves.toBe("quota_exceeded")
        expect(modules.briefs).not.toHaveBeenCalled()
        expect(gateway.runTurn).not.toHaveBeenCalled()
    })

    it("never sends an answer that ignored the contract: it becomes a question for a person", async () => {
        const { runtime } = await build({ text: "Sure, it is cheap!" })
        await expect(runtime.propose(turn)).resolves.toMatchObject({
            reply: "conversations.holdingReply",
            needsHuman: true,
            proposedAnswer: "Sure, it is cheap!",
        })
    })

    it("adds every module brief to the agent's context alongside the recalled knowledge", async () => {
        const { runtime, gateway, modules } = await build()
        modules.briefs.mockResolvedValueOnce(["BOOKING RULES", "LOYALTY FACTS"])
        await expect(runtime.propose(turn)).resolves.toMatchObject({ reply: "50k", needsHuman: false })
        expect(modules.briefs).toHaveBeenCalledWith(turn.conversation)
        const request = gateway.runTurn.mock.calls[0]?.[0]
        expect(request?.message).toContain("KNOW")
        expect(request?.message).toContain("BOOKING RULES")
        expect(request?.message).toContain("LOYALTY FACTS")
    })

    it("logs unavailable module briefs and still runs the turn with the remaining context", async () => {
        const { runtime, gateway, modules, logger, usage } = await build()
        const cause = new Error("module facts unavailable")
        modules.briefs.mockRejectedValueOnce(cause)
        await expect(runtime.propose(turn)).resolves.toMatchObject({ reply: "50k", needsHuman: false })
        expect(modules.briefs).toHaveBeenCalledWith(turn.conversation)
        expect(logger.error).toHaveBeenCalledWith(CustomerTurnsLogEvent.ContextPartFailed, cause, {
            workspaceId: WS,
            part: "modules",
        })
        const request = gateway.runTurn.mock.calls[0]?.[0]
        expect(request?.message).toContain("KNOW")
        expect(usage.record).toHaveBeenCalledTimes(1)
    })

    it("preserves the booking request in the proposal's reply-contract detail", async () => {
        const bookingRequest = {
            intent: "reschedule",
            service: "Haircut",
            date: "2026-10-15",
            time: "09:30",
            from: "13:00",
            to: "17:00",
            party_size: 2,
            contact_name: "Lan",
            phone: "0900",
            email: "lan@example.test",
            note: "Window seat",
        }
        const { runtime, gateway } = await build({
            text: JSON.stringify({ reply: "Let me check", needs_human: false, booking_request: bookingRequest }),
        })
        await expect(runtime.propose(turn)).resolves.toEqual({
            reply: "Let me check",
            needsHuman: false,
            reason: "",
            proposedAnswer: "",
            detail: {
                lead: null,
                order: null,
                payment_claim: false,
                knowledge_gap: null,
                application: null,
                loyalty: null,
                booking_request: bookingRequest,
            },
        })
        expect(gateway.runTurn).toHaveBeenCalledTimes(1)
    })

    it.each([
        { label: "missing", value: undefined },
        { label: "null", value: null },
        { label: "array", value: [] },
        { label: "plain text", value: "book" },
        { label: "missing intent", value: {} },
        { label: "unknown intent", value: { intent: "confirm" } },
    ])("omits a $label booking request from the proposal", async ({ value }) => {
        const { runtime, gateway } = await build({
            text: JSON.stringify({ reply: "Let me check", booking_request: value }),
        })
        await expect(runtime.propose(turn)).resolves.toMatchObject({
            reply: "Let me check",
            needsHuman: false,
            detail: { booking_request: null },
        })
        expect(gateway.runTurn).toHaveBeenCalledTimes(1)
    })

    it.each([
        { label: "missing", value: undefined, partySize: 1 },
        { label: "nonfinite", value: "Infinity", partySize: 1 },
        { label: "invalid", value: "several", partySize: 1 },
        { label: "zero", value: 0, partySize: 1 },
        { label: "negative", value: -2, partySize: 1 },
        { label: "fraction below one", value: 0.9, partySize: 1 },
        { label: "numeric string", value: "2.5", partySize: 3 },
        { label: "above the limit", value: 201, partySize: 200 },
    ])("bounds a $label booking party size in the proposal", async ({ value, partySize }) => {
        const { runtime, gateway } = await build({
            text: JSON.stringify({
                reply: "Let me check",
                booking_request: { intent: "availability", party_size: value },
            }),
        })
        await expect(runtime.propose(turn)).resolves.toMatchObject({
            reply: "Let me check",
            needsHuman: false,
            detail: {
                booking_request: {
                    intent: "availability",
                    service: "",
                    date: null,
                    time: null,
                    from: null,
                    to: null,
                    party_size: partySize,
                    contact_name: "",
                    phone: null,
                    email: null,
                    note: null,
                },
            },
        })
        expect(gateway.runTurn).toHaveBeenCalledTimes(1)
    })

    it("normalizes a short booking hour and clears invalid dates and hours", async () => {
        const { runtime, gateway } = await build({
            text: JSON.stringify({
                reply: "Let me check",
                booking_request: {
                    intent: "waitlist",
                    date: "2026/10/15",
                    time: " 9:05 ",
                    from: "24:00",
                    to: "09:60",
                    phone: "  ",
                    email: "",
                    note: " ",
                },
            }),
        })
        await expect(runtime.propose(turn)).resolves.toMatchObject({
            detail: {
                booking_request: {
                    intent: "waitlist",
                    date: null,
                    time: "09:05",
                    from: null,
                    to: null,
                    phone: null,
                    email: null,
                    note: null,
                },
            },
        })
        expect(gateway.runTurn).toHaveBeenCalledTimes(1)
    })

    it("trims and bounds the booking request's customer-controlled text", async () => {
        const { runtime, gateway } = await build({
            text: JSON.stringify({
                reply: "Let me check",
                booking_request: {
                    intent: "cancel",
                    service: ` ${"S".repeat(170)} `,
                    date: " 2026-10-15 extra ",
                    contact_name: ` ${"N".repeat(130)} `,
                    phone: ` ${"1".repeat(50)} `,
                    email: ` ${"E".repeat(260)} `,
                    note: ` ${"T".repeat(410)} `,
                },
            }),
        })
        await expect(runtime.propose(turn)).resolves.toMatchObject({
            detail: {
                booking_request: {
                    intent: "cancel",
                    service: "S".repeat(160),
                    date: "2026-10-15",
                    contact_name: "N".repeat(120),
                    phone: "1".repeat(40),
                    email: "E".repeat(254),
                    note: "T".repeat(400),
                },
            },
        })
        expect(gateway.runTurn).toHaveBeenCalledTimes(1)
    })
})
