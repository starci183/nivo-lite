import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { ChannelConnectionsService } from "@modules/domain/channel-connections"
import { ConnectionGrantsService } from "@modules/domain/connection-grants"
import { ConnectionsError, ConnectionsErrorCode, ConnectionsService } from "@modules/domain/connections"
import type { ConnectionRecord } from "@modules/domain/connections"
import { Secret } from "@modules/platform/config"
import { AgentDirectoryService } from "@modules/domain/agents"
import { WorkspaceMemberDirectoryService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { ProvisionFlags } from "./channel-provisioning.contracts"
import { CHANNEL_PROVISIONING_OPTIONS } from "./channel-provisioning.decorators"
import type { ChannelProvisioningOptions } from "./channel-provisioning.options"
import { ChannelProvisioningService } from "./channel-provisioning.service"

const WORKSPACE = "12345678-1234-5678-9abc-123456789abc"
const ACTOR = { principalId: "owner-1", workspaceId: WORKSPACE }
const BANK = { bankCode: "MBBank", account: "0123456789", holder: "LAN" }
const TOKEN = ["123456789", "AAEabcdefghijklmnopqrstuvwxyz012345"].join(":")
const TELEGRAM: ConnectionRecord = {
    id: "telegram-1",
    workspaceId: WORKSPACE,
    provider: "telegram",
    name: "Bot Telegram",
    meta: {},
    status: "connected",
    lastError: null,
    environment: "live",
    isDefault: false,
    lastEventAt: null,
    firstEvent: null,
    createdBy: "owner-1",
    createdAt: "2026-10-13T00:00:00.000Z",
}

/** What a spec states about the database: the manager, the queries it answered and the account the directory names as owner. */
interface Scenario {
    readonly entityManager: MockEntityManager
    readonly agents: ReadonlyArray<{ readonly id: string; readonly module: string }>
    readonly owner: string | null
}

/** A scenario whose agents table answers the given rows and whose workspace has the given owners (the first one is the oldest). */
/** Whether a stubbed row names an agent and its module. */
const isAgentRef = (value: unknown): value is { readonly id: string; readonly module: string } =>
    typeof value === "object" && value !== null && "id" in value && "module" in value

const scenarioOf = (
    owners: ReadonlyArray<{ readonly userId: string }> = [{ userId: "owner-1" }],
    agents: ReadonlyArray<unknown> = [],
): Scenario => {
    const entityManager = mockEntityManager()
    return {
        entityManager,
        agents: agents.flatMap((agent) => (isAgentRef(agent) ? [agent] : [])),
        owner: owners[0]?.userId ?? null,
    }
}


const build = async (
    overrides: Partial<ChannelProvisioningOptions> = {},
    scenario: Scenario = scenarioOf(),
) => {
    const channels = mock<ChannelConnectionsService>()
    channels.connectTelegram.mockResolvedValue({
        connection: TELEGRAM,
        botUsername: "shop_bot",
        accountMasked: null,
        webhookRegistered: true,
    })
    channels.startMoneyConnection.mockResolvedValue({
        id: "sepay-1",
        provider: "sepay",
        name: "SePay",
        environment: "test",
        status: "pending",
        webhookUrl: "https://nivo.vn/hook/sepay/sepay-1",
        apiKey: "nivo-sepay-key",
        bankCode: BANK.bankCode,
        bank: BANK.bankCode,
        account: "masked-6789",
        holder: BANK.holder,
        credentialsSaved: false,
        firstEvent: null,
        agentIds: [],
    })
    const grants = mock<ConnectionGrantsService>()
    grants.setConnectionAgents.mockResolvedValue(undefined)
    const connections = mock<ConnectionsService>()
    connections.create.mockResolvedValue("zalo-1")
    connections.webhookUrl.mockReturnValue("https://nivo.vn/api/connections/zalo/zalo-1")
    const agentDirectory = mock<AgentDirectoryService>()
    agentDirectory.moduleRefsOf.mockResolvedValue([...scenario.agents])
    const directory = mock<WorkspaceMemberDirectoryService>()
    directory.firstActiveOwnerUserId.mockResolvedValue(scenario.owner)
    const print = jest.fn<void, [string]>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChannelProvisioningService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: scenario.entityManager },
            {
                provide: CHANNEL_PROVISIONING_OPTIONS,
                useValue: {
                    telegramToken: new Secret(TOKEN),
                    print,
                    ...overrides,
                },
            },
            { provide: ChannelConnectionsService, useValue: channels },
            { provide: ConnectionGrantsService, useValue: grants },
            { provide: ConnectionsService, useValue: connections },
            { provide: WorkspaceMemberDirectoryService, useValue: directory },
            { provide: AgentDirectoryService, useValue: agentDirectory },
        ],
    }).compile()
    return {
        service: moduleRef.get(ChannelProvisioningService),
        entityManager: scenario.entityManager,
        agentDirectory,
        channels,
        grants,
        print,
        connections,
        directory,
    }
}

