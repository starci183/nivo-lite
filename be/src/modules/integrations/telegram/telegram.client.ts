import { Injectable } from "@nestjs/common"
import { InjectHttpClient } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { isRecord } from "@modules/platform/primitives"
import { TelegramError, TelegramErrorCode } from "./errors/telegram.error"
import type { TelegramParams } from "./telegram.contracts"
import { InjectTelegramOptions } from "./telegram.decorators"
import type { TelegramOptions } from "./telegram.options"

@Injectable()
/** The one place that talks to api.telegram.org. The token is always explicit (the bot of one connection) and never logged. */
export class TelegramClient {
    constructor(
        @InjectHttpClient() private readonly http: HttpClient,
        @InjectTelegramOptions() private readonly options: TelegramOptions,
    ) {}

    /** Calls one Bot API method with the bot token and returns its `result`; a refusal or a network failure is a TelegramError. */
    async call(token: string, method: string, body: TelegramParams = {}): Promise<unknown> {
        const answer = await this.http
            .request({
                method: "POST",
                url: `${this.options.apiBase}/bot${token}/${method}`,
                body,
                timeoutMs: this.options.timeoutMs,
            })
            .catch((cause: unknown) => {
                throw new TelegramError({ code: TelegramErrorCode.Unavailable, cause })
            })
        if (!isRecord(answer.body) || answer.body.ok !== true) {
            const description = isRecord(answer.body) ? answer.body.description : undefined
            throw new TelegramError({
                code: TelegramErrorCode.Rejected,
                params: { method, reason: typeof description === "string" ? description : String(answer.status) },
            })
        }
        return answer.body.result
    }

    /** Sends a text message to a chat. */
    async sendMessage(token: string, chatId: string, text: string): Promise<void> {
        await this.call(token, "sendMessage", { chat_id: chatId, text })
    }

    /** Shows "typing" in a chat; best effort, so a failure here never stops the reply. Resolves true when Telegram accepted it. */
    sendTyping(token: string, chatId: string): Promise<boolean> {
        return this.call(token, "sendChatAction", { chat_id: chatId, action: "typing" }).then(
            () => true,
            () => false,
        )
    }
}
