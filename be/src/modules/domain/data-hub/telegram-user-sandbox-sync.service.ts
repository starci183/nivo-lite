import { Injectable } from "@nestjs/common"
import { ProviderSandboxService } from "@modules/domain/provider-sandbox"
import type { DataConnector, DataSyncContext, DataSyncResult } from "./data-hub.contracts"
import { TELEGRAM_WIZARD_TEXT } from "./messages/telegram-user-wizard.messages"
import {
    TELEGRAM_USER_AS_OF,
    TELEGRAM_USER_CASE,
    TELEGRAM_USER_PER_CHAT_LIMIT,
    TELEGRAM_USER_PULL_OPERATION,
    TELEGRAM_USER_SANDBOX_CHATS,
    TELEGRAM_USER_SANDBOX_PROVIDER,
    telegramUserDateOf,
} from "./telegram-user-sandbox.catalogue"
import { telegramNotConfigured, telegramSessionRevoked, telegramUnreachable } from "./telegram-user-sandbox.failures"
import { cursorKey, mapMessage, readCursor } from "./telegram-user-config.policy"

/** The moment of the sandbox chats a case reads (TELEGRAM_USER-1 and the failing cases read the first one). */
const asOfOf = (nextCase: string | null): number => {
    if (nextCase === TELEGRAM_USER_CASE.newLines) return TELEGRAM_USER_AS_OF.newLines
    if (nextCase === TELEGRAM_USER_CASE.busyGroup) return TELEGRAM_USER_AS_OF.busyGroup
    return TELEGRAM_USER_AS_OF.first
}

@Injectable()
/**
 * The sandbox twin of the personal Telegram pull (`TELEGRAM_USER-1` .. `6`): the normal poll of a sandbox Telegram account hands the
 * sandbox chats' messages (three chats, a fixed history) to the SAME keep path the live pull uses (`context.upsert`, `message` rows made
 * by the live `mapMessage`) and never opens a Telegram session or reads a credential. It reads each chat's cursor from the connection's
 * public meta as the live pull does (`cursor:<chatId>`), brings the messages after it as of the moment the account's next case names (the
 * oldest first, at most the live per-chat limit; a chat that meets it says older lines are left) and moves the cursor to the newest.
 * `TELEGRAM_USER-1` (default) the first state, `-2` with new lines, `-3` the busy group (250 lines, two pulls), `-4` the revoked session,
 * `-5` no Telegram app credentials, `-6` Telegram not answering. A pull is a read: no outcome is unknown. One logged call per pull.
 */
export class TelegramUserSandboxSyncService implements DataConnector {
    /** The provider this connector serves. */
    readonly provider = "telegram_user" as const

    constructor(private readonly sandbox: ProviderSandboxService) {}

    /** Reads the new messages of every sandbox chat from its cursor and stores them as "message" rows. */
    sync(context: DataSyncContext): Promise<DataSyncResult> {
        const { connection } = context
        const account = {
            id: connection.id,
            workspaceId: connection.workspaceId,
            provider: TELEGRAM_USER_SANDBOX_PROVIDER,
            sandbox: connection.sandbox === true,
        }
        return this.sandbox.call(account, TELEGRAM_USER_PULL_OPERATION, { chats: TELEGRAM_USER_SANDBOX_CHATS.map((chat) => chat.id) }, {
            key: "",
            answer: async (state): Promise<DataSyncResult> => {
                if (state.nextCase === TELEGRAM_USER_CASE.sessionRevoked) throw telegramSessionRevoked()
                if (state.nextCase === TELEGRAM_USER_CASE.notConfigured) throw telegramNotConfigured()
                if (state.nextCase === TELEGRAM_USER_CASE.unreachable) throw telegramUnreachable()
                const asOf = asOfOf(state.nextCase)
                const meta: Record<string, string> = {}
                let rows = 0
                let capped = 0
                for (const chat of TELEGRAM_USER_SANDBOX_CHATS) {
                    if (context.isExpired()) break
                    const cursor = readCursor(connection.meta, chat.id)
                    const found = chat.messages
                        .filter((message) => message.id > cursor && message.asOf <= asOf)
                        .slice(0, TELEGRAM_USER_PER_CHAT_LIMIT)
                    const stored = found.filter((message) => message.text !== "" || message.hasMedia)
                    if (stored.length > 0) {
                        // One chat after the other, as the live pull stores them.
                        // eslint-disable-next-line no-await-in-loop
                        rows += await context.upsert(
                            "message",
                            stored.map((message) =>
                                mapMessage(chat, {
                                    id: message.id,
                                    date: telegramUserDateOf(message),
                                    text: message.text,
                                    senderName: message.senderName,
                                    replyToId: message.replyToId,
                                    hasMedia: message.hasMedia,
                                }),
                            ),
                        )
                    }
                    const maxId = found.at(-1)?.id ?? cursor
                    if (maxId > cursor) meta[cursorKey(chat.id)] = String(maxId)
                    if (found.length >= TELEGRAM_USER_PER_CHAT_LIMIT) capped += 1
                }
                return {
                    rows,
                    ...(capped > 0 ? { note: TELEGRAM_WIZARD_TEXT.olderLeft(capped) } : {}),
                    ...(Object.keys(meta).length > 0 ? { meta } : {}),
                }
            },
        })
    }
}
