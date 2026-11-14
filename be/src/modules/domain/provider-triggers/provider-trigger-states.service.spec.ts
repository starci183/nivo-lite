import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { DomainError } from "@modules/platform/errors"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { BANK_TRIGGER_WORDS } from "./messages/provider-triggers.messages"
import { ProviderTriggerStatesService } from "./provider-trigger-states.service"
import type {
    ProviderTriggerAgentNames,
    ProviderTriggerCoreDeciders,
    ProviderTriggerReceivers,
    TriggerChangeRefusal,
    TriggerAgentCard,
    TriggerChangeResult,
    TriggerSwitchView,
} from "./provider-triggers.contracts"
import {
    PROVIDER_TRIGGER_AGENT_NAMES,
    PROVIDER_TRIGGER_CORE_DECIDERS,
    PROVIDER_TRIGGER_RECEIVERS,
} from "./provider-triggers.decorators"
import { ProviderTriggersLogEvent } from "./provider-triggers.log-events"
import { ProviderTriggersService } from "./provider-triggers.service"

/** The refusal the members capability answers for a person whose role may not change a trigger. */
class SeatRefused extends DomainError<"WORKSPACE_MEMBERS_ROLE_FORBIDDEN" | "WORKSPACE_MEMBERS_NOT_MEMBER"> {}

type Member = Awaited<ReturnType<WorkspaceMembersService["require"]>>

type ConnectionRecord = NonNullable<Awaited<ReturnType<ConnectionBindingsReadService["recordOf"]>>>

const ACTOR = { principalId: "user-1", workspaceId: "ws-1" }
const BANK_WORDS = BANK_TRIGGER_WORDS.trigger

/** The world of one account: its provider, the members door's refusal, the stored switch, the core path's agent and the attachments. */
interface World {
    readonly provider: string
    readonly refusal: SeatRefused | null
    readonly switches: ReadonlyArray<TriggerSwitchView>
    readonly core: string | null
    readonly attached: ReadonlyArray<string>
    readonly change: TriggerChangeResult
}

const bankSwitch = (change: Partial<TriggerSwitchView> = {}): TriggerSwitchView => ({
    name: "transaction.received",
    enabled: true,
    enabledAt: "2026-11-12T03:00:00.000Z",
    lastFiredAt: "2026-11-12T03:30:00.000Z",
    firedCount: 4,
    deciderAgentId: "plugin",
    ...change,
})

const WORLD: World = {
    provider: "sepay",
    refusal: null,
    switches: [bankSwitch()],
    core: null,
    attached: ["plugin", "reader"],
    change: { ok: true },
}

const CARDS: ReadonlyArray<TriggerAgentCard> = [
    { id: "core", name: "Accounting" },
    { id: "plugin", name: "Renewals" },
    { id: "reader", name: "Reader" },
]

const STAFF = new SeatRefused({ code: "WORKSPACE_MEMBERS_ROLE_FORBIDDEN" })
const STRANGER = new SeatRefused({ code: "WORKSPACE_MEMBERS_NOT_MEMBER" })
const CHANGERS = ["owner", "manager"]

const build = async (change: Partial<World> = {}) => {
    const world = { ...WORLD, ...change }
    const connections = mock<ConnectionBindingsReadService>()
    connections.recordOf.mockImplementation((workspaceId, id) =>
        Promise.resolve(
            workspaceId === "ws-1" && id === "conn-1"
                ? Object.assign(mock<ConnectionRecord>(), { id, workspaceId, provider: world.provider, status: "connected" })
                : null,
        ),
    )
    const triggers = mock<ProviderTriggersService>()
    triggers.switchesOf.mockResolvedValue(world.switches)
    triggers.setEnabled.mockResolvedValue(world.change)
    triggers.bindDecider.mockResolvedValue(world.change)
    const receivers = mock<ProviderTriggerReceivers>()
    receivers.attachedTo.mockResolvedValue(world.attached)
    const coreDeciders = mock<ProviderTriggerCoreDeciders>()
    coreDeciders.coreDeciderOf.mockResolvedValue(world.core)
    const agents = mock<ProviderTriggerAgentNames>()
    agents.cardsOf.mockImplementation((_workspaceId, ids) => Promise.resolve(CARDS.filter((card) => ids.includes(card.id))))
    const logger = mock<Logger>()
    const members = mock<WorkspaceMembersService>()
    if (world.refusal === null) {
        members.require.mockResolvedValue(mock<Member>({ userId: "user-1", workspaceId: "ws-1", role: "owner" }))
    } else {
        members.require.mockRejectedValue(world.refusal)
    }
    const moduleRef = await Test.createTestingModule({
        providers: [
            ProviderTriggerStatesService,
            { provide: LOGGER, useValue: logger },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: ConnectionBindingsReadService, useValue: connections },
            { provide: ProviderTriggersService, useValue: triggers },
            { provide: PROVIDER_TRIGGER_RECEIVERS, useValue: receivers },
            { provide: PROVIDER_TRIGGER_CORE_DECIDERS, useValue: coreDeciders },
            { provide: PROVIDER_TRIGGER_AGENT_NAMES, useValue: agents },
        ],
    }).compile()
    return { service: moduleRef.get(ProviderTriggerStatesService), triggers, receivers, logger, members }
}

