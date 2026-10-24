import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { InstallationDirectory } from "@modules/domain/agents"
import type { AgentRegistryService, GatewayClient } from "@modules/integrations/openclaw"
import type { Logger } from "@modules/platform/logging"
import { KnowledgeRecallService, ModuleProfilesService } from "@modules/domain/agent-knowledge"
import { AGENTS_INSTALLATIONS } from "@modules/domain/agents"
import { UsageGateService } from "@modules/domain/ai-usage-events"
import { AuthorityService } from "@modules/domain/authority"
import { HiringPublicService } from "@modules/domain/hiring"
import { ModuleReadinessService } from "@modules/domain/modules"
import { AgentSyncService } from "@modules/domain/openclaw-agent-sync"
import { OPENCLAW_AGENT_REGISTRY, OPENCLAW_GATEWAY } from "@modules/integrations/openclaw"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import {
    RUNTIME_TOKEN,
    RUNTIME_WS,
    runtimeInstallationOf,
    runtimePassageOf,
    runtimeTurn,
} from "@tests/fixtures/builders/customer-turn-runtime.builder"
import type { RuntimeBuildOptions } from "@tests/fixtures/builders/customer-turn-runtime.builder"
import { CustomerTurnRuntimeService } from "./customer-turn-runtime.service"
import { CustomerTurnsLogEvent } from "./customer-turns.log-events"
import { GatewayContextService } from "./gateway-context.service"
import { TurnModulesService } from "./turn-modules.service"
import { TurnToolAccessService } from "./turn-tool-access.service"

const WS = RUNTIME_WS
const TOKEN = RUNTIME_TOKEN
const catalog = mock<MessageCatalog>({
    get: (key: string, params?: Readonly<Record<string, string | number>>) =>
        params === undefined || Object.keys(params).length === 0 ? key : `${key}${JSON.stringify(params)}`,
})
const installationOf = runtimeInstallationOf
const turn = runtimeTurn

const build = async (options: RuntimeBuildOptions = {}) => {
    const gateway = mock<GatewayClient>({
        enabled: options.enabled ?? true,
        runTurn: jest.fn().mockResolvedValue({
            text: options.text ?? '{"reply":"50k","needs_human":false}',
            usage: null,
            timings: {},
        }),
    })
    const usage = mock<UsageGateService>({
        blockedBy: jest.fn().mockResolvedValue(options.blocked === true ? { message: "over" } : null),
        record: jest.fn().mockResolvedValue(undefined),
    })
    const modules = mock<TurnModulesService>({ briefs: jest.fn().mockResolvedValue([]) })
    const logger = mock<Logger>({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })
    const registry = mock<AgentRegistryService>({ has: jest.fn().mockReturnValue(true) })
    const installations = mock<InstallationDirectory>({ ofAgent: jest.fn().mockResolvedValue(null) })
    const sync = mock<AgentSyncService>({
        syncInstallation: jest.fn().mockResolvedValue(null),
        ensureInternalAgent: jest.fn().mockResolvedValue("ws-internal"),
    })
    const authority = mock<AuthorityService>({ load: jest.fn().mockResolvedValue(null) })
    const hiring = mock<HiringPublicService>({ chatBrief: jest.fn().mockResolvedValue("") })
    const profiles = mock<ModuleProfilesService>({
        applicationClause: jest.fn().mockReturnValue(""),
        applicationShape: jest.fn().mockReturnValue(""),
        replyContractOf: jest.fn().mockImplementation((_module: string, base: string) => base),
    })
    const recall = mock<KnowledgeRecallService>({
        recall: jest.fn().mockResolvedValue({ brief: "KNOW", passages: [], facts: [] }),
    })
    const readiness = mock<ModuleReadinessService>({ settle: jest.fn().mockResolvedValue("live") })
    const connectors = mock<GatewayContextService>({
        servesConnectors: jest.fn().mockResolvedValue(options.serves ?? true),
    })
    const access = mock<TurnToolAccessService>({
        open: jest.fn().mockReturnValue(options.token ?? TOKEN),
        keep: jest.fn(),
        blockOf: jest.fn((token: string) => (token === "" ? "" : `[OPTIONAL TOOLS] ${token}`)),
        close: jest.fn(),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            CustomerTurnRuntimeService,
            { provide: OPENCLAW_GATEWAY, useValue: gateway },
            { provide: OPENCLAW_AGENT_REGISTRY, useValue: registry },
            { provide: AGENTS_INSTALLATIONS, useValue: installations },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LOGGER, useValue: logger },
            { provide: AgentSyncService, useValue: sync },
            { provide: UsageGateService, useValue: usage },
            { provide: AuthorityService, useValue: authority },
            { provide: KnowledgeRecallService, useValue: recall },
            { provide: HiringPublicService, useValue: hiring },
            { provide: ModuleProfilesService, useValue: profiles },
            { provide: TurnModulesService, useValue: modules },
            { provide: ModuleReadinessService, useValue: readiness },
            { provide: GatewayContextService, useValue: connectors },
            { provide: TurnToolAccessService, useValue: access },
        ],
    }).compile()
    return {
        runtime: moduleRef.get(CustomerTurnRuntimeService),
        gateway,
        usage,
        modules,
        logger,
        registry,
        installations,
        sync,
        authority,
        hiring,
        profiles,
        recall,
        readiness,
        connectors,
        access,
    }
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
})