const invalid = (field: string) =>
    new ConnectionsError({ code: ConnectionsErrorCode.CommandInvalid, params: { field } })

const AGENT_ROWS = [
    { id: "chat-1", module: "chatbot" },
    { id: "bank-1", module: "accounting" },
    { id: "unknown-1", module: "unknown" },
    { id: "booking-1", module: "booking" },
    { id: "chat-2", module: "chatbot" },
]

const ZALO = {
    zaloAppId: "1234567890",
    zaloAppSecret: new Secret("app-secret-123"),
    zaloOaSecret: new Secret("oa-secret-123"),
}

describe("ChannelProvisioningService zalo", () => {
    it("connects a Zalo OA with every key sealed at once and binds the agents that chat", async () => {
        const { service, connections, grants, print } = await build(ZALO, scenarioOf(undefined, AGENT_ROWS))

        await service.run("zalo", { workspace: WORKSPACE, bind: true })

        expect(connections.create).toHaveBeenCalledWith({
            workspaceId: WORKSPACE,
            createdBy: "owner-1",
            provider: "zalo_oa",
            name: "Zalo OA",
            status: "pending",
            environment: "live",
            meta: { app_id: "1234567890", oa_secret_saved: "true" },
            secret: {
                plain: JSON.stringify({ appId: "1234567890", appSecret: "app-secret-123", oaSecret: "oa-secret-123" }),
                webhookSecret: connections.create.mock.calls[0]?.[0].secret.webhookSecret,
            },
        })
        expect(connections.create.mock.calls[0]?.[0].secret.webhookSecret).toMatch(/^[0-9a-f]{64}$/u)
        expect(print.mock.calls[0]?.[0]).toContain("zalo connection zalo-1")
        expect(grants.setConnectionAgents).toHaveBeenCalled()
    })

    it.each<[string, Partial<ChannelProvisioningOptions>]>([
        ["ZALO_APP_ID", { zaloAppId: undefined }],
        ["ZALO_APP_ID", { zaloAppId: "abc" }],
        ["ZALO_APP_SECRET", { zaloAppSecret: undefined }],
        ["ZALO_APP_SECRET", { zaloAppSecret: new Secret("short") }],
        ["ZALO_OA_SECRET", { zaloOaSecret: undefined }],
    ])("refuses Zalo without a valid %s", async (field, overrides) => {
        const { service, connections } = await build({ ...ZALO, ...overrides })
        await expect(service.run("zalo", { workspace: WORKSPACE, name: "OA" })).rejects.toEqual(invalid(field))
        expect(connections.create).not.toHaveBeenCalled()
    })
})

