import { invalid, readSeedDocuments, textOf } from "./management-seed.policy"
import {
    CHAT_SEED_SCHEMA,
    type ChatSeedDay,
    type ChatSeedMessage,
    type ChatSeedRoom,
    type ChatSeedRoomPurpose,
    type ChatSeedWho,
} from "./chat-seed.contracts"
import { addDays, localDate, zonedMs } from "@modules/domain/workspace-settings"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u
const KEY = /^[a-z0-9][a-z0-9-]{0,39}$/u
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/u
const NAME_MAX = 80
const BODY_MAX = 2000

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value)

const whoOf = (raw: unknown, field: string): ChatSeedWho => {
    if (!isRecord(raw)) return invalid(field)
    if (raw.role === "owner" || raw.role === "staff") return { role: raw.role }
    if (typeof raw.agent !== "string" || !KEY.test(raw.agent)) return invalid(field)
    if (raw.mayPost === undefined) return { agent: raw.agent }
    return typeof raw.mayPost === "boolean" ? { agent: raw.agent, mayPost: raw.mayPost } : invalid(field)
}

const messageOf = (raw: unknown): ChatSeedMessage => {
    if (!isRecord(raw)) return invalid("message")
    const key = textOf(raw.key, "message.key")
    const body = textOf(raw.body, "message.body")
    const { day, time, agentMessage } = raw
    if (!KEY.test(key) || body.length > BODY_MAX) return invalid("message.key")
    if (day !== "today" && day !== "yesterday") return invalid("message.day")
    if (typeof time !== "string" || !TIME.test(time)) return invalid("message.time")
    if (agentMessage !== undefined && !isRecord(agentMessage)) return invalid("message.agentMessage")
    return {
        key,
        from: whoOf(raw.from, "message.from"),
        day,
        time,
        body,
        ...(agentMessage === undefined ? {} : { agentMessage }),
    }
}

/** The purpose of a room and its module: `group` when absent; a module room names a module key, no other purpose does. */
const purposeOf = (raw: Record<string, unknown>): ChatSeedRoomPurpose => {
    const { purpose, module } = raw
    if (purpose === "module")
        return typeof module === "string" && KEY.test(module) ? { purpose, module } : invalid("room.module")
    if (module !== undefined) return invalid("room.module")
    if (purpose === undefined) return { purpose: "group", module: null }
    return purpose === "group" || purpose === "common" ? { purpose, module: null } : invalid("room.purpose")
}

const roomOf = (raw: unknown): ChatSeedRoom => {
    if (!isRecord(raw)) return invalid("room")
    const id = textOf(raw.id, "room.id")
    const name = textOf(raw.name, "room.name")
    if (!UUID.test(id) || name.length > NAME_MAX) return invalid("room.id")
    if (!Array.isArray(raw.members) || raw.members.length === 0) return invalid("room.members")
    if (!Array.isArray(raw.messages) || raw.messages.length === 0) return invalid("room.messages")
    const messages = raw.messages.map((item) => messageOf(item))
    if (new Set(messages.map((message) => message.key)).size !== messages.length) return invalid("message.key")
    const members = raw.members.map((member) => whoOf(member, "room.members"))
    return { id, name, ...purposeOf(raw), members, messages }
}

/** The rooms of the chat seed documents of the stack seed envelope: a room id given twice is refused, by the field's name. */
export const readChatSeedRooms = (text: string): ReadonlyArray<ChatSeedRoom> => {
    const rooms = readSeedDocuments(text).flatMap((document) => {
        if (!isRecord(document) || document.schema !== CHAT_SEED_SCHEMA) return invalid("schema")
        return Array.isArray(document.rooms) && document.rooms.length > 0
            ? document.rooms.map((item) => roomOf(item))
            : invalid("rooms")
    })
    return new Set(rooms.map((room) => room.id)).size === rooms.length ? rooms : invalid("room.id")
}

/**
 * The instants of the lines of one room, in the order given: each is its day and time in the shop's time zone, and a line that would
 * fall after `now` is moved back to just before it, a minute apart, so the thread keeps its order and nothing is said in the future.
 */
export const instantsOf = (
    messages: ReadonlyArray<ChatSeedMessage>,
    now: Date,
    timeZone: string,
): ReadonlyArray<Date> => {
    const today = localDate(now.getTime(), timeZone)
    return messages.map((message, index) => {
        const day: ChatSeedDay = message.day
        const wanted = zonedMs(day === "yesterday" ? addDays(today, -1) : today, message.time, timeZone)
        const latest = now.getTime() - (messages.length - index) * 60_000
        return new Date(Math.min(wanted, latest))
    })
}
