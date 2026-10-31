import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { agentTurnViewOf } from "@tests/fixtures/builders/agent-work.builder"
import { runtimeInstallationOf } from "@tests/fixtures/builders/customer-turn-runtime.builder"
import {
    InternalProposalSettlerService,
    InternalTurnContextService,
    RuntimeAgentService,
} from "@modules/domain/agent-turns"
import { AgentTriggersService, AgentWorkHandlersService } from "@modules/domain/agent-work"
import type { AgentTurnView } from "@modules/domain/agent-work"
import { AGENTS_INSTALLATIONS, AgentDirectoryService, AgentsService } from "@modules/domain/agents"
import type { InstallationDirectory } from "@modules/domain/agents"
import { ModuleReadinessService } from "@modules/domain/modules"
import { CLOCK } from "@modules/platform/clock"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentProbesService } from "./agent-probes.service"
import { BACKGROUND_VOICE } from "./agent-schedules.decorators"
import { AgentSchedulesLogEvent } from "./agent-schedules.log-events"
import { BackgroundWorkHandlerService } from "./background-work-handler.service"
import type { BackgroundVoice, ProbeDecision } from "./agent-schedules.contracts"

const NOW = Date.parse("2026-11-10T03:00:00.000Z")
const RUN: ProbeDecision = { kind: "run", brief: "Money in: 5tr.", subjectIds: ["tx-1"] }

interface Options {
    readonly decision?: ProbeDecision
    readonly status?: string
    readonly agentStatus?: string | null
}

const SETTLED = {
    kind: "settled",
    reply: "Three invoices are late.",
    needsHuman: false,
    reason: "",
    tasks: 1,
    actions: [],
}

const factsOf = (status: string | null) =>
    status === null ? null : { id: "agent-1", module: "accounting", status, greeting: "" }

const build = async ({ decision = RUN, status = "live", agentStatus = "active" }: Options = {}) => {
    const probes = mock<AgentProbesService>({ decide: jest.fn().mockResolvedValue(decision) })
    const directory = mock<AgentDirectoryService>({ chatFactsOf: jest.fn().mockResolvedValue(factsOf(agentStatus)) })
    const agents = mock<AgentsService>({ profileOf: jest.fn().mockResolvedValue({ name: "Ke Toan" }) })
    const installations = mock<InstallationDirectory>({ ofAgent: jest.fn().mockResolvedValue(runtimeInstallationOf()) })
    const readiness = mock<ModuleReadinessService>({ settle: jest.fn().mockResolvedValue(status) })
    const runtime = mock<RuntimeAgentService>({ agentFor: jest.fn().mockResolvedValue("ws-accounting") })
    const context = mock<InternalTurnContextService>({ messageOf: jest.fn().mockResolvedValue("the message") })
    const settler = mock<InternalProposalSettlerService>({ settle: jest.fn().mockResolvedValue(SETTLED) })
    const triggers = mock<AgentTriggersService>({ byId: jest.fn().mockResolvedValue(null) })
    const handlers = mock<AgentWorkHandlersService>()
    const logger = mock<Logger>()
    const say = jest.fn().mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            BackgroundWorkHandlerService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LOGGER, useValue: logger },
            { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>({ get: jest.fn((key: string) => `[${key}]`) }) },
            { provide: AGENTS_INSTALLATIONS, useValue: installations },
            { provide: AgentWorkHandlersService, useValue: handlers },
            { provide: AgentProbesService, useValue: probes },
            { provide: AgentTriggersService, useValue: triggers },
            { provide: AgentDirectoryService, useValue: directory },
            { provide: AgentsService, useValue: agents },
            { provide: ModuleReadinessService, useValue: readiness },
            { provide: RuntimeAgentService, useValue: runtime },
            { provide: InternalTurnContextService, useValue: context },
            { provide: InternalProposalSettlerService, useValue: settler },
            { provide: BACKGROUND_VOICE, useValue: mock<BackgroundVoice>({ say }) },
        ],
    }).compile()
    const handler = moduleRef.get(BackgroundWorkHandlerService)
    return { handler, probes, installations, runtime, context, settler, triggers, handlers, logger, say }
}