describe("ChannelProvisioningService refusals and telegram", () => {
    it.each<ProvisionFlags>([{}, { workspace: "" }, { workspace: "not-a-uuid" }, { workspace: `${WORKSPACE}extra` }])(
        "refuses workspace flags %j before querying or connecting",
        async (flags) => {
            const { service, entityManager, channels, grants, print } = await build({}, scenarioOf())

            const result = service.run("telegram", flags)

            await expect(result).rejects.toBeInstanceOf(ConnectionsError)
            await expect(result).rejects.toEqual(invalid("workspace"))
            expect(entityManager.createQueryBuilder).not.toHaveBeenCalled()
            expect(channels.connectTelegram).not.toHaveBeenCalled()
            expect(channels.startMoneyConnection).not.toHaveBeenCalled()
            expect(grants.setConnectionAgents).not.toHaveBeenCalled()
            expect(print).not.toHaveBeenCalled()
        },
    )

    it("refuses a workspace without an owner", async () => {
        const { service, channels, print } = await build({}, scenarioOf([]))

        await expect(service.run("telegram", { workspace: WORKSPACE })).rejects.toEqual(
            new ConnectionsError({ code: ConnectionsErrorCode.NotFound, params: { id: WORKSPACE } }),
        )
        expect(channels.connectTelegram).not.toHaveBeenCalled()
        expect(print).not.toHaveBeenCalled()
    })

    it.each(["unknown"])("refuses the unknown kind %s after finding the owner", async (kind) => {
        const { service, channels, print } = await build()

        await expect(service.run(kind, { workspace: WORKSPACE })).rejects.toEqual(invalid("kind"))

        expect(channels.connectTelegram).not.toHaveBeenCalled()
        expect(channels.startMoneyConnection).not.toHaveBeenCalled()
        expect(print).not.toHaveBeenCalled()
    })

    it("refuses Telegram without CHANNEL_BOT_TOKEN", async () => {
        const { service, channels, print } = await build({ telegramToken: undefined })

        await expect(service.run("telegram", { workspace: WORKSPACE })).rejects.toEqual(invalid("CHANNEL_BOT_TOKEN"))

        expect(channels.connectTelegram).not.toHaveBeenCalled()
        expect(print).not.toHaveBeenCalled()
    })

    it("connects Telegram as the owner with its default name and prints the registered webhook", async () => {
        const { service, channels, grants, print } = await build()

        await expect(service.run("telegram", { workspace: WORKSPACE })).resolves.toBeUndefined()

        expect(channels.connectTelegram.mock.calls).toEqual([[ACTOR, { name: "Bot Telegram", token: TOKEN }]])
        expect(print.mock.calls).toEqual([["telegram connection telegram-1 (Bot Telegram); webhook registered"]])
        expect(grants.setConnectionAgents).not.toHaveBeenCalled()
    })
})

describe("ChannelProvisioningService", () => {
    it("keeps the Telegram name and reports an unbound webhook when binding is disabled", async () => {
        const { service, channels, grants, print } = await build()
        channels.connectTelegram.mockResolvedValue({
            connection: { ...TELEGRAM, name: "Shop bot" },
            botUsername: "shop_bot",
            accountMasked: null,
            webhookRegistered: false,
        })

        await service.run("telegram", { workspace: WORKSPACE, name: "Shop bot", bind: false })

        expect(channels.connectTelegram.mock.calls).toEqual([[ACTOR, { name: "Shop bot", token: TOKEN }]])
        expect(print.mock.calls).toEqual([
            ["telegram connection telegram-1 (Shop bot); webhook not registered (the site is not public https)"],
        ])
        expect(grants.setConnectionAgents).not.toHaveBeenCalled()
    })

    it.each([
        { field: "bank-code", bank: { account: BANK.account, holder: BANK.holder } },
        { field: "account", bank: { bankCode: BANK.bankCode, holder: BANK.holder } },
        { field: "holder", bank: { bankCode: BANK.bankCode, account: BANK.account } },
    ])("refuses SePay without $field", async ({ field, bank }) => {
        const { service, channels, grants, print } = await build()

        await expect(service.run("sepay", { workspace: WORKSPACE, ...bank, bind: true })).rejects.toEqual(
            invalid(field),
        )

        expect(channels.startMoneyConnection).not.toHaveBeenCalled()
        expect(grants.setConnectionAgents).not.toHaveBeenCalled()
        expect(print).not.toHaveBeenCalled()
    })

    it("starts SePay with its default environment and name and prints the webhook url and API key", async () => {
        const { service, channels, grants, print } = await build()

        await expect(service.run("sepay", { workspace: WORKSPACE, ...BANK })).resolves.toBeUndefined()

        expect(channels.startMoneyConnection.mock.calls).toEqual([
            [
                ACTOR,
                {
                    provider: "sepay",
                    environment: "test",
                    name: "SePay",
                    bankCode: "MBBank",
                    accountNumber: "0123456789",
                    holder: "LAN",
                },
            ],
        ])
        expect(print.mock.calls).toEqual([
            [
                "sepay connection sepay-1; paste into SePay: url " +
                    "https://nivo.vn/hook/sepay/sepay-1  api key nivo-sepay-key",
            ],
        ])
        expect(grants.setConnectionAgents).not.toHaveBeenCalled()
    })
})

