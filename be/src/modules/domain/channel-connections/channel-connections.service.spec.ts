import { FakeClock, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { ConnectionsErrorCode, ConnectionsService } from "@modules/domain/connections"
import type { ConnectionActor, ConnectionRecord } from "@modules/domain/connections"
import { CHANNEL_SETUP_CLIENT, ChannelSetupError, ChannelSetupErrorCode } from "@modules/integrations/channel-setup"
import type { ChannelSetupClient } from "@modules/integrations/channel-setup"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ChannelConnectionsService } from "./channel-connections.service"
import { ChannelConnectionsErrorCode } from "./errors/channel-connections.error"
import * as moneyPolicy from "./money-provider.policy"
import { ChannelConnectionsLogEvent } from "./channel-connections.log-events"
const matching = (pattern: RegExp): unknown => expect.stringMatching(pattern)
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)
const actor: ConnectionActor = { principalId: "owner-1", workspaceId: "ws-1" }
const TOKEN = ["123456789", "AAEabcdefghijklmnopqrstuvwxyz012345"].join(":")
const NOW = new Date("2026-10-12T03:00:00.000Z")
const record = (overrides: Partial<ConnectionRecord> = {}): ConnectionRecord => ({
    id: "c1",
    workspaceId: "ws-1",
    provider: "sepay",
    name: "Bank",
    meta: { bank_code: "VCB", account_masked: "\u2022\u2022\u2022\u2022 1234", account_holder: "LAN" },
    status: "pending",
    lastError: null,
    environment: "live",
    isDefault: false,
    lastEventAt: null,
    firstEvent: null,
    createdBy: "owner-1",
    createdAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
})
const refused = (code: ChannelSetupErrorCode) => new ChannelSetupError({ code })
const build = async (origin: string | null = "https://nivo.vn") => {
    const connections = mock<ConnectionsService>()
    connections.authorize.mockResolvedValue({ role: "owner", displayName: "Lan" })
    connections.publicOrigin.mockReturnValue(origin)
    connections.webhookUrl.mockImplementation((provider, id, base) => `${base ?? "http://site"}/hook/${provider}/${id}`)
    connections.get.mockResolvedValue(record())
    connections.create.mockResolvedValue("c1")
    connections.findLiveByMeta.mockResolvedValue(null)
    connections.agentIds.mockResolvedValue(["agent-1"])
    const setup = mock<ChannelSetupClient>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChannelConnectionsService,
            { provide: ConnectionsService, useValue: connections },
            { provide: CHANNEL_SETUP_CLIENT, useValue: setup },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(ChannelConnectionsService), connections, setup, logger }
}
const zaloSecret = (extra: object = {}) =>
    JSON.stringify({ appId: "123456", appSecret: "secret-app", oaSecret: "", ...extra })
