import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { HTTP_CLIENT } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { ChannelSetupErrorCode } from "./errors/channel-setup.error"
import { ChannelSetupClient } from "./channel-setup.client"
import { CHANNEL_SETUP_OPTIONS } from "./channel-setup.decorators"
import type { ChannelSetupOptions } from "./channel-setup.options"

const OPTIONS: ChannelSetupOptions = { zaloOauthBase: undefined, siteUrl: "https://nivo.vn", timeoutMs: 3000 }

const build = async () => {
    const http = mock<HttpClient>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChannelSetupClient,
            { provide: HTTP_CLIENT, useValue: http },
            { provide: CHANNEL_SETUP_OPTIONS, useValue: OPTIONS },
        ],
    }).compile()
    return { client: moduleRef.get(ChannelSetupClient), http }
}

const answer = (body: unknown, status = 200) => ({ status, body })

describe("ChannelSetupClient", () => {
    describe("telegram", () => {
        it("reads the bot behind a token", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValue(answer({ ok: true, result: { id: 123456, username: "shop_bot" } }))

            await expect(client.telegramGetMe("tok")).resolves.toEqual({ id: "123456", username: "shop_bot" })
            expect(http.request).toHaveBeenCalledWith({
                method: "POST",
                url: "https://api.telegram.org/bottok/getMe",
                body: {},
                timeoutMs: 3000,
            })
        })

        it("tolerates a bot with no username and a result that is not an object", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValueOnce(answer({ ok: true, result: { id: 7 } }))
            http.request.mockResolvedValueOnce(answer({ ok: true, result: true }))

            await expect(client.telegramGetMe("t")).resolves.toEqual({ id: "7", username: "" })
            await expect(client.telegramDeleteWebhook("t")).resolves.toBeUndefined()
        })

        it("registers the webhook with its secret token for messages only", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValue(answer({ ok: true, result: true }))

            await client.telegramSetWebhook("tok", "https://nivo.vn/api/telegram/c-1", "sec")

            expect(http.request).toHaveBeenCalledWith(
                expect.objectContaining({
                    url: "https://api.telegram.org/bottok/setWebhook",
                    body: {
                        url: "https://nivo.vn/api/telegram/c-1",
                        secret_token: "sec",
                        allowed_updates: ["message"],
                    },
                }),
            )
        })

        it("reads the webhook info", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValueOnce(
                answer({ ok: true, result: { url: "https://x", pending_update_count: 3, last_error_message: "boom" } }),
            )
            http.request.mockResolvedValueOnce(answer({ ok: true, result: {} }))

            await expect(client.telegramWebhookInfo("t")).resolves.toEqual({
                url: "https://x",
                pendingUpdateCount: 3,
                lastErrorMessage: "boom",
            })
            await expect(client.telegramWebhookInfo("t")).resolves.toEqual({
                url: "",
                pendingUpdateCount: 0,
                lastErrorMessage: null,
            })
        })

        it("tells a rejected token from another refusal", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValueOnce(answer({ ok: false, description: "Unauthorized" }, 401))
            http.request.mockResolvedValueOnce(answer({ ok: false }, 404))
            http.request.mockResolvedValueOnce(answer({ ok: false, description: "Bot not found" }, 400))
            http.request.mockResolvedValueOnce(answer({ ok: false, description: "Bad Request: bad webhook" }, 400))
            http.request.mockResolvedValueOnce(answer("html", 502))

            await expect(client.telegramGetMe("t")).rejects.toMatchObject({
                code: ChannelSetupErrorCode.CredentialRejected,
            })
            await expect(client.telegramGetMe("t")).rejects.toMatchObject({
                code: ChannelSetupErrorCode.CredentialRejected,
            })
            await expect(client.telegramGetMe("t")).rejects.toMatchObject({
                code: ChannelSetupErrorCode.CredentialRejected,
            })
            await expect(client.telegramSetWebhook("t", "u", "s")).rejects.toMatchObject({
                code: ChannelSetupErrorCode.Refused,
                cause: expect.objectContaining({ message: "telegram setWebhook: Bad Request: bad webhook" }),
            })
            await expect(client.telegramGetMe("t")).rejects.toMatchObject({ code: ChannelSetupErrorCode.Refused })
        })

        it("reports an unreachable Telegram", async () => {
            const { client, http } = await build()
            http.request.mockRejectedValue(new Error("down"))

            await expect(client.telegramGetMe("t")).rejects.toMatchObject({ code: ChannelSetupErrorCode.Unreachable })
        })
    })

    describe("zalo addresses", () => {
        it("builds the callback and the authorization url from the site url", async () => {
            const { client } = await build()

            expect(client.zaloCallbackUrl()).toBe("https://nivo.vn/connections/zalo/callback")
            expect(client.zaloAuthorizeUrl("app-1", "verifier", "c.n")).toContain("app_id=app-1")
        })

        it("has neither without a site url", async () => {
            const moduleRef = await Test.createTestingModule({
                providers: [
                    ChannelSetupClient,
                    { provide: HTTP_CLIENT, useValue: mock<HttpClient>() },
                    { provide: CHANNEL_SETUP_OPTIONS, useValue: { ...OPTIONS, siteUrl: undefined } },
                ],
            }).compile()
            const client = moduleRef.get(ChannelSetupClient)

            expect(client.zaloCallbackUrl()).toBeNull()
            expect(client.zaloAuthorizeUrl("app-1", "verifier", "c.n")).toBeNull()
        })
    })

    describe("payosConfirmWebhook", () => {
        const credential = { clientId: "cid", apiKey: "key" }

        it("confirms the address with the channel keys", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValue(answer({ code: "00", desc: "success" }))

            await expect(
                client.payosConfirmWebhook(credential, "https://nivo.vn/api/connections/payos/c-1"),
            ).resolves.toBeUndefined()
            expect(http.request).toHaveBeenCalledWith({
                method: "POST",
                url: "https://api-merchant.payos.vn/confirm-webhook",
                headers: { "x-client-id": "cid", "x-api-key": "key" },
                body: { webhookUrl: "https://nivo.vn/api/connections/payos/c-1" },
                timeoutMs: 3000,
            })
        })

        it("refuses unless payOS answers 00", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValueOnce(answer({ code: "20", desc: "bad" }, 400))
            http.request.mockResolvedValueOnce(answer("nope", 500))

            await expect(client.payosConfirmWebhook(credential, "u")).rejects.toMatchObject({
                code: ChannelSetupErrorCode.Refused,
                cause: expect.objectContaining({ message: "payos 400 20 bad" }),
            })
            await expect(client.payosConfirmWebhook(credential, "u")).rejects.toMatchObject({
                code: ChannelSetupErrorCode.Refused,
            })
        })

        it("reports an unreachable payOS", async () => {
            const { client, http } = await build()
            http.request.mockRejectedValue(new Error("down"))

            await expect(client.payosConfirmWebhook(credential, "u")).rejects.toMatchObject({
                code: ChannelSetupErrorCode.Unreachable,
            })
        })
    })
})