const BANK_STATE = {
    connectionId: "conn-1",
    name: "transaction.received",
    kind: "webhook",
    summary: BANK_WORDS,
    enabled: true,
    enabledAt: "2026-11-12T03:00:00.000Z",
    lastFiredAt: "2026-11-12T03:30:00.000Z",
    firedCount: 4,
    decided: true,
    deciderAgentId: "plugin",
    deciderAgentName: "Renewals",
    coreDecides: false,
    canCatchUp: true,
    deciderChoices: [
        { agentId: "plugin", name: "Renewals" },
        { agentId: "reader", name: "Reader" },
    ],
}

describe("ProviderTriggerStatesService", () => {
    describe("statesOf", () => {
        it("answers a bank account's trigger with the bound decider and the attached agents as the lawful choices", async () => {
            const { service, members } = await build()

            await expect(service.statesOf(ACTOR, "conn-1")).resolves.toEqual([BANK_STATE])
            expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
        })

        it("names the core agent as the decider and offers no choice while the core path decides", async () => {
            const { service } = await build({ core: "core" })

            const [state] = await service.statesOf(ACTOR, "conn-1")

            expect(state).toMatchObject({ deciderAgentId: "core", deciderAgentName: "Accounting", coreDecides: true, deciderChoices: [] })
        })

        it("reads a mailbox's trigger as decided by nobody, off where never touched, without reading the attachments", async () => {
            const { service, receivers } = await build({ provider: "imap", switches: [] })

            const [state] = await service.statesOf(ACTOR, "conn-1")

            expect(state).toMatchObject({
                name: "mail.received",
                kind: "poll",
                enabled: false,
                enabledAt: null,
                firedCount: 0,
                decided: false,
                deciderAgentId: null,
                deciderAgentName: null,
                coreDecides: false,
                canCatchUp: true,
                deciderChoices: [],
            })
            expect(receivers.attachedTo).not.toHaveBeenCalled()
        })

        it("refuses a person who is not a member, reading nothing", async () => {
            const { service, triggers } = await build({ refusal: STRANGER })

            await expect(service.statesOf(ACTOR, "conn-1")).rejects.toMatchObject({ code: "WORKSPACE_MEMBERS_NOT_MEMBER" })
            expect(triggers.switchesOf).not.toHaveBeenCalled()
        })

        it("refuses an account the workspace does not own", async () => {
            const { service } = await build()

            await expect(service.statesOf(ACTOR, "conn-9")).rejects.toMatchObject({
                code: "PROVIDER_TRIGGERS_UNKNOWN_ACCOUNT",
                params: { connectionId: "conn-9" },
            })
        })
    })
})

const REFUSALS: ReadonlyArray<readonly [TriggerChangeRefusal, string]> = [
    ["undeclared", "PROVIDER_TRIGGERS_UNDECLARED"],
    ["unknown_account", "PROVIDER_TRIGGERS_UNKNOWN_ACCOUNT"],
    ["not_decided", "PROVIDER_TRIGGERS_NOT_DECIDED"],
    ["core_decides", "PROVIDER_TRIGGERS_CORE_DECIDES"],
    ["not_attached", "PROVIDER_TRIGGERS_NOT_ATTACHED"],
]

