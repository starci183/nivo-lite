import { Injectable } from "@nestjs/common"
import { DataSourcesError, DataSourcesErrorCode } from "@modules/integrations/data-sources"
import { InjectTelegramUser, TELEGRAM_REVOKED_MESSAGE } from "@modules/integrations/telegram-user"
import type { TelegramUserClient } from "@modules/integrations/telegram-user"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { eachInOrder } from "@modules/platform/primitives"
import type { DataConnector, DataSyncContext, DataSyncResult } from "./data-hub.contracts"
import {
    MAX_PER_CHAT_PER_RUN,
    cursorKey,
    mapMessage,
    parseConfig,
    readCursor,
    sinceUnix,
} from "./telegram-user-config.policy"
import { parseCredential } from "./telegram-user-credential.policy"
import { TELEGRAM_WIZARD_TEXT } from "./messages/telegram-user-wizard.messages"

@Injectable()
/** Pulls the picked chats of the personal Telegram accounts into the hub (read only). */
export class TelegramUserSyncService implements DataConnector {
    /** The provider this connector serves. */
    readonly provider = "telegram_user" as const

    constructor(
        @InjectTelegramUser() private readonly telegram: TelegramUserClient,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Reads the new messages of every picked chat from its cursor and stores them as "message" rows. */
    async sync(context: DataSyncContext): Promise<DataSyncResult> {
        const credential = parseCredential(context.credential)
        if (credential.session === undefined) {
            throw new DataSourcesError({
                code: DataSourcesErrorCode.Rejected,
                params: { detail: TELEGRAM_REVOKED_MESSAGE },
            })
        }
        const config = parseConfig(context.connection.meta.config)
        if (config === null || config.chats.length === 0) return { rows: 0, note: TELEGRAM_WIZARD_TEXT.noChatsPicked }
        const chats = new Map(config.chats.map((chat) => [chat.id, chat]))
        const cursors = new Map(config.chats.map((chat) => [chat.id, readCursor(context.connection.meta, chat.id)]))
        const reads = await this.telegram.readChats({
            session: credential.session,
            chatIds: config.chats.map((chat) => chat.id),
            cursors,
            sinceUnix: sinceUnix(config.sinceDays, this.clock.now().getTime()),
            perChatLimit: MAX_PER_CHAT_PER_RUN,
            isExpired: context.isExpired,
        })
        const meta: Record<string, string> = {}
        let rows = 0
        let capped = 0
        await eachInOrder(reads, async (read) => {
            const chat = chats.get(read.chatId)
            if (chat === undefined) return
            if (read.messages.length > 0) {
                rows += await context.upsert(
                    "message",
                    read.messages.map((message) => mapMessage(chat, message)),
                )
            }
            if (read.maxId > (cursors.get(read.chatId) ?? 0)) meta[cursorKey(read.chatId)] = String(read.maxId)
            if (read.capped) capped += 1
        })
        return {
            rows,
            ...(capped > 0 ? { note: TELEGRAM_WIZARD_TEXT.olderLeft(capped) } : {}),
            ...(Object.keys(meta).length > 0 ? { meta } : {}),
        }
    }
}