describe("ChannelProvisioningService", () => {
    it("binds only the agents whose modules can use Telegram, preserving their order", async () => {
        const { service, agentDirectory, grants, print } = await build({}, scenarioOf(undefined, AGENT_ROWS))

        await service.run("telegram", { workspace: WORKSPACE, bind: true })

        expect(agentDirectory.moduleRefsOf).toHaveBeenCalledWith(WORKSPACE, 500)
        expect(grants.setConnectionAgents.mock.calls).toEqual([
            [ACTOR, "telegram-1", [{ agentId: "chat-1" }, { agentId: "booking-1" }, { agentId: "chat-2" }]],
        ])
        expect(print.mock.calls).toEqual([
            ["telegram connection telegram-1 (Bot Telegram); webhook registered"],
            ["bound 3 agent(s)"],
        ])
    })

    it("uses the supplied SePay name and environment and binds only accounting agents", async () => {
        const { service, channels, grants, print } = await build({}, scenarioOf(undefined, AGENT_ROWS))

        await service.run("sepay", {
            workspace: WORKSPACE,
            ...BANK,
            name: "Shop bank",
            environment: "live",
            bind: true,
        })

        expect(channels.startMoneyConnection.mock.calls).toEqual([
            [
                ACTOR,
                {
                    provider: "sepay",
                    environment: "live",
                    name: "Shop bank",
                    bankCode: "MBBank",
                    accountNumber: "0123456789",
                    holder: "LAN",
                },
            ],
        ])
        expect(agentDirectory.moduleRefsOf).toHaveBeenCalledWith(WORKSPACE, 500)
        expect(grants.setConnectionAgents.mock.calls).toEqual([[ACTOR, "sepay-1", [{ agentId: "bank-1" }]]])
        expect(print.mock.calls).toEqual([
            [
                "sepay connection sepay-1; paste into SePay: url " +
                    "https://nivo.vn/hook/sepay/sepay-1  api key nivo-sepay-key",
            ],
            ["bound 1 agent(s)"],
        ])
    })
})

describe("ChannelProvisioningService", () => {
    it("sets an empty agent wish list and prints zero when no module can use the provider", async () => {
        const { service, grants, print } = await build(
            {},
            scenarioOf(undefined, [{ id: "bank-1", module: "accounting" }]),
        )

        await service.run("telegram", { workspace: WORKSPACE, bind: true })

        expect(grants.setConnectionAgents.mock.calls).toEqual([[ACTOR, "telegram-1", []]])
        expect(print.mock.calls).toEqual([
            ["telegram connection telegram-1 (Bot Telegram); webhook registered"],
            ["bound 0 agent(s)"],
        ])
    })
})
