import { Injectable } from "@nestjs/common"
import { InjectHttpClient } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { ChannelSetupError, ChannelSetupErrorCode } from "./errors/channel-setup.error"
import { InjectChannelSetupOptions } from "./channel-setup.decorators"
import type { PayosCredential, TelegramBot, TelegramWebhookInfo } from "./channel-setup.contracts"
import type { ChannelSetupOptions } from "./channel-setup.options"

type Json = Readonly<Record<string, unknown>>

const isJson = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value)

const textOf = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined)

const PAYOS_CONFIRM_WEBHOOK = "https://api-merchant.payos.vn/confirm-webhook"
const REJECTED_DESCRIPTION = /unauthorized|not found/iu

@Injectable()
/** The provider calls a connection wizard makes while connecting a channel: Telegram Bot API and the payOS webhook confirmation. */
export class ChannelSetupClient {
    constructor(
        @InjectHttpClient() private readonly http: HttpClient,
        @InjectChannelSetupOptions() private readonly options: ChannelSetupOptions,
    ) {}

    /** The bot a token belongs to; rejects with CredentialRejected when Telegram does not know the token. */
    async telegramGetMe(token: string): Promise<TelegramBot> {
        const me = await this.telegram(token, "getMe", {})
        return { id: String(me.id), username: textOf(me.username) ?? "" }
    }

    /** Points the bot's webhook at `url` and asks Telegram to echo `secretToken` on every delivery (messages only). */
    async telegramSetWebhook(token: string, url: string, secretToken: string): Promise<void> {
        await this.telegram(token, "setWebhook", { url, secret_token: secretToken, allowed_updates: ["message"] })
    }

    /** Removes the bot's webhook. */
    async telegramDeleteWebhook(token: string): Promise<void> {
        await this.telegram(token, "deleteWebhook", {})
    }

    /** What Telegram knows about the bot's webhook. */
    async telegramWebhookInfo(token: string): Promise<TelegramWebhookInfo> {
        const info = await this.telegram(token, "getWebhookInfo", {})
        return {
            url: textOf(info.url) ?? "",
            pendingUpdateCount: typeof info.pending_update_count === "number" ? info.pending_update_count : 0,
            lastErrorMessage: textOf(info.last_error_message) ?? null,
        }
    }

    /** Asks payOS to confirm the webhook address with the channel's Client ID and API Key; rejects unless payOS answers code 00. */
    async payosConfirmWebhook(credential: PayosCredential, webhookUrl: string): Promise<void> {
        const response = await this.send({
            method: "POST",
            url: PAYOS_CONFIRM_WEBHOOK,
            headers: { "x-client-id": credential.clientId, "x-api-key": credential.apiKey },
            body: { webhookUrl },
        })
        const body = isJson(response.body) ? response.body : {}
        if (body.code !== "00") {
            throw new ChannelSetupError({
                code: ChannelSetupErrorCode.Refused,
                cause: new Error(
                    `payos ${response.status} ${textOf(body.code) ?? ""} ${textOf(body.desc) ?? ""}`.trim(),
                ),
            })
        }
    }

    /** One Telegram Bot API call. The token is part of the url and is never logged. */
    private async telegram(token: string, method: string, body: Record<string, unknown>): Promise<Json> {
        const response = await this.send({
            method: "POST",
            url: `https://api.telegram.org/bot${token}/${method}`,
            body,
        })
        const out = isJson(response.body) ? response.body : {}
        if (out.ok === true) return isJson(out.result) ? out.result : {}
        const description = textOf(out.description) ?? String(response.status)
        const rejected = response.status === 401 || response.status === 404 || REJECTED_DESCRIPTION.test(description)
        throw new ChannelSetupError({
            code: rejected ? ChannelSetupErrorCode.CredentialRejected : ChannelSetupErrorCode.Refused,
            cause: new Error(`telegram ${method}: ${description}`),
        })
    }

    private async send(request: Omit<Parameters<HttpClient["request"]>[0], "timeoutMs">) {
        try {
            return await this.http.request({ ...request, timeoutMs: this.options.timeoutMs })
        } catch (cause) {
            throw new ChannelSetupError({ code: ChannelSetupErrorCode.Unreachable, cause })
        }
    }
}
