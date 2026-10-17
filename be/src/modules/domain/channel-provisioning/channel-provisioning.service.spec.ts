import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { ChannelConnectionsService } from "@modules/domain/channel-connections"
import { ConnectionGrantsService } from "@modules/domain/connection-grants"
import { ConnectionsError, ConnectionsErrorCode } from "@modules/domain/connections"
import type { ConnectionRecord } from "@modules/domain/connections"
import { Secret } from "@modules/platform/config"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { ProvisionFlags } from "./channel-provisioning.contracts"
import { CHANNEL_PROVISIONING_OPTIONS } from "./channel-provisioning.decorators"
import type { ChannelProvisioningOptions } from "./channel-provisioning.options"
import { ChannelProvisioningService } from "./channel-provisioning.service"
import { FIND_WORKSPACE_OWNER, LIST_WORKSPACE_AGENTS } from "./persistence/channel-provisioning.sql"

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

const build = async (
    overrides: Partial<ChannelProvisioningOptions> = {},
    entityManager: MockEntityManager = mockEntityManager({ query: [FIND_WORKSPACE_OWNER, [{ user_id: "owner-1" }]] }),
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
    const print = jest.fn()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChannelProvisioningService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
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
        ],
    }).compile()
    return { service: moduleRef.get(ChannelProvisioningService), entityManager, channels, grants, print }
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

describe("ChannelProvisioningService", () => {
    it.each<ProvisionFlags>([{}, { workspace: "" }, { workspace: "not-a-uuid" }, { workspace: `${WORKSPACE}extra` }])(
        "refuses workspace flags %j before querying or connecting",
        async (flags) => {
            const { service, entityManager, channels, grants, print } = await build({}, mockEntityManager())

            const result = service.run("telegram", flags)

            await expect(result).rejects.toBeInstanceOf(ConnectionsError)
            await expect(result).rejects.toEqual(invalid("workspace"))
            expect(entityManager.query).not.toHaveBeenCalled()
            expect(channels.connectTelegram).not.toHaveBeenCalled()
            expect(channels.startMoneyConnection).not.toHaveBeenCalled()
            expect(grants.setConnectionAgents).not.toHaveBeenCalled()
            expect(print).not.toHaveBeenCalled()
        },
    )

    it("refuses a workspace without an owner", async () => {
        const { service, entityManager, channels, print } = await build(
            {},
            mockEntityManager({ query: [FIND_WORKSPACE_OWNER, []] }),
        )

        await expect(service.run("telegram", { workspace: WORKSPACE })).rejects.toEqual(
            new ConnectionsError({ code: ConnectionsErrorCode.NotFound, params: { id: WORKSPACE } }),
        )
        expect(entityManager.query.mock.calls).toEqual([[FIND_WORKSPACE_OWNER, [WORKSPACE]]])
        expect(channels.connectTelegram).not.toHaveBeenCalled()
        expect(print).not.toHaveBeenCalled()
    })

    it.each(["unknown", "zalo"])("refuses the unknown kind %s after finding the owner", async (kind) => {
        const { service, entityManager, channels, print } = await build()

        await expect(service.run(kind, { workspace: WORKSPACE })).rejects.toEqual(invalid("kind"))

        expect(entityManager.query.mock.calls).toEqual([[FIND_WORKSPACE_OWNER, [WORKSPACE]]])
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
        const { service, entityManager, channels, grants, print } = await build()

        await expect(service.run("telegram", { workspace: WORKSPACE })).resolves.toBeUndefined()

        expect(channels.connectTelegram.mock.calls).toEqual([[ACTOR, { name: "Bot Telegram", token: TOKEN }]])
        expect(entityManager.query.mock.calls).toEqual([[FIND_WORKSPACE_OWNER, [WORKSPACE]]])
        expect(print.mock.calls).toEqual([["telegram connection telegram-1 (Bot Telegram); webhook registered"]])
        expect(grants.setConnectionAgents).not.toHaveBeenCalled()
    })
})

describe("ChannelProvisioningService", () => {
    it("keeps the Telegram name and reports an unbound webhook when binding is disabled", async () => {
        const { service, entityManager, channels, grants, print } = await build()
        channels.connectTelegram.mockResolvedValue({
            connection: { ...TELEGRAM, name: "Shop bot" },
            botUsername: "shop_bot",
            accountMasked: null,
            webhookRegistered: false,
        })

        await service.run("telegram", { workspace: WORKSPACE, name: "Shop bot", bind: false })

        expect(channels.connectTelegram.mock.calls).toEqual([[ACTOR, { name: "Shop bot", token: TOKEN }]])
        expect(entityManager.query.mock.calls).toEqual([[FIND_WORKSPACE_OWNER, [WORKSPACE]]])
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
        const { service, entityManager, channels, grants, print } = await build()

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
        expect(entityManager.query.mock.calls).toEqual([[FIND_WORKSPACE_OWNER, [WORKSPACE]]])
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
        const { service, entityManager, grants, print } = await build(
            {},
            mockEntityManager({
                query: [
                    [FIND_WORKSPACE_OWNER, [{ user_id: "owner-1" }]],
                    [LIST_WORKSPACE_AGENTS, AGENT_ROWS],
                ],
            }),
        )

        await service.run("telegram", { workspace: WORKSPACE, bind: true })

        expect(entityManager.query.mock.calls).toEqual([
            [FIND_WORKSPACE_OWNER, [WORKSPACE]],
            [LIST_WORKSPACE_AGENTS, [WORKSPACE]],
        ])
        expect(grants.setConnectionAgents.mock.calls).toEqual([
            [ACTOR, "telegram-1", [{ agentId: "chat-1" }, { agentId: "booking-1" }, { agentId: "chat-2" }]],
        ])
        expect(print.mock.calls).toEqual([
            ["telegram connection telegram-1 (Bot Telegram); webhook registered"],
            ["bound 3 agent(s)"],
        ])
    })

    it("uses the supplied SePay name and environment and binds only accounting agents", async () => {
        const { service, entityManager, channels, grants, print } = await build(
            {},
            mockEntityManager({
                query: [
                    [FIND_WORKSPACE_OWNER, [{ user_id: "owner-1" }]],
                    [LIST_WORKSPACE_AGENTS, AGENT_ROWS],
                ],
            }),
        )

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
        expect(entityManager.query.mock.calls).toEqual([
            [FIND_WORKSPACE_OWNER, [WORKSPACE]],
            [LIST_WORKSPACE_AGENTS, [WORKSPACE]],
        ])
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
            mockEntityManager({
                query: [
                    [FIND_WORKSPACE_OWNER, [{ user_id: "owner-1" }]],
                    [LIST_WORKSPACE_AGENTS, [{ id: "bank-1", module: "accounting" }]],
                ],
            }),
        )

        await service.run("telegram", { workspace: WORKSPACE, bind: true })

        expect(grants.setConnectionAgents.mock.calls).toEqual([[ACTOR, "telegram-1", []]])
        expect(print.mock.calls).toEqual([
            ["telegram connection telegram-1 (Bot Telegram); webhook registered"],
            ["bound 0 agent(s)"],
        ])
    })
})