describe("CustomerTurnRuntimeService", () => {
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
})

describe("CustomerTurnRuntimeService", () => {
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
})

describe("CustomerTurnRuntimeService", () => {
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

describe("CustomerTurnRuntimeService", () => {
    it("falls back when the gateway fails and builds the internal agent when the module agent is unknown", async () => {
        const { runtime, gateway, logger, registry, sync } = await build()
        const cause = new Error("gateway down")
        gateway.runTurn.mockRejectedValue(cause)
        registry.has.mockReturnValue(false)
        await expect(runtime.propose(turn)).resolves.toBe("openclaw_unavailable")
        expect(logger.error).toHaveBeenCalledWith(CustomerTurnsLogEvent.TurnFailed, cause, { conversationId: "c1" })
        expect(sync.ensureInternalAgent).toHaveBeenCalledWith(WS)
    })

    it("uses a freshly synced agent and the installation timeout", async () => {
        const { runtime, gateway, registry, installations, sync } = await build()
        registry.has.mockReturnValue(false)
        installations.ofAgent.mockResolvedValue(installationOf({ openclawTimeoutSec: 10 }))
        sync.syncInstallation.mockResolvedValue({
            agentId: "synced-agent",
            contextVersion: null,
            changed: true,
            written: 1,
            removed: 0,
            registered: true,
            files: 1,
            contentHash: "synced-hash",
        })
        await expect(runtime.propose(turn)).resolves.toMatchObject({ reply: "50k" })
        expect(gateway.runTurn.mock.calls[0]?.[0]).toEqual(
            expect.objectContaining({ agentId: "synced-agent", timeoutMs: 10_000 }),
        )
        expect(gateway.runTurn.mock.calls[0]?.[1]).toBeInstanceOf(AbortSignal)
    })

    it("keeps going on the internal agent when the sync fails or returns nothing", async () => {
        const failed = await build()
        failed.registry.has.mockReturnValue(false)
        failed.installations.ofAgent.mockResolvedValue(installationOf())
        const cause = new Error("sync failed")
        failed.sync.syncInstallation.mockRejectedValue(cause)
        await expect(failed.runtime.propose(turn)).resolves.toMatchObject({ reply: "50k" })
        expect(failed.logger.error).toHaveBeenCalledWith(CustomerTurnsLogEvent.AgentSyncFailed, cause, {
            installationId: "inst-1",
        })
        expect(failed.gateway.runTurn.mock.calls[0]?.[0]?.agentId).toBe("ws-internal")

        const empty = await build()
        empty.registry.has.mockReturnValue(false)
        empty.installations.ofAgent.mockResolvedValue(installationOf())
        empty.sync.syncInstallation.mockResolvedValue(null)
        await empty.runtime.propose(turn)
        expect(empty.sync.ensureInternalAgent).toHaveBeenCalledWith(WS)
    })

    it("leaves out an authority or hiring block that cannot be read and uses the base contract", async () => {
        const { runtime, gateway, authority, hiring, profiles, logger } = await build()
        const cause = new Error("authority down")
        authority.load.mockRejectedValue(cause)
        hiring.chatBrief.mockRejectedValue(new Error("hiring down"))
        profiles.replyContractOf.mockReturnValue(null)
        await expect(runtime.propose(turn)).resolves.toMatchObject({ reply: "50k" })
        expect(logger.error).toHaveBeenCalledWith(CustomerTurnsLogEvent.ContextPartFailed, cause, {
            workspaceId: WS,
            part: "authority",
        })
        expect(gateway.runTurn.mock.calls[0]?.[0]?.message).toContain("bundle.replyContract")
    })
})

describe("CustomerTurnRuntimeService readiness", () => {
    it.each([
        ["ready" as const, { reply: "50k" }, 1],
        ["needs_connection" as const, "needs_connection", 0],
        ["setup" as const, "installation_not_running", 0],
    ])("answers an installation the readiness settles as %s", async (status, answer, runs) => {
        const { runtime, installations, readiness, gateway } = await build()
        installations.ofAgent.mockResolvedValue(installationOf())
        readiness.settle.mockResolvedValueOnce(status)
        await expect(runtime.propose(turn)).resolves.toEqual(
            typeof answer === "string" ? answer : expect.objectContaining(answer),
        )
        expect(readiness.settle).toHaveBeenCalledWith(WS, "inst-1")
        expect(gateway.runTurn).toHaveBeenCalledTimes(runs)
    })

    it("asks no readiness for an agent without an installation", async () => {
        const { runtime, readiness } = await build()
        await runtime.propose(turn)
        expect(readiness.settle).not.toHaveBeenCalled()
    })
})

describe("CustomerTurnRuntimeService tools", () => {
    it("opens the turn's tools, hands the agent the tool block, keeps the turn's knowledge, then closes them", async () => {
        const { runtime, access, gateway, recall } = await build()
        recall.recall.mockResolvedValueOnce({ brief: "KNOW", passages: [runtimePassageOf("Price list")], facts: [] })
        await expect(runtime.propose(turn)).resolves.toMatchObject({ reply: "50k" })
        expect(access.open).toHaveBeenCalledWith(turn, 25_000)
        expect(String(gateway.runTurn.mock.calls[0]?.[0].message)).toContain(`[OPTIONAL TOOLS] ${TOKEN}`)
        expect(access.keep).toHaveBeenCalledWith(turn, [
            { layer: 2, kind: "brain_document", ref: "src-1", label: "Price list" },
        ])
        expect(access.close).toHaveBeenCalledWith(turn)
    })

    it("never logs or meters the token, and still closes the tools when the turn fails", async () => {
        const { runtime, access, gateway, logger, usage } = await build()
        await runtime.propose(turn)
        gateway.runTurn.mockRejectedValueOnce(new Error("gateway down"))
        await expect(runtime.propose(turn)).resolves.toBe("openclaw_unavailable")
        const written = JSON.stringify([
            logger.error.mock.calls,
            logger.warn.mock.calls,
            logger.info.mock.calls,
            usage.record.mock.calls,
        ])
        expect(written).not.toContain(TOKEN)
        expect(access.close).toHaveBeenCalledTimes(2)
    })

    it("does not run an agent holding connector grants without a tool token", async () => {
        const { runtime, access, gateway, connectors } = await build({ token: "" })
        await expect(runtime.propose(turn)).resolves.toBe("tools_not_configured")
        expect(connectors.servesConnectors).toHaveBeenCalledWith(turn.conversation)
        expect(gateway.runTurn).not.toHaveBeenCalled()
        expect(access.close).toHaveBeenCalledWith(turn)
    })

    it("runs an agent without connector grants without the tool block when no token can be minted", async () => {
        const { runtime, gateway } = await build({ token: "", serves: false })
        await expect(runtime.propose(turn)).resolves.toMatchObject({ reply: "50k" })
        expect(String(gateway.runTurn.mock.calls[0]?.[0].message)).not.toContain("[OPTIONAL TOOLS]")
    })
})
