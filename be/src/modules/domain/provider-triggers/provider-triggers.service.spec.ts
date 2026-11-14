import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { ConnectionBindingsReadService, type ConnectionStatus } from "@modules/domain/connections"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { switchRowOf } from "@tests/fixtures/builders/provider-triggers.builder"
import type { ProviderTriggerSwitchEntity } from "./persistence/entities"
import { ProviderTriggerStoreService } from "./provider-trigger-store.service"
import type { ProviderTriggerCoreDeciders, ProviderTriggerReceivers } from "./provider-triggers.contracts"
import { PROVIDER_TRIGGER_CORE_DECIDERS, PROVIDER_TRIGGER_RECEIVERS } from "./provider-triggers.decorators"
import { ProviderTriggersService } from "./provider-triggers.service"

type ConnectionRecord = NonNullable<Awaited<ReturnType<ConnectionBindingsReadService["recordOf"]>>>

const NOW = new Date("2026-11-12T04:00:00Z")
const ON_SINCE = new Date("2026-11-12T03:00:00Z")

/** The world of one account: who is attached and who decides. */
interface World {
    readonly row: ProviderTriggerSwitchEntity | null
    readonly status: ConnectionStatus
    readonly attached: ReadonlyArray<string>
    readonly coreDecider: string | null
    /** The provider of the account. */
    readonly provider: ConnectionRecord["provider"]
}

const WORLD: World = {
    row: switchRowOf({ enabledAt: ON_SINCE }),
    status: "connected",
    attached: ["core", "plugin", "reader"],
    coreDecider: null,
    provider: "sepay",
}

/** Makes each double answer as the world says. */
const answerAs = (
    world: World,
    store: jest.Mocked<ProviderTriggerStoreService>,
    connections: jest.Mocked<ConnectionBindingsReadService>,
    receivers: jest.Mocked<ProviderTriggerReceivers>,
    coreDeciders: jest.Mocked<ProviderTriggerCoreDeciders>,
): void => {
    store.find.mockResolvedValue(world.row)
    store.listOf.mockResolvedValue(world.row === null ? [] : [world.row])
    connections.recordOf.mockImplementation((workspaceId, id) =>
        Promise.resolve(
            workspaceId === "ws-1" && id === "conn-1"
                ? mock<ConnectionRecord>({ id, workspaceId, provider: world.provider, status: world.status })
                : null,
        ),
    )
    receivers.attachedTo.mockResolvedValue(world.attached)
    coreDeciders.coreDeciderOf.mockResolvedValue(world.coreDecider)
}

const build = async (change: Partial<World> = {}) => {
    const store = mock<ProviderTriggerStoreService>()
    const connections = mock<ConnectionBindingsReadService>()
    const receivers = mock<ProviderTriggerReceivers>()
    const coreDeciders = mock<ProviderTriggerCoreDeciders>()
    const logger = mock<Logger>()
    answerAs({ ...WORLD, ...change }, store, connections, receivers, coreDeciders)
    const manager = mockEntityManager()
    fakeTransaction(manager)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ProviderTriggersService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: manager },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LOGGER, useValue: logger },
            { provide: ProviderTriggerStoreService, useValue: store },
            { provide: ConnectionBindingsReadService, useValue: connections },
            { provide: PROVIDER_TRIGGER_RECEIVERS, useValue: receivers },
            { provide: PROVIDER_TRIGGER_CORE_DECIDERS, useValue: coreDeciders },
        ],
    }).compile()
    const service = moduleRef.get(ProviderTriggersService)
    return { service, manager, store, connections, receivers, coreDeciders, logger }
}

describe("a trigger ON by default: a compose provider's render completion (concept triggers rule 6a)", () => {
    const RENDER: Partial<World> = { provider: "shotstack", row: null, attached: ["video"] }
    it("lists the render switch ON for an account with no row, while a bank feed's stays off with none", async () => {
        await expect((await build(RENDER)).service.switchesOf("ws-1", "conn-1")).resolves.toEqual([
            { name: "render.completed", enabled: true, enabledAt: null, lastFiredAt: null, firedCount: 0, deciderAgentId: null },
        ])
        const bank = await build({ row: null })
        await expect(bank.service.isOn("conn-1", "transaction.received")).resolves.toBe(false)
    })
})

describe("ProviderTriggersService: the switch and the decider of an account", () => {
    it("lists one switch per declared trigger of the account's provider, off where the owner never touched it", async () => {
        await expect((await build({ row: null })).service.switchesOf("ws-1", "conn-1")).resolves.toEqual([
            { name: "transaction.received", enabled: false, enabledAt: null, lastFiredAt: null, firedCount: 0, deciderAgentId: null },
        ])
        await expect((await build()).service.switchesOf("ws-1", "conn-1")).resolves.toEqual([
            {
                name: "transaction.received",
                enabled: true,
                enabledAt: ON_SINCE.toISOString(),
                lastFiredAt: null,
                firedCount: 0,
                deciderAgentId: null,
            },
        ])
        await expect((await build()).service.switchesOf("ws-2", "conn-1")).resolves.toEqual([])
    })

    it("turns a trigger on from now, or from where it last fired when asked to catch up", async () => {
        const lastFiredAt = new Date("2026-11-11T10:00:00Z")
        const { service, store } = await build({ row: switchRowOf({ enabled: false, lastFiredAt }) })

        await expect(service.setEnabled("ws-1", "conn-1", "transaction.received", { enabled: true })).resolves.toEqual({ ok: true })
        await service.setEnabled("ws-1", "conn-1", "transaction.received", { enabled: true, catchUp: true })
        await service.setEnabled("ws-1", "conn-1", "transaction.received", { enabled: false })

        expect(store.change.mock.calls.map((call) => call[3])).toEqual([
            { enabled: true, enabledAt: NOW },
            { enabled: true, enabledAt: lastFiredAt },
            { enabled: false },
        ])
    })

    it("refuses a switch of an unknown account or of a trigger the provider does not declare", async () => {
        const { service, store } = await build()
        await expect(service.setEnabled("ws-2", "conn-1", "transaction.received", { enabled: true })).resolves.toEqual({
            ok: false,
            reason: "unknown_account",
        })
        await expect(service.setEnabled("ws-1", "conn-1", "mail.received", { enabled: true })).resolves.toEqual({
            ok: false,
            reason: "undeclared",
        })
        expect(store.change).not.toHaveBeenCalled()
    })

    it("refuses to bind a second decider while the provider's core agent decides", async () => {
        const { service, store } = await build({ coreDecider: "core" })

        await expect(service.bindDecider("ws-1", "conn-1", "transaction.received", "plugin")).resolves.toEqual({
            ok: false,
            reason: "core_decides",
        })
        expect(store.change).not.toHaveBeenCalled()
    })

    it("binds an attached agent where no core agent decides, refuses one that is not attached, and unbinds with null", async () => {
        const { service, store } = await build()

        await expect(service.bindDecider("ws-1", "conn-1", "transaction.received", "stranger")).resolves.toEqual({
            ok: false,
            reason: "not_attached",
        })
        await expect(service.bindDecider("ws-1", "conn-1", "transaction.received", "plugin")).resolves.toEqual({ ok: true })
        await expect(service.bindDecider("ws-1", "conn-1", "transaction.received", null)).resolves.toEqual({ ok: true })

        expect(store.change.mock.calls.map((call) => call[3])).toEqual([{ deciderAgentId: "plugin" }, { deciderAgentId: null }])
    })
})
