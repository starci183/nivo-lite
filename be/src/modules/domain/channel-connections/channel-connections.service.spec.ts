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
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChannelConnectionsService,
            { provide: ConnectionsService, useValue: connections },
            { provide: CHANNEL_SETUP_CLIENT, useValue: setup },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LOGGER, useValue: mock<Logger>() },
        ],
    }).compile()
    return { service: moduleRef.get(ChannelConnectionsService), connections, setup }
}
const zaloSecret = (extra: object = {}) =>
    JSON.stringify({ appId: "123456", appSecret: "secret-app", oaSecret: "", ...extra })
describe("ChannelConnectionsService", () => {
    describe("connectTelegram", () => {
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
                    secret: { plain: TOKEN, webhookSecret: expect.stringMatching(/^[0-9a-f]{64}$/u) },
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

        it("refuses a short name, a malformed token and a bot that is already live", async () => {
            const { service, connections, setup } = await build()

            setup.telegramGetMe.mockResolvedValue({ id: "42", username: "b" })
            connections.findLiveByMeta.mockResolvedValue({ id: "other", workspaceId: "ws-2" })
            await expect(service.connectTelegram(actor, { name: "x", token: TOKEN })).rejects.toMatchObject({
                code: ConnectionsErrorCode.NameInvalid,
            })
            await expect(service.connectTelegram(actor, { name: "Shop", token: "nope" })).rejects.toMatchObject({
                code: ChannelConnectionsErrorCode.TokenFormat,
            })
            await expect(service.connectTelegram(actor, { name: "Shop", token: TOKEN })).rejects.toMatchObject({
                code: ChannelConnectionsErrorCode.BotInUse,
            })
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

    describe("startMoneyConnection", () => {
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
                    secret: { plain: "{}", webhookSecret: expect.stringMatching(/^[0-9a-f]{64}$/u) },
                }),
            )
            expect(view).toMatchObject({ apiKey: "", bankCode: "", account: "", holder: "" })
        })

        it("refuses an unknown provider, a bad account and missing bank fields", async () => {
            const { service } = await build()

            await expect(service.startMoneyConnection(actor, { ...input, provider: "stripe" })).rejects.toMatchObject({
                code: ChannelConnectionsErrorCode.ProviderUnsupported,
            })
            await expect(
                service.startMoneyConnection(actor, { ...input, accountNumber: "12ab" }),
            ).rejects.toMatchObject({ code: ChannelConnectionsErrorCode.AccountInvalid })
            await expect(service.startMoneyConnection(actor, { ...input, bankCode: " " })).rejects.toMatchObject({
                code: ChannelConnectionsErrorCode.BankFieldsMissing,
            })
            await expect(service.startMoneyConnection(actor, { ...input, holder: "" })).rejects.toMatchObject({
                code: ChannelConnectionsErrorCode.BankFieldsMissing,
            })
        })
    })

    describe("updateMoneyConnection", () => {
        const input = { environment: "live", name: "Renamed", bankCode: "tcb", accountNumber: "", holder: "mai" }

        it("keeps the stored account when the number is blank and the key when none is typed", async () => {
            const { service, connections } = await build()

            connections.readSecret.mockResolvedValue({ plain: "nivo_aaaaaaaaaaaaaaaa", webhookSecret: "h" })
            const view = await service.updateMoneyConnection(actor, "c1", input)
            expect(connections.patch).toHaveBeenCalledWith("ws-1", "c1", {
                name: "Renamed",
                environment: "live",
                meta: { bank_code: "TCB", account_masked: "\u2022\u2022\u2022\u2022 1234", account_holder: "MAI" },
            })
            expect(connections.writeSecret).not.toHaveBeenCalled()
            expect(view.apiKey).toBe("nivo_aaaaaaaaaaaaaaaa")
        })

        it("replaces the SePay key and the account when new ones are typed", async () => {
            const { service, connections } = await build()

            connections.readSecret.mockResolvedValue({ plain: "old_key_old_key_old", webhookSecret: "h" })
            await service.updateMoneyConnection(actor, "c1", {
                ...input,
                accountNumber: "9999 8888",
                apiKey: " new_key_new_key_new ",
            })
            expect(connections.writeSecret).toHaveBeenCalledWith(
                "c1",
                "new_key_new_key_new",
                expect.stringMatching(/^[0-9a-f]{64}$/u),
            )
            expect(connections.patch).toHaveBeenCalledWith(
                "ws-1",
                "c1",
                expect.objectContaining({
                    meta: expect.objectContaining({ account_masked: "\u2022\u2022\u2022\u2022 8888" }),
                }),
            )
        })

        it("treats a missing secret as an empty key and refuses a malformed one", async () => {
            const { service, connections } = await build()

            connections.readSecret.mockResolvedValue(null)
            await expect(service.updateMoneyConnection(actor, "c1", input)).rejects.toMatchObject({
                code: ChannelConnectionsErrorCode.ApiKeyInvalid,
            })
            await expect(
                service.updateMoneyConnection(actor, "c1", { ...input, apiKey: "short" }),
            ).rejects.toMatchObject({ code: ChannelConnectionsErrorCode.ApiKeyInvalid })
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

        it("refuses a connection that is not a money feed, a bad account and missing bank fields", async () => {
            const { service, connections } = await build()

            connections.get.mockResolvedValueOnce(record({ provider: "telegram" }))
            await expect(service.updateMoneyConnection(actor, "c1", input)).rejects.toMatchObject({
                code: ChannelConnectionsErrorCode.ProviderUnsupported,
            })
            await expect(
                service.updateMoneyConnection(actor, "c1", { ...input, accountNumber: "abc" }),
            ).rejects.toMatchObject({ code: ChannelConnectionsErrorCode.AccountInvalid })
            await expect(service.updateMoneyConnection(actor, "c1", { ...input, holder: " " })).rejects.toMatchObject({
                code: ChannelConnectionsErrorCode.BankFieldsMissing,
            })
            await expect(service.updateMoneyConnection(actor, "c1", { ...input, bankCode: "" })).rejects.toMatchObject({
                code: ChannelConnectionsErrorCode.BankFieldsMissing,
            })
        })
    })

    describe("resumeConnection and revealSepayKey", () => {
        it("shows the SePay key again and reports saved keys of the others without returning them", async () => {
            const { service, connections } = await build()

            connections.readSecret.mockResolvedValueOnce({ plain: "nivo_key", webhookSecret: "h" })
            connections.readSecret.mockResolvedValueOnce({ plain: '{"clientId":"x"}', webhookSecret: "h" })
            connections.readSecret.mockResolvedValueOnce({ plain: "{}", webhookSecret: "h" })
            connections.readSecret.mockResolvedValueOnce(null)
            await expect(service.resumeConnection(actor, "c1")).resolves.toMatchObject({
                apiKey: "nivo_key",
                credentialsSaved: false,
            })
            connections.get.mockResolvedValue(record({ provider: "payos" }))
            await expect(service.resumeConnection(actor, "c1")).resolves.toMatchObject({
                apiKey: "",
                credentialsSaved: true,
            })
            await expect(service.resumeConnection(actor, "c1")).resolves.toMatchObject({ credentialsSaved: false })
            await expect(service.resumeConnection(actor, "c1")).resolves.toMatchObject({ credentialsSaved: false })
            connections.get.mockResolvedValue(record({ provider: "sepay" }))
            connections.readSecret.mockResolvedValueOnce(null)
            await expect(service.resumeConnection(actor, "c1")).resolves.toMatchObject({
                apiKey: "",
                credentialsSaved: false,
            })
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

    describe("saveProviderKeys", () => {
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

        it("refuses missing or out-of-range keys, a provider without keys and a payOS that refuses", async () => {
            const { service, connections, setup } = await build()

            connections.get.mockResolvedValue(record({ provider: "payos" }))
            setup.payosConfirmWebhook.mockRejectedValue(refused(ChannelSetupErrorCode.Refused))
            await expect(service.saveProviderKeys(actor, "c1", { ...payos, apiKey: "short" })).rejects.toMatchObject({
                code: ChannelConnectionsErrorCode.KeysInvalid,
            })
            await expect(
                service.saveProviderKeys(actor, "c1", { ...payos, apiKey: "x".repeat(201) }),
            ).rejects.toMatchObject({ code: ChannelConnectionsErrorCode.KeysInvalid })
            await expect(service.saveProviderKeys(actor, "c1", { clientId: "client-id-1" })).rejects.toMatchObject({
                code: ChannelConnectionsErrorCode.KeysInvalid,
            })
            await expect(service.saveProviderKeys(actor, "c1", payos)).rejects.toMatchObject({
                code: ChannelConnectionsErrorCode.PayosConfirmRefused,
            })
            connections.get.mockResolvedValue(record({ provider: "sepay" }))
            await expect(service.saveProviderKeys(actor, "c1", {})).rejects.toMatchObject({
                code: ConnectionsErrorCode.NotFound,
            })
            connections.get.mockResolvedValue(record({ provider: "telegram" }))
            await expect(service.saveProviderKeys(actor, "c1", {})).rejects.toMatchObject({
                code: ConnectionsErrorCode.NotFound,
            })
        })
    })

    describe("check", () => {
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
            setup.telegramWebhookInfo.mockResolvedValueOnce({
                url: "https://old.test",
                pendingUpdateCount: 0,
                lastErrorMessage: null,
            })
            setup.telegramWebhookInfo.mockResolvedValueOnce({
                url: "https://nivo.vn/hook/telegram/c1",
                pendingUpdateCount: 0,
                lastErrorMessage: "Connection timed out",
            })
            await expect(service.check(actor, "c1")).resolves.toMatchObject({ webhookOk: false, lastError: null })
            await expect(service.check(actor, "c1")).resolves.toMatchObject({
                webhookOk: true,
                lastError: "Connection timed out",
            })
            expect(connections.patch).toHaveBeenNthCalledWith(1, "ws-1", "c1", { status: "error", lastError: null })
            expect(connections.patch).toHaveBeenNthCalledWith(2, "ws-1", "c1", {
                status: "error",
                lastError: "Connection timed out",
            })
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

        it("marks the connection broken when the Zalo tokens are missing or expired", async () => {
            const { service, connections } = await build()

            connections.get.mockResolvedValue(record({ provider: "zalo_oa", status: "connected" }))
            connections.readSecret.mockResolvedValueOnce({ plain: zaloSecret(), webhookSecret: "h" })
            connections.readSecret.mockResolvedValueOnce({
                plain: zaloSecret({ refreshToken: "rt", refreshExpiresAt: "2026-01-01T00:00:00.000Z" }),
                webhookSecret: "h",
            })
            await expect(service.check(actor, "c1")).rejects.toMatchObject({
                code: ChannelConnectionsErrorCode.ZaloTokenRefused,
            })
            await expect(service.check(actor, "c1")).rejects.toMatchObject({
                code: ChannelConnectionsErrorCode.ZaloTokenRefused,
            })
            expect(connections.patch).toHaveBeenCalledWith("ws-1", "c1", {
                status: "error",
                lastError: ChannelConnectionsErrorCode.ZaloTokenRefused,
            })
        })

        it("refuses a Zalo connection whose sealed credential is missing or corrupt", async () => {
            const { service, connections } = await build()

            connections.get.mockResolvedValue(record({ provider: "zalo_oa" }))
            connections.readSecret.mockResolvedValueOnce(null)
            connections.readSecret.mockResolvedValueOnce({ plain: "garbage", webhookSecret: "h" })
            await expect(service.check(actor, "c1")).rejects.toMatchObject({ code: ConnectionsErrorCode.NotFound })
            await expect(service.check(actor, "c1")).rejects.toMatchObject({ code: ConnectionsErrorCode.NotFound })
            expect(connections.patch).not.toHaveBeenCalled()
        })
    })

    describe("release and firstEvent", () => {
        it("removes the Telegram webhook of a public site and ignores a failure", async () => {
            const { service, connections, setup } = await build()

            connections.readSecret.mockResolvedValue({ plain: TOKEN, webhookSecret: "h" })
            setup.telegramDeleteWebhook.mockRejectedValue(new Error("down"))
            await expect(service.release(record({ provider: "telegram" }))).resolves.toBeUndefined()
            expect(setup.telegramDeleteWebhook).toHaveBeenCalledWith(TOKEN)
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
})
