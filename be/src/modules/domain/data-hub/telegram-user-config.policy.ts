import type { TelegramChatKind, TelegramRawMessage } from "@modules/integrations/telegram-user"
import { isRecord } from "@modules/platform/primitives"
import type { DataRecordInput } from "./data-hub.contracts"
import { readJson } from "./telegram-user-json.policy"
import { TELEGRAM_WIZARD_TEXT } from "./messages/telegram-user-wizard.messages"
import type { PickedChat, SinceDays, TelegramConfig } from "./telegram-user-wizard.contracts"

/** The most chats one connection reads. */
export const MAX_CHATS = 50
/** The most messages read from one chat in one run. */
export const MAX_PER_CHAT_PER_RUN = 200
/** The schedules a Telegram connection may have (minutes; null is manual). */
export const SCHEDULE_CHOICES: ReadonlyArray<number | null> = [null, 15, 60]

const kindOf = (value: unknown): TelegramChatKind =>
    value === "user" || value === "channel" || value === "group" ? value : "group"

/** E.164 from what an owner types: "0912 345 678" and "84912345678" become +84912345678; null when it is not a phone number. */
export const normalizePhone = (raw: string): string | null => {
    let phone = raw.trim().replace(/[\s.\-()]/gu, "")
    if (!/^\+?\d+$/u.test(phone)) return null
    if (phone.startsWith("00")) phone = `+${phone.slice(2)}`
    else if (phone.startsWith("+")) phone = `+${phone.slice(1)}`
    else if (phone.startsWith("0")) phone = `+84${phone.slice(1)}`
    else if (phone.startsWith("84") && phone.length >= 11 && phone.length <= 12) phone = `+${phone}`
    else return null
    return /^\+[1-9]\d{7,14}$/u.test(phone) ? phone : null
}

/** Only the last three digits ever leave the server, and only as part of the account label. */
export const maskPhone = (phone: string): string => `…${phone.replace(/\D/gu, "").slice(-3)}`

/** The account label kept in the public facts. */
export const accountLabel = (name: string, username: string | null, phone: string): string =>
    `${name.trim() === "" ? "Telegram" : name.trim()}${username === null ? "" : ` (@${username})`} ${maskPhone(phone)}`

/** Cleans a list of picked chats: valid unique ids, bounded titles, at most MAX_CHATS. */
export const cleanChats = (value: unknown): ReadonlyArray<PickedChat> => {
    if (!Array.isArray(value)) return []
    const items: ReadonlyArray<unknown> = value
    const seen = new Set<string>()
    const chats: Array<PickedChat> = []
    for (const item of items) {
        if (!isRecord(item)) continue
        const id = typeof item.id === "string" ? item.id : ""
        if (!/^-?\d{1,20}$/u.test(id) || seen.has(id)) continue
        seen.add(id)
        const title = typeof item.title === "string" ? item.title.slice(0, 120) : id
        chats.push({ id, title, kind: kindOf(item.kind) })
        if (chats.length >= MAX_CHATS) break
    }
    return chats
}

/** The saved configuration (public meta `config`, one JSON string); null when absent or broken. */
export const parseConfig = (raw: string | null | undefined): TelegramConfig | null => {
    if (raw === null || raw === undefined || raw === "") return null
    const read = readJson(raw)
    if (!read.ok || !isRecord(read.value) || !Array.isArray(read.value.chats)) return null
    return { chats: cleanChats(read.value.chats), sinceDays: read.value.sinceDays === 30 ? 30 : 7 }
}

/** The configuration as it is stored. */
export const serializeConfig = (config: TelegramConfig): string =>
    JSON.stringify({
        chats: config.chats
            .slice(0, MAX_CHATS)
            .map((chat) => ({ id: chat.id, title: chat.title.slice(0, 120), kind: chat.kind })),
        sinceDays: config.sinceDays,
    })

/** The number of chats, in the owner's wording. */
export const summaryOf = (count: number): string => TELEGRAM_WIZARD_TEXT.summary(count)

/** The window of the first sync. */
export const toSinceDays = (days: number): SinceDays => (days === 30 ? 30 : 7)

/** The public meta key that holds the last stored message id of one chat. */
export const cursorKey = (chatId: string): string => `cursor:${chatId}`

/** The last stored message id of one chat (0 when none yet). */
export const readCursor = (meta: Readonly<Record<string, string>>, chatId: string): number => {
    const value = Number(meta[cursorKey(chatId)])
    return Number.isInteger(value) && value > 0 ? value : 0
}

/** Unix seconds of the first sync window. */
export const sinceUnix = (sinceDays: number, nowMs: number): number =>
    Math.floor((nowMs - sinceDays * 86_400_000) / 1000)

/** One Telegram message as a hub row. */
export const mapMessage = (chat: PickedChat, message: TelegramRawMessage): DataRecordInput => {
    const text = message.text.slice(0, 4000)
    return {
        externalId: `${chat.id}:${message.id}`,
        title: text.slice(0, 120) || (message.hasMedia ? TELEGRAM_WIZARD_TEXT.attachment : ""),
        occurredAt: new Date(message.date * 1000),
        data: {
            chatId: chat.id,
            chatTitle: chat.title,
            senderName: message.senderName,
            text,
            replyToId: message.replyToId,
            hasMedia: message.hasMedia,
        },
    }
}