const wake = (source: "internal" | "schedule", context: AgentTurnView["context"] = {}): AgentTurnView =>
    agentTurnViewOf({ source, context, scopeKey: "agent" })

describe("BackgroundWorkHandlerService", () => {
    it("answers internal and schedule wakes and registers itself with the drain", async () => {
        const { handler, handlers } = await build()

        handler.onModuleInit()

        expect(handler.sources).toEqual(["internal", "schedule"])
        expect(handlers.add).toHaveBeenCalledWith(handler)
    })
})

describe("BackgroundWorkHandlerService.prepare", () => {
    it("builds the turn from what the probe found when there is work", async () => {
        const { handler, probes, context, runtime } = await build()

        const prep = await handler.prepare(wake("internal", { eventName: "bank_credit_booked", probeKey: "money_in" }))

        expect(probes.decide).toHaveBeenCalledWith(
            { workspaceId: "ws-1", agentId: "agent-1" },
            { eventName: "bank_credit_booked", probeKey: "money_in" },
        )
        expect(context.messageOf).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            agentId: "agent-1",
            source: "internal",
            locale: "vi",
            text: "Money in: 5tr.\nevent: bank_credit_booked\ncheck: money_in",
        })
        expect(runtime.agentFor).toHaveBeenCalledWith("ws-1", "accounting", expect.objectContaining({ id: "inst-1" }))
        expect(prep).toEqual({
            kind: "run",
            plan: {
                module: "accounting",
                runtimeAgentId: "ws-accounting",
                threadKey: "agent:ws-accounting:work",
                message: "the message",
                timeoutMs: 120_000,
            },
        })
    })

    it("calls no model when the probe finds nothing or fails: the wake is skipped with the probe's reason", async () => {
        const quiet = await build({ decision: { kind: "skip", reason: "no_work" } })
        const broken = await build({ decision: { kind: "skip", reason: "probe_failed" } })

        await expect(quiet.handler.prepare(wake("schedule", { probeKey: "tasks_due" }))).resolves.toEqual({
            kind: "end",
            ending: { status: "skipped", reason: "no_work", outcome: null },
        })
        await expect(broken.handler.prepare(wake("schedule", { probeKey: "tasks_due" }))).resolves.toMatchObject({
            ending: { reason: "probe_failed" },
        })
        expect(quiet.context.messageOf).not.toHaveBeenCalled()
        expect(quiet.runtime.agentFor).not.toHaveBeenCalled()
        expect(quiet.logger.info).toHaveBeenCalledWith(AgentSchedulesLogEvent.WakeEnded, {
            agentId: "agent-1",
            wakeId: "wake-1",
            reason: "no_work",
        })
    })

    it("skips the wake of an agent that is gone or paused, before any probe", async () => {
        const gone = await build({ agentStatus: null })
        const paused = await build({ agentStatus: "paused" })

        await expect(gone.handler.prepare(wake("schedule"))).resolves.toMatchObject({
            ending: { status: "skipped", reason: "agent_inactive" },
        })
        await expect(paused.handler.prepare(wake("schedule"))).resolves.toMatchObject({
            ending: { reason: "agent_inactive" },
        })
        expect(gone.probes.decide).not.toHaveBeenCalled()
        expect(paused.probes.decide).not.toHaveBeenCalled()
    })
})

