import { Test } from "@nestjs/testing"
import { fakeInbox, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { runtimeInstallationOf } from "@tests/fixtures/builders/customer-turn-runtime.builder"
import { AgentTriggersService, AgentWakeService } from "@modules/domain/agent-work"
import type { AgentTriggerRecord } from "@modules/domain/agent-work"
import { AGENTS_INSTALLATIONS } from "@modules/domain/agents"
import type { Installation, InstallationDirectory } from "@modules/domain/agents"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { INBOX } from "@modules/platform/inbox"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentEventWakesService } from "./agent-event-wakes.service"
import * as policy from "./agent-schedules.policy"
import { AgentTriggerSyncService } from "./agent-trigger-sync.service"
import type { InternalEventFact } from "./agent-schedules.contracts"

const CLAIM = { consumer: "bank_credit_booked__agent_wakes", dedupeKey: "tx-1" }
const FACT: InternalEventFact = {
    workspaceId: "ws-1",
    eventName: "bank_credit_booked",
    dedupeKey: "tx-1",
    subjectId: "tx-1",
}

const triggerOf = (agentId: string, probeKey: string | null): AgentTriggerRecord => ({
    id: `trigger-${agentId}`,
    agentId,
    kind: "event",
    preset: null,
    atTime: null,
    timeZone: "Asia/Ho_Chi_Minh",
    eventName: "bank_credit_booked",
    probeKey,
    enabled: true,
    seedKey: null,
    nextRunAt: null,
    lastFiredAt: null,
})

interface Options {
    readonly triggers?: ReadonlyArray<AgentTriggerRecord>
    readonly installation?: Installation | null
}

const build = async ({ triggers = [], installation = runtimeInstallationOf() }: Options = {}) => {
    const tx = fakeTransaction(mockEntityManager())
    const inbox = fakeInbox()
    const installations = mock<InstallationDirectory>({ byId: jest.fn().mockResolvedValue(installation) })
    const triggerService = mock<AgentTriggersService>({ enabledForEvent: jest.fn().mockResolvedValue(triggers) })
    const wakes = mock<AgentWakeService>({ wake: jest.fn().mockResolvedValue(true) })
    const sync = mock<AgentTriggerSyncService>({ seed: jest.fn().mockResolvedValue(undefined) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentEventWakesService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: INBOX, useValue: inbox },
            { provide: AGENTS_INSTALLATIONS, useValue: installations },
            { provide: LOGGER, useValue: mock<Logger>() },
            { provide: AgentTriggersService, useValue: triggerService },
            { provide: AgentWakeService, useValue: wakes },
            { provide: AgentTriggerSyncService, useValue: sync },
        ],
    }).compile()
    return { service: moduleRef.get(AgentEventWakesService), tx, inbox, installations, triggerService, wakes, sync }
}

describe("AgentEventWakesService.eventHappened", () => {
    it("wakes only the agents of the workspace that asked for the event, each once, keyed by the event and its dedupe key", async () => {
        const { service, wakes, triggerService, inbox } = await build({
            triggers: [triggerOf("agent-1", "money_in"), triggerOf("agent-2", null), triggerOf("agent-1", "other")],
        })

        await expect(service.eventHappened(FACT, CLAIM)).resolves.toBeUndefined()

        expect(inbox.claimed).toEqual([{ source: CLAIM.consumer, eventId: CLAIM.dedupeKey }])
        expect(triggerService.enabledForEvent).toHaveBeenCalledWith("ws-1", "bank_credit_booked", 100)
        expect(wakes.wake.mock.calls.map(([, wake]) => [wake.agentId, wake.eventKey, wake.context])).toEqual([
            [
                "agent-1",
                "bank_credit_booked:tx-1",
                { eventName: "bank_credit_booked", subjectId: "tx-1", probeKey: "money_in" },
            ],
            ["agent-2", "bank_credit_booked:tx-1", { eventName: "bank_credit_booked", subjectId: "tx-1" }],
        ])
    })

    it("wakes nobody for an event nobody asked for", async () => {
        const { service, wakes } = await build()

        await expect(service.eventHappened(FACT, CLAIM)).resolves.toBeUndefined()

        expect(wakes.wake.mock.calls).toEqual([])
    })

    it("wakes nobody twice for a redelivery", async () => {
        const { service, wakes, inbox } = await build({ triggers: [triggerOf("agent-1", null)] })

        await service.eventHappened(FACT, CLAIM)
        await service.eventHappened(FACT, CLAIM)

        expect(inbox.claims).toHaveLength(2)
        expect(wakes.wake.mock.calls).toHaveLength(1)
    })
})

describe("AgentEventWakesService.installationChanged", () => {
    const CHANGE = { workspaceId: "ws-1", installationId: "inst-1" }

    it("seeds nothing for a module that declares no trigger", async () => {
        const { service, sync, installations } = await build({
            installation: { ...runtimeInstallationOf(), module: "chatbot" },
        })

        await expect(service.installationChanged(CHANGE, CLAIM)).resolves.toBeUndefined()

        expect(installations.byId.mock.calls).toEqual([["ws-1", "inst-1"]])
        expect(sync.seed.mock.calls).toEqual([])
    })

    it("seeds the triggers the module declares for the agent of the installation", async () => {
        const seeds = [{ key: "morning", preset: "daily_at" as const, atTime: "08:00" }]
        const declared = jest.spyOn(policy, "triggersOfModule").mockReturnValue(seeds)
        const { service, sync } = await build({ installation: { ...runtimeInstallationOf(), module: "timed" } })

        await expect(service.installationChanged(CHANGE, CLAIM)).resolves.toBeUndefined()

        expect(declared).toHaveBeenCalledWith(expect.anything(), "timed")
        expect(sync.seed.mock.calls).toEqual([["ws-1", "a1", seeds]])
        declared.mockRestore()
    })

    it("seeds nothing for a change of the whole workspace, a missing or removed installation, or a redelivery", async () => {
        const whole = await build()
        const missing = await build({ installation: null })
        const removed = await build({ installation: { ...runtimeInstallationOf(), removed: true } })
        const replay = await build()
        replay.inbox.seen(CLAIM.consumer, CLAIM.dedupeKey)

        await whole.service.installationChanged({ workspaceId: "ws-1" }, CLAIM)
        await missing.service.installationChanged(CHANGE, CLAIM)
        await removed.service.installationChanged(CHANGE, CLAIM)
        await replay.service.installationChanged(CHANGE, CLAIM)

        expect([whole, missing, removed, replay].map((built) => built.sync.seed.mock.calls)).toEqual([[], [], [], []])
        expect(replay.installations.byId.mock.calls).toEqual([])
    })
})
