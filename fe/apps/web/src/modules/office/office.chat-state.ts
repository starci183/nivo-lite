import type { OfficeConversationState } from "@/modules/types"
import { NO_CONVERSATION_STATE } from "./office.conversation-state"
import type { OfficeMessage, OfficeMessageReceipt } from "./office.types"

/** What the back end `chatMarkerState` query answers for one target. */
export interface ChatMarkerWire {
    readonly muted: boolean
    readonly lastOwnMessage?: {
        readonly id: string
        readonly status: "sent" | "delivered" | "seen"
        readonly seenByCount: number
        readonly seenBy: ReadonlyArray<{ readonly id: string; readonly name: string }>
    } | null
}

/** The target a chat receipt or state names: a department room by key, the Office room by none. */
export interface ChatRoomTarget {
    readonly room?: string
}

/** The chat target of a Hub room key (null is the Office room). */
export const chatTargetOf = (room: string | null): ChatRoomTarget => (room === null ? {} : { room })

/** The flags of a room row from what the back end knows of the caller's side: the mute, the read of my last line, who types. */
export const roomStateOf = (
    marker: ChatMarkerWire | undefined,
    isTyping: boolean,
    hasMention: boolean,
): OfficeConversationState => ({
    ...NO_CONVERSATION_STATE,
    hasMention,
    isMuted: marker?.muted ?? false,
    isLastSeen: marker?.lastOwnMessage?.status === "seen",
    isTyping,
})

/** The delivery receipt of my last attributed line, or none while the back end names no line of mine. */
export const receiptOf = (marker: ChatMarkerWire | undefined): { id: string; receipt: OfficeMessageReceipt } | null => {
    const last = marker?.lastOwnMessage
    if (last === undefined || last === null) return null
    return {
        id: last.id,
        receipt: {
            isDelivered: last.status !== "sent",
            seenBy: last.seenBy.map((reader) => ({ id: reader.id, name: reader.name })),
            seenCount: last.seenByCount,
        },
    }
}

/** The thread with the receipt on the one line it belongs to; every other line keeps none. */
export const withReceipt = (
    messages: ReadonlyArray<OfficeMessage>,
    marker: ChatMarkerWire | undefined,
): ReadonlyArray<OfficeMessage> => {
    const found = receiptOf(marker)
    if (found === null) return messages
    return messages.map((message) => (message.id === found.id ? { ...message, receipt: found.receipt } : message))
}

/** One person typing now and the instant (ms since the epoch) their signal lapses. */
export interface TypingSignal {
    readonly id: string
    readonly name: string
    readonly expiresAt: number
}

/** A typing broadcast: the signal and whether it starts or stops it. */
interface TypingBroadcast extends TypingSignal {
    readonly typing: boolean
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** The broadcast a typing payload carries, read defensively; anything else is no signal. */
export const typingSignalOf = (payload: unknown): TypingBroadcast | null => {
    if (!isRecord(payload)) return null
    const { id, name, typing, expiresAt } = payload
    if (typeof id !== "string" || typeof name !== "string" || typeof typing !== "boolean") return null
    const until = typeof expiresAt === "string" ? Date.parse(expiresAt) : Number.NaN
    return Number.isNaN(until) ? null : { id, name, typing, expiresAt: until }
}

/** The people typing after one broadcast: the sender is added or refreshed while they type, and removed when they stop. */
export const withTypingSignal = (
    current: ReadonlyArray<TypingSignal>,
    signal: TypingBroadcast,
): ReadonlyArray<TypingSignal> => {
    const others = current.filter((entry) => entry.id !== signal.id)
    return signal.typing ? [...others, { id: signal.id, name: signal.name, expiresAt: signal.expiresAt }] : others
}