describe("BackgroundWorkHandlerService.prepare gates", () => {
    it("skips the wake of an agent whose installation does not run, before any probe", async () => {
        const { handler, probes } = await build({ status: "needs_connection" })

        await expect(handler.prepare(wake("internal"))).resolves.toMatchObject({
            ending: { status: "skipped", reason: "not_applied" },
        })
        expect(probes.decide).not.toHaveBeenCalled()
    })

    it("lets an agent with no installation run", async () => {
        const { handler, installations } = await build()
        installations.ofAgent.mockResolvedValue(null)

        await expect(handler.prepare(wake("internal"))).resolves.toMatchObject({ kind: "run" })
    })

    it("skips a schedule slot older than the period of its trigger, so a backlog never replays", async () => {
        const { handler, triggers, probes } = await build()
        triggers.byId.mockResolvedValue({
            id: "trigger-1",
            agentId: "agent-1",
            kind: "schedule",
            preset: "hourly",
            atTime: null,
            timeZone: "Asia/Ho_Chi_Minh",
            eventName: null,
            probeKey: null,
            enabled: true,
            seedKey: null,
            nextRunAt: null,
            lastFiredAt: null,
        })
        const late = String(NOW - 3_600_000 - 1)
        const onTime = String(NOW - 60_000)

        await expect(handler.prepare(wake("schedule", { triggerId: "trigger-1", slot: late }))).resolves.toMatchObject({
            ending: { status: "skipped", reason: "stale" },
        })
        await expect(
            handler.prepare(wake("schedule", { triggerId: "trigger-1", slot: onTime })),
        ).resolves.toMatchObject({
            kind: "run",
        })
        expect(probes.decide).toHaveBeenCalledTimes(1)
    })

    it("does not read a trigger for an internal wake", async () => {
        const { handler, triggers } = await build()

        await handler.prepare(wake("internal", { triggerId: "trigger-1", slot: "1" }))

        expect(triggers.byId).not.toHaveBeenCalled()
    })
})

describe("BackgroundWorkHandlerService.settle", () => {
    it("settles the proposal as the agent and says the reply to the owner once per wake", async () => {
        const { handler, settler, say } = await build()
        const turn = wake("schedule")

        await expect(handler.settle(turn, { text: "words" })).resolves.toEqual({
            status: "done",
            reason: null,
            outcome: { tasks: 1, actions: [], said: true },
        })

        expect(settler.settle).toHaveBeenCalledWith(
            turn,
            { text: "words" },
            {
                module: "accounting",
                actorName: "Ke Toan",
                locale: "vi",
                installationId: "inst-1",
            },
        )
        expect(say).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            agentId: "agent-1",
            wakeId: "wake-1",
            wakeCreatedAt: new Date("2026-11-10T03:00:00.000Z"),
            text: "Three invoices are late.",
        })
    })

    it("says nothing when the agent has nothing to say", async () => {
        const { handler, settler, say } = await build()
        settler.settle.mockResolvedValue({
            kind: "settled",
            reply: "",
            needsHuman: false,
            reason: "",
            tasks: 0,
            actions: [],
        })

        await expect(handler.settle(wake("schedule"), null)).resolves.toMatchObject({ outcome: { said: false } })
        expect(say).not.toHaveBeenCalled()
    })

    it("does nothing on a stale fence, and skips the wake of an agent that is gone", async () => {
        const stale = await build()
        stale.settler.settle.mockResolvedValue({ kind: "stale" })
        const gone = await build({ agentStatus: null })

        await expect(stale.handler.settle(wake("internal"), null)).resolves.toMatchObject({ status: "skipped" })
        expect(stale.say).not.toHaveBeenCalled()
        await expect(gone.handler.settle(wake("internal"), null)).resolves.toMatchObject({ reason: "agent_inactive" })
        expect(gone.settler.settle).not.toHaveBeenCalled()
    })
})

describe("BackgroundWorkHandlerService.holdOver", () => {
    it("skips a wake the gates stopped and holds one a switch stopped, with no line to anyone", async () => {
        const { handler, say } = await build()

        await expect(handler.holdOver(wake("schedule"), "daily_cap")).resolves.toMatchObject({
            status: "skipped",
            reason: "daily_cap",
        })
        await expect(handler.holdOver(wake("schedule"), "killed")).resolves.toMatchObject({ status: "held" })
        expect(say).not.toHaveBeenCalled()
    })

    it("tells the owner once that a wake died past its attempts", async () => {
        const { handler, say } = await build()

        await expect(handler.holdOver(wake("schedule"), "error")).resolves.toMatchObject({ status: "skipped" })

        expect(say).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            agentId: "agent-1",
            wakeId: "wake-1",
            wakeCreatedAt: new Date("2026-11-10T03:00:00.000Z"),
            text: "[agentSchedules.wakeDead]",
        })
    })
})