describe("ChannelConnectionsService connectTelegram", () => {
    it("stores the token sealed and registers the webhook on a public site", async () => {
        const { service, connections, setup } = await build()
        setup.telegramGetMe.mockResolvedValue({ id: "42", username: "shop_bot" })
        connections.get.mockResolvedValue(record({ provider: "telegram", status: "connected" }))
        const result = await service.connectTelegram(actor, { name: " Shop bot ", token: ` ${TOKEN} ` })
        expect(result.webhookRegistered).toBe(true)
        expect(connections.create).toHaveBeenCalledWith(
            expect.objectContaining({
                provider: "telegram",
                name: "Shop bot",
                status: "connected",
                meta: { bot_id: "42", bot_username: "shop_bot" },
                secret: { plain: TOKEN, webhookSecret: matching(/^[0-9a-f]{64}$/u) },
            }),
        )
        expect(setup.telegramSetWebhook).toHaveBeenCalledWith(
            TOKEN,
            "https://nivo.vn/hook/telegram/c1",
            expect.stringMatching(/^[0-9a-f]{64}$/u),
        )
    })
    it("keeps the connection but skips the webhook on a local site", async () => {
        const { service, setup } = await build(null)
        setup.telegramGetMe.mockResolvedValue({ id: "42", username: "" })
        await expect(service.connectTelegram(actor, { name: "Shop", token: TOKEN })).resolves.toMatchObject({
            webhookRegistered: false,
        })
        expect(setup.telegramSetWebhook).not.toHaveBeenCalled()
    })
    it.each([
        ["x", TOKEN, ConnectionsErrorCode.NameInvalid],
        ["Shop", "nope", ChannelConnectionsErrorCode.TokenFormat],
        ["Shop", TOKEN, ChannelConnectionsErrorCode.BotInUse],
    ])("refuses invalid or live Telegram bot %s/%s", async (name, token, code) => {
        const { service, connections, setup } = await build()
        setup.telegramGetMe.mockResolvedValue({ id: "42", username: "b" })
        connections.findLiveByMeta.mockResolvedValue({ id: "other", workspaceId: "ws-2" })
        await expect(service.connectTelegram(actor, { name, token })).rejects.toMatchObject({ code })
        expect(connections.create).not.toHaveBeenCalled()
    })
    it("tells a rejected token, an unreachable Telegram and any other failure apart", async () => {
        const { service, setup } = await build()
        setup.telegramGetMe.mockRejectedValueOnce(refused(ChannelSetupErrorCode.CredentialRejected))
        setup.telegramGetMe.mockRejectedValueOnce(refused(ChannelSetupErrorCode.Unreachable))
        setup.telegramGetMe.mockRejectedValueOnce(refused(ChannelSetupErrorCode.Refused))
        setup.telegramGetMe.mockRejectedValueOnce(new Error("boom"))
        const attempt = () => service.connectTelegram(actor, { name: "Shop", token: TOKEN })
        await expect(attempt()).rejects.toMatchObject({ code: ChannelConnectionsErrorCode.TokenRejected })
        await expect(attempt()).rejects.toMatchObject({ code: ChannelConnectionsErrorCode.Network })
        await expect(attempt()).rejects.toMatchObject({ code: ChannelConnectionsErrorCode.Failed })
        await expect(attempt()).rejects.toMatchObject({ code: ChannelConnectionsErrorCode.Failed })
    })
    it("marks the connection broken when Telegram refuses the webhook address", async () => {
        const { service, connections, setup } = await build()
        setup.telegramGetMe.mockResolvedValue({ id: "42", username: "b" })
        setup.telegramSetWebhook.mockRejectedValue(refused(ChannelSetupErrorCode.Refused))
        await expect(service.connectTelegram(actor, { name: "Shop", token: TOKEN })).rejects.toMatchObject({
            code: ChannelConnectionsErrorCode.WebhookRefused,
        })
        expect(connections.patch).toHaveBeenCalledWith("ws-1", "c1", {
            status: "error",
            lastError: ChannelConnectionsErrorCode.WebhookRefused,
        })
    })
})
describe("ChannelConnectionsService startMoneyConnection", () => {
    const input = {
        provider: "sepay",
        environment: "test",
        name: "Bank feed",
        bankCode: " vcb ",
        accountNumber: "1234 5678 90",
        holder: " lan ",
    }
    it("creates a pending SePay feed with a generated API key whose hash verifies calls", async () => {
        const { service, connections } = await build()
        const view = await service.startMoneyConnection(actor, input)
        const created = connections.create.mock.calls[0]?.[0]
        expect(created).toMatchObject({
            provider: "sepay",
            status: "pending",
            environment: "test",
            meta: { bank_code: "VCB", account_masked: "\u2022\u2022\u2022\u2022 7890", account_holder: "LAN" },
        })
        expect(created?.meta.account_number).toBe("1234567890")
        expect(created?.secret.plain).toMatch(/^nivo_[0-9a-f]{64}$/u)
        expect(created?.secret.webhookSecret).toMatch(/^[0-9a-f]{64}$/u)
        expect(view).toMatchObject({
            id: "c1",
            provider: "sepay",
            apiKey: created?.secret.plain,
            bankCode: "VCB",
            holder: "LAN",
            webhookUrl: "http://site/hook/sepay/c1",
            credentialsSaved: false,
        })
    })
    it("creates a payOS feed with an empty credential and no bank, and falls back to live", async () => {
        const { service, connections } = await build()
        connections.get.mockResolvedValue(record({ provider: "payos", meta: {} }))
        const view = await service.startMoneyConnection(actor, { ...input, provider: "payos" })
        expect(connections.create).toHaveBeenCalledWith(
            expect.objectContaining({
                provider: "payos",
                environment: "live",
                meta: {},
                secret: { plain: "{}", webhookSecret: matching(/^[0-9a-f]{64}$/u) },
            }),
        )
        expect(view).toMatchObject({ apiKey: "", bankCode: "", account: "", holder: "" })
    })
    it.each([
        [{ provider: "stripe" }, ChannelConnectionsErrorCode.ProviderUnsupported],
        [{ accountNumber: "12ab" }, ChannelConnectionsErrorCode.AccountInvalid],
        [{ accountNumber: undefined }, ChannelConnectionsErrorCode.AccountInvalid],
        [{ bankCode: " " }, ChannelConnectionsErrorCode.BankFieldsMissing],
        [{ holder: "" }, ChannelConnectionsErrorCode.BankFieldsMissing],
    ] as const)("refuses invalid money input %j", async (invalid, code) => {
        const { service } = await build()
        await expect(service.startMoneyConnection(actor, { ...input, ...invalid })).rejects.toMatchObject({ code })
    })
})
describe("ChannelConnectionsService updateMoneyConnection", () => {
    const input = { environment: "live", name: "Renamed", bankCode: "tcb", accountNumber: "", holder: "mai" }
    it.each(["", undefined])("keeps the stored account when the number is %j, and the key", async (accountNumber) => {
        const { service, connections } = await build()
        connections.get.mockResolvedValue(record({ meta: { ...record().meta, account_number: "991234" } }))
        connections.readSecret.mockResolvedValue({ plain: "nivo_aaaaaaaaaaaaaaaa", webhookSecret: "h" })
        const view = await service.updateMoneyConnection(actor, "c1", { ...input, accountNumber })
        expect(connections.patch).toHaveBeenCalledWith("ws-1", "c1", {
            name: "Renamed",
            environment: "live",
            meta: { ...record().meta, bank_code: "TCB", account_number: "991234", account_holder: "MAI" },
        })
        expect(connections.writeSecret).not.toHaveBeenCalled()
        expect(view.apiKey).toBe(`${"•".repeat(12)}aaaa`)
    })
    it("replaces the SePay key and the account when new ones are typed", async () => {
        const { service, connections } = await build()
        connections.readSecret.mockResolvedValue({ plain: "old_key_old_key_old", webhookSecret: "h" })
        await service.updateMoneyConnection(actor, "c1", {
            ...input,
            accountNumber: "9999 8888",
            apiKey: " new_key_new_key_new ",
        })
        expect(connections.writeSecret).toHaveBeenCalledWith("c1", "new_key_new_key_new", matching(/^[0-9a-f]{64}$/u))
        expect(connections.patch).toHaveBeenCalledWith(
            "ws-1",
            "c1",
            objectLike({ meta: objectLike({ account_masked: "\u2022\u2022\u2022\u2022 8888" }) }),
        )
        expect(connections.patch.mock.calls[0]?.[2].meta?.account_number).toBe("99998888")
    })
    it("treats a missing secret as an empty key and refuses a malformed one", async () => {
        const { service, connections } = await build()
        connections.readSecret.mockResolvedValue(null)
        await expect(service.updateMoneyConnection(actor, "c1", input)).rejects.toMatchObject({
            code: ChannelConnectionsErrorCode.ApiKeyInvalid,
        })
        await expect(service.updateMoneyConnection(actor, "c1", { ...input, apiKey: "short" })).rejects.toMatchObject({
            code: ChannelConnectionsErrorCode.ApiKeyInvalid,
        })
    })
    it("edits a payOS feed without touching a bank or a key", async () => {
        const { service, connections } = await build()
        connections.get.mockResolvedValue(record({ provider: "payos", environment: "live", meta: {} }))
        await service.updateMoneyConnection(actor, "c1", { ...input, environment: "test" })
        expect(connections.patch).toHaveBeenCalledWith("ws-1", "c1", {
            name: "Renamed",
            environment: "live",
            meta: {},
        })
        expect(connections.readSecret).not.toHaveBeenCalled()
    })
    it.each([
        ["telegram", {}, ChannelConnectionsErrorCode.ProviderUnsupported],
        ["sepay", { accountNumber: "abc" }, ChannelConnectionsErrorCode.AccountInvalid],
        ["sepay", { holder: " " }, ChannelConnectionsErrorCode.BankFieldsMissing],
        ["sepay", { bankCode: "" }, ChannelConnectionsErrorCode.BankFieldsMissing],
    ] as const)("refuses invalid %s money update %j", async (provider, invalid, code) => {
        const { service, connections } = await build()
        connections.get.mockResolvedValue(record({ provider }))
        await expect(service.updateMoneyConnection(actor, "c1", { ...input, ...invalid })).rejects.toMatchObject({
            code,
        })
    })
})
describe("ChannelConnectionsService resumeConnection and revealSepayKey", () => {
    it.each([
        ["sepay", "nivo_key", { apiKey: `${"•".repeat(12)}_key`, credentialsSaved: false }],
        ["payos", '{"clientId":"x"}', { apiKey: "", credentialsSaved: true }],
        ["payos", "{}", { credentialsSaved: false }],
        ["payos", null, { credentialsSaved: false }],
        ["sepay", null, { apiKey: "", credentialsSaved: false }],
    ] as const)("resumes %s with stored credential %j", async (provider, plain, expected) => {
        const { service, connections } = await build()
        connections.get.mockResolvedValue(record({ provider }))
        connections.readSecret.mockResolvedValue(plain === null ? null : { plain, webhookSecret: "h" })
        await expect(service.resumeConnection(actor, "c1")).resolves.toMatchObject(expected)
    })
    it("reveals the key of a SePay connection only", async () => {
        const { service, connections } = await build()
        connections.readSecret.mockResolvedValueOnce({ plain: "nivo_key", webhookSecret: "h" })
        connections.readSecret.mockResolvedValueOnce(null)
        await expect(service.revealSepayKey(actor, "c1")).resolves.toEqual({
            apiKey: "nivo_key",
            webhookUrl: "http://site/hook/sepay/c1",
        })
        await expect(service.revealSepayKey(actor, "c1")).rejects.toMatchObject({
            code: ConnectionsErrorCode.NotFound,
        })
        connections.get.mockResolvedValue(record({ provider: "casso" }))
        await expect(service.revealSepayKey(actor, "c1")).rejects.toMatchObject({
            code: ConnectionsErrorCode.NotFound,
        })
    })
})
describe("ChannelConnectionsService saveProviderKeys", () => {
    const payos = { clientId: " client-id-1 ", apiKey: "api-key-123", checksumKey: "checksum-123" }
    it("seals the keys and asks payOS to confirm the webhook on a public site", async () => {
        const { service, connections, setup } = await build()
        connections.get.mockResolvedValue(record({ provider: "payos" }))
        await expect(service.saveProviderKeys(actor, "c1", payos)).resolves.toEqual({
            confirmed: true,
            localOnly: false,
        })
        expect(connections.writeSecret).toHaveBeenCalledWith(
            "c1",
            JSON.stringify({ clientId: "client-id-1", apiKey: "api-key-123", checksumKey: "checksum-123" }),
        )
        expect(setup.payosConfirmWebhook).toHaveBeenCalledWith(
            { clientId: "client-id-1", apiKey: "api-key-123" },
            "https://nivo.vn/hook/payos/c1",
        )
    })
    it.each(["clientId", "apiKey"])("rejects rules omitting payOS %s before confirmation", async (omitted) => {
        const { service, connections, setup } = await build()
        connections.get.mockResolvedValue(record({ provider: "payos" }))
        const rules = moneyPolicy.moneyRules("payos")
        const credentials = rules.credentials.filter((field) => field !== omitted)
        const ruleSpy = jest.spyOn(moneyPolicy, "moneyRules").mockReturnValueOnce({ ...rules, credentials })
        try {
            await expect(service.saveProviderKeys(actor, "c1", payos)).rejects.toMatchObject({
                code: ChannelConnectionsErrorCode.KeysInvalid,
            })
            const stored =
                omitted === "clientId"
                    ? { apiKey: "api-key-123", checksumKey: "checksum-123" }
                    : { clientId: "client-id-1", checksumKey: "checksum-123" }
            expect(connections.writeSecret).toHaveBeenCalledWith("c1", JSON.stringify(stored))
            expect(setup.payosConfirmWebhook).not.toHaveBeenCalled()
        } finally {
            ruleSpy.mockRestore()
        }
    })
    it("skips the confirmation on a local site and for providers that do not confirm", async () => {
        const local = await build(null)
        local.connections.get.mockResolvedValue(record({ provider: "payos" }))
        const casso = await build()
        casso.connections.get.mockResolvedValue(record({ provider: "casso" }))
        await expect(local.service.saveProviderKeys(actor, "c1", payos)).resolves.toEqual({
            confirmed: false,
            localOnly: true,
        })
        await expect(casso.service.saveProviderKeys(actor, "c1", { secureKey: "secure-key-1" })).resolves.toEqual({
            confirmed: false,
            localOnly: false,
        })
        expect(local.setup.payosConfirmWebhook).not.toHaveBeenCalled()
        expect(casso.setup.payosConfirmWebhook).not.toHaveBeenCalled()
    })
    it.each([
        ["payos", { ...payos, apiKey: "short" }, ChannelConnectionsErrorCode.KeysInvalid],
        ["payos", { ...payos, apiKey: "x".repeat(201) }, ChannelConnectionsErrorCode.KeysInvalid],
        ["payos", { clientId: "client-id-1" }, ChannelConnectionsErrorCode.KeysInvalid],
        ["payos", payos, ChannelConnectionsErrorCode.PayosConfirmRefused],
        ["sepay", {}, ConnectionsErrorCode.NotFound],
        ["telegram", {}, ConnectionsErrorCode.NotFound],
    ] as const)("refuses invalid or refused %s keys %j", async (provider, keys, code) => {
        const { service, connections, setup } = await build()
        connections.get.mockResolvedValue(record({ provider }))
        setup.payosConfirmWebhook.mockRejectedValue(refused(ChannelSetupErrorCode.Refused))
        await expect(service.saveProviderKeys(actor, "c1", keys)).rejects.toMatchObject({ code })
    })
})
describe("ChannelConnectionsService check", () => {
    it("reads Telegram's view of the webhook and records the verdict", async () => {
        const { service, connections, setup } = await build()
        connections.get.mockResolvedValue(record({ provider: "telegram", status: "connected" }))
        connections.readSecret.mockResolvedValue({ plain: TOKEN, webhookSecret: "h" })
        setup.telegramGetMe.mockResolvedValue({ id: "42", username: "b" })
        setup.telegramWebhookInfo.mockResolvedValue({
            url: "https://nivo.vn/hook/telegram/c1",
            pendingUpdateCount: 2,
            lastErrorMessage: null,
        })
        await expect(service.check(actor, "c1")).resolves.toEqual({
            provider: "telegram",
            webhookOk: true,
            localOnly: false,
            pending: 2,
            lastError: null,
        })
        expect(connections.patch).toHaveBeenCalledWith("ws-1", "c1", { status: "connected", lastError: null })
    })
    it("marks the connection broken when the address differs or Telegram reports a delivery error", async () => {
        const { service, connections, setup } = await build()
        connections.get.mockResolvedValue(record({ provider: "telegram", status: "connected" }))
        connections.readSecret.mockResolvedValue({ plain: TOKEN, webhookSecret: "h" })
        const cases = [
            ["https://old.test", null, false],
            ["https://nivo.vn/hook/telegram/c1", "Connection timed out", true],
        ] as const
        for (const [index, [url, lastError, webhookOk]] of cases.entries()) {
            setup.telegramWebhookInfo.mockResolvedValue({ url, pendingUpdateCount: 0, lastErrorMessage: lastError })
            await expect(service.check(actor, "c1")).resolves.toMatchObject({ webhookOk, lastError })
            expect(connections.patch).toHaveBeenNthCalledWith(index + 1, "ws-1", "c1", {
                status: "error",
                lastError,
            })
        }
    })
    it("is healthy on a local site whatever Telegram says", async () => {
        const { service, connections, setup } = await build(null)
        connections.get.mockResolvedValue(record({ provider: "telegram" }))
        connections.readSecret.mockResolvedValue({ plain: TOKEN, webhookSecret: "h" })
        setup.telegramWebhookInfo.mockResolvedValue({ url: "", pendingUpdateCount: 0, lastErrorMessage: "x" })
        await expect(service.check(actor, "c1")).resolves.toMatchObject({
            webhookOk: false,
            localOnly: true,
            lastError: "x",
        })
        expect(connections.patch).toHaveBeenCalledWith("ws-1", "c1", { status: "connected", lastError: null })
    })
    it("records a failure of the provider call on the connection and raises it", async () => {
        const { service, connections, setup } = await build()
        connections.get.mockResolvedValue(record({ provider: "telegram" }))
        connections.readSecret.mockResolvedValue({ plain: TOKEN, webhookSecret: "h" })
        setup.telegramGetMe.mockRejectedValue(refused(ChannelSetupErrorCode.CredentialRejected))
        await expect(service.check(actor, "c1")).rejects.toMatchObject({
            code: ChannelConnectionsErrorCode.TokenRejected,
        })
        expect(connections.patch).toHaveBeenCalledWith("ws-1", "c1", {
            status: "error",
            lastError: ChannelConnectionsErrorCode.TokenRejected,
        })
    })
})
describe("ChannelConnectionsService check", () => {
    it("refuses a Telegram connection whose secret is gone and a disconnected connection", async () => {
        const { service, connections } = await build()
        connections.get.mockResolvedValueOnce(record({ provider: "telegram" }))
        connections.readSecret.mockResolvedValueOnce(null)
        connections.get.mockResolvedValueOnce(record({ status: "disconnected" }))
        await expect(service.check(actor, "c1")).rejects.toMatchObject({ code: ConnectionsErrorCode.NotFound })
        await expect(service.check(actor, "c1")).rejects.toMatchObject({ code: ConnectionsErrorCode.NotFound })
    })
    it("answers nothing to ask for the other providers", async () => {
        const { service } = await build()
        await expect(service.check(actor, "c1")).resolves.toEqual({
            provider: "sepay",
            webhookOk: false,
            localOnly: false,
            pending: 0,
            lastError: null,
        })
    })
    it("checks that the Zalo tokens are still usable and heals a connection that was in error", async () => {
        const { service, connections } = await build()
        connections.get.mockResolvedValueOnce(record({ provider: "zalo_oa", status: "error" }))
        connections.get.mockResolvedValueOnce(record({ provider: "zalo_oa", status: "connected" }))
        connections.readSecret.mockResolvedValue({
            plain: zaloSecret({ refreshToken: "rt", refreshExpiresAt: "2027-01-01T00:00:00.000Z" }),
            webhookSecret: "h",
        })
        await expect(service.check(actor, "c1")).resolves.toMatchObject({ provider: "zalo_oa", webhookOk: true })
        await service.check(actor, "c1")
        expect(connections.patch).toHaveBeenNthCalledWith(1, "ws-1", "c1", { status: "connected", lastError: null })
        expect(connections.patch).toHaveBeenNthCalledWith(2, "ws-1", "c1", { lastError: null })
    })
    it.each([zaloSecret(), zaloSecret({ refreshToken: "rt", refreshExpiresAt: "2026-01-01T00:00:00.000Z" })])(
        "marks Zalo broken for missing or expired tokens %s",
        async (plain) => {
            const { service, connections } = await build()
            const code = ChannelConnectionsErrorCode.ZaloTokenRefused
            connections.get.mockResolvedValue(record({ provider: "zalo_oa", status: "connected" }))
            connections.readSecret.mockResolvedValue({ plain, webhookSecret: "h" })
            await expect(service.check(actor, "c1")).rejects.toMatchObject({ code })
            expect(connections.patch).toHaveBeenCalledWith("ws-1", "c1", { status: "error", lastError: code })
        },
    )
    it.each([null, { plain: "garbage", webhookSecret: "h" }])("refuses Zalo secret %j", async (sealed) => {
        const { service, connections } = await build()
        connections.get.mockResolvedValue(record({ provider: "zalo_oa" }))
        connections.readSecret.mockResolvedValue(sealed)
        await expect(service.check(actor, "c1")).rejects.toMatchObject({ code: ConnectionsErrorCode.NotFound })
        expect(connections.patch).not.toHaveBeenCalled()
    })
})
describe("ChannelConnectionsService release and firstEvent", () => {
    it.each([
        [new Error("down"), "unknown"],
        [{ code: "provider-down" }, "provider-down"],
        [{ code: 1 }, "unknown"],
        [null, "unknown"],
        ["down", "unknown"],
        [undefined, null],
    ] as const)("releases the public Telegram webhook with provider outcome %j", async (error, code) => {
        const { service, connections, setup, logger } = await build()
        connections.readSecret.mockResolvedValue({ plain: TOKEN, webhookSecret: "h" })
        if (code === null) setup.telegramDeleteWebhook.mockResolvedValue(undefined)
        else setup.telegramDeleteWebhook.mockRejectedValue(error)
        await expect(service.release(record({ provider: "telegram" }))).resolves.toBeUndefined()
        expect(setup.telegramDeleteWebhook).toHaveBeenCalledWith(TOKEN)
        if (code === null) expect(logger.warn).not.toHaveBeenCalled()
        else
            expect(logger.warn).toHaveBeenCalledWith(ChannelConnectionsLogEvent.TelegramReleaseFailed, {
                connectionId: "c1",
                code,
            })
    })
    it("does nothing for other providers, a local site or a missing secret", async () => {
        const { service, connections, setup } = await build()
        const local = await build(null)
        connections.readSecret.mockResolvedValue(null)
        await service.release(record({ provider: "sepay" }))
        await local.service.release(record({ provider: "telegram" }))
        await service.release(record({ provider: "telegram" }))
        expect(setup.telegramDeleteWebhook).not.toHaveBeenCalled()
        expect(local.setup.telegramDeleteWebhook).not.toHaveBeenCalled()
    })
    it("delegates the first-event poll to the connections capability", async () => {
        const { service, connections } = await build()
        connections.firstEvent.mockResolvedValue({ status: "connected", firstEvent: null })
        await expect(service.firstEvent(actor, "c1")).resolves.toEqual({ status: "connected", firstEvent: null })
        expect(connections.firstEvent).toHaveBeenCalledWith(actor, "c1")
    })
})