describe("ProviderTriggerStatesService.setEnabled", () => {
    it("turns a switch on to catch up, writes the audit line and answers the trigger's state", async () => {
        const { service, triggers, logger, members } = await build()
        const change = { connectionId: "conn-1", trigger: "transaction.received", enabled: true, catchUp: true }

        await expect(service.setEnabled(ACTOR, change)).resolves.toEqual(BANK_STATE)

        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1", CHANGERS)
        expect(triggers.setEnabled).toHaveBeenCalledWith("ws-1", "conn-1", "transaction.received", { enabled: true, catchUp: true })
        expect(logger.info).toHaveBeenCalledWith(ProviderTriggersLogEvent.SwitchChanged, {
            workspaceId: "ws-1",
            connectionId: "conn-1",
            trigger: "transaction.received",
            enabled: true,
            catchUp: true,
            changedBy: "user-1",
        })
    })

    it("turns a switch on from now when the person does not ask to catch up, and never catches up when turning it off", async () => {
        const { service, triggers } = await build()

        await service.setEnabled(ACTOR, { connectionId: "conn-1", trigger: "transaction.received", enabled: true, catchUp: false })
        await service.setEnabled(ACTOR, { connectionId: "conn-1", trigger: "transaction.received", enabled: false, catchUp: true })

        expect(triggers.setEnabled.mock.calls.map((call) => call[3])).toEqual([
            { enabled: true, catchUp: false },
            { enabled: false, catchUp: false },
        ])
    })

    it("refuses a staff member and changes nothing", async () => {
        const { service, triggers, logger } = await build({ refusal: STAFF })
        const change = { connectionId: "conn-1", trigger: "transaction.received", enabled: true, catchUp: false }

        await expect(service.setEnabled(ACTOR, change)).rejects.toMatchObject({ code: "WORKSPACE_MEMBERS_ROLE_FORBIDDEN" })
        expect(triggers.setEnabled).not.toHaveBeenCalled()
        expect(logger.info).not.toHaveBeenCalled()
    })

    it.each(REFUSALS)("answers the refusal %s of the capability as the code %s, with no audit line", async (reason, code) => {
        const { service, logger } = await build({ change: { ok: false, reason } })

        await expect(
            service.setEnabled(ACTOR, { connectionId: "conn-1", trigger: "transaction.received", enabled: true, catchUp: false }),
        ).rejects.toMatchObject({ code, params: { connectionId: "conn-1", trigger: "transaction.received" } })
        expect(logger.info).not.toHaveBeenCalled()
    })
})

describe("ProviderTriggerStatesService.bindDecider", () => {
    it("binds a decider, writes the audit line and answers the trigger's state", async () => {
        const { service, triggers, logger, members } = await build()

        await expect(
            service.bindDecider(ACTOR, { connectionId: "conn-1", trigger: "transaction.received", agentId: "plugin" }),
        ).resolves.toEqual(BANK_STATE)

        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1", CHANGERS)
        expect(triggers.bindDecider).toHaveBeenCalledWith("ws-1", "conn-1", "transaction.received", "plugin")
        expect(logger.info).toHaveBeenCalledWith(ProviderTriggersLogEvent.DeciderBound, {
            workspaceId: "ws-1",
            connectionId: "conn-1",
            trigger: "transaction.received",
            agentId: "plugin",
            changedBy: "user-1",
        })
    })

    it("unbinds when no agent is named, and audits the unbinding", async () => {
        const { service, triggers, logger } = await build({ switches: [bankSwitch({ deciderAgentId: null })] })

        const state = await service.bindDecider(ACTOR, { connectionId: "conn-1", trigger: "transaction.received" })

        expect(state).toMatchObject({ deciderAgentId: null, deciderAgentName: null })
        expect(triggers.bindDecider).toHaveBeenCalledWith("ws-1", "conn-1", "transaction.received", null)
        expect(logger.info).toHaveBeenCalledWith(ProviderTriggersLogEvent.DeciderBound, {
            workspaceId: "ws-1",
            connectionId: "conn-1",
            trigger: "transaction.received",
            agentId: "",
            changedBy: "user-1",
        })
    })

    it("refuses a staff member and binds nothing", async () => {
        const { service, triggers } = await build({ refusal: STAFF })

        await expect(
            service.bindDecider(ACTOR, { connectionId: "conn-1", trigger: "transaction.received", agentId: "plugin" }),
        ).rejects.toMatchObject({ code: "WORKSPACE_MEMBERS_ROLE_FORBIDDEN" })
        expect(triggers.bindDecider).not.toHaveBeenCalled()
    })

    it.each(REFUSALS)("answers the refusal %s of the capability as the code %s, with no audit line", async (reason, code) => {
        const { service, logger } = await build({ change: { ok: false, reason } })

        await expect(
            service.bindDecider(ACTOR, { connectionId: "conn-1", trigger: "transaction.received", agentId: "reader" }),
        ).rejects.toMatchObject({ code, params: { connectionId: "conn-1", trigger: "transaction.received" } })
        expect(logger.info).not.toHaveBeenCalled()
    })
})
