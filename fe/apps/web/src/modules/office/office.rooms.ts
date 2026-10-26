import type {
    OfficeChannelRowView,
    OfficePinRowView,
    OfficeResultCardView,
    OfficeRoomMembersView,
    OfficeRoomRowView,
} from "@/modules/types"
import type { ThreadEntry } from "./office.thread"
import type {
    OfficeAgent,
    OfficeApproval,
    OfficeCardCaptions,
    OfficeCardMediaPayload,
    OfficeCardPayload,
    OfficeMessage,
    OfficeRoom,
    OfficeViewer,
    OfficeWork,
} from "./office.types"
import { NO_CONVERSATION_STATE } from "./office.conversation-state"
import { roomStateOf } from "./office.chat-state"
import type { ChatMarkerWire } from "./office.chat-state"
import { officePreviewOf } from "./office.preview"
import { avatarOfAgentId, NIVO_AVATAR } from "./office.words"
import type { OfficeContext, OfficeWords } from "./office.words"

const CARD_TYPES: ReadonlyArray<OfficeCardPayload["type"]> = [
    "draft_post",
    "video_ready",
    "approval_request",
    "schedule_confirmed",
    "weekly_report",
    "daily_summary",
    "handoff_note",
    "exception",
    "action_done",
]
const CARD_STATES: ReadonlyArray<OfficeResultCardView["state"]> = [
    "pending",
    "approved",
    "declined",
    "done",
    "failed",
    "queued",
    "info",
]

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const textOr = (value: unknown, fallback: string | null): string | null =>
    typeof value === "string" ? value : fallback

const listOf = <T>(value: unknown, read: (item: Record<string, unknown>) => T | null): ReadonlyArray<T> =>
    Array.isArray(value)
        ? value.flatMap((item: unknown) => {
              const row = isObject(item) ? read(item) : null
              return row === null ? [] : [row]
          })
        : []

const parseJson = (text: string): unknown => {
    try {
        return JSON.parse(text)
    } catch {
        return null
    }
}

/** The captions of a card video, or null when it has none; an image never has any. */
const captionsOf = (kind: OfficeCardMediaPayload["kind"], value: unknown): OfficeCardCaptions | null =>
    kind === "video" && isObject(value) && typeof value.url === "string"
        ? { url: value.url, lang: textOr(value.lang, null) }
        : null

/** One image or video of a card; one without a link is dropped. */
const mediaOf = (row: Record<string, unknown>): OfficeCardMediaPayload | null => {
    if (typeof row.url !== "string") return null
    const kind = row.kind === "video" ? "video" : "image"
    return { kind, url: row.url, caption: textOr(row.caption, null), captions: captionsOf(kind, row.captions) }
}

/** The result card of a line (contract v1), read defensively; anything unreadable is no card. */
export const cardOf = (json: string | null | undefined): OfficeCardPayload | null => {
    if (json === null || json === undefined) return null
    const raw = parseJson(json)
    if (!isObject(raw)) return null
    const type = CARD_TYPES.find((candidate) => candidate === raw.type)
    const title = textOr(raw.title, null)
    if (type === undefined || title === null) return null
    const ref = isObject(raw.ref) && typeof raw.ref.id === "string" ? raw.ref : null
    const actions = Array.isArray(raw.actions) ? raw.actions : []
    const link = isObject(raw.link) ? raw.link : null
    return {
        type,
        title,
        subtitle: textOr(raw.subtitle, null),
        badge: textOr(raw.badge, null),
        body: textOr(raw.body, null),
        fields: listOf(raw.fields, (row) => ({
            label: textOr(row.label, "") ?? "",
            value: textOr(row.value, "") ?? "",
        })),
        media: listOf(raw.media, mediaOf),
        lines: listOf(raw.lines, (row) => ({ at: textOr(row.at, "") ?? "", text: textOr(row.text, "") ?? "" })),
        link:
            link !== null && typeof link.href === "string"
                ? { label: textOr(link.label, link.href) ?? link.href, href: link.href }
                : null,
        ref:
            ref === null
                ? null
                : { kind: ref.kind === "work_item" ? "work_item" : "execution", id: textOr(ref.id, "") ?? "" },
        sources: listOf(raw.sources, (row) =>
            typeof row.label === "string" && typeof row.layer === "number"
                ? { layer: row.layer, label: row.label }
                : null,
        ),
        canApprove: actions.includes("approve"),
        canDecline: actions.includes("decline"),
        canEdit: actions.includes("edit"),
    }
}

/** The wire room of the back end `officeRooms` query. */
interface RoomWire {
    readonly key?: string | null
    readonly name: string
    readonly unread: number
    readonly last_body?: string | null
    readonly last_author?: string | null
    readonly last_author_user_id?: string | null
    readonly last_at?: string | null
    readonly agent_ids: ReadonlyArray<string>
    readonly home_agent_ids: ReadonlyArray<string>
    readonly user_ids: ReadonlyArray<string>
    readonly members: OfficeRoomMembersView
    readonly pins: ReadonlyArray<{
        readonly id: string
        readonly title: string
        readonly href?: string | null
        readonly note: string
    }>
}

/** One back end room as the Hub uses it, with the caller's side of it (mute, read of my last line, who types) when known. */
export const toOfficeRoom = (row: RoomWire, marker?: ChatMarkerWire, isTyping = false): OfficeRoom => ({
    key: row.key ?? null,
    name: row.name,
    unread: row.unread,
    lastBody: row.last_body ?? null,
    lastAuthor: row.last_author ?? null,
    lastAuthorUserId: row.last_author_user_id ?? null,
    lastAt: row.last_at ?? null,
    lastKind: "text",
    state: roomStateOf(marker, isTyping),
    agentIds: row.agent_ids,
    homeAgentIds: row.home_agent_ids,
    userIds: row.user_ids,
    members: row.members,
    pins: row.pins.map((pin) => ({ id: pin.id, title: pin.title, href: pin.href ?? null, note: pin.note })),
})

/** The room a key names; null (or an unknown key) is the general Office room. */
export const roomOf = (rooms: ReadonlyArray<OfficeRoom>, key: string | null): OfficeRoom | null =>
    key === null ? null : (rooms.find((room) => room.key === key) ?? null)

/** The agents seated in a room; the Office room seats every agent. */
export const roomAgentsOf = (
    room: OfficeRoom | null,
    agents: ReadonlyArray<OfficeAgent>,
): ReadonlyArray<OfficeAgent> => (room === null ? agents : agents.filter((agent) => room.agentIds.includes(agent.id)))

/** The approvals a room shows: those drafted by its agents; the Office room shows every one. */
export const roomApprovalsOf = (
    room: OfficeRoom | null,
    approvals: ReadonlyArray<OfficeApproval>,
): ReadonlyArray<OfficeApproval> =>
    room === null ? approvals : approvals.filter((approval) => room.agentIds.includes(approval.agentId ?? ""))

/** The exceptions a room shows: those of the departments of its agents; the Office room shows every one. */
export const roomWorksOf = (
    room: OfficeRoom | null,
    works: ReadonlyArray<OfficeWork>,
    agents: ReadonlyArray<OfficeAgent>,
): ReadonlyArray<OfficeWork> => {
    if (room === null) return works
    const modules = new Set(roomAgentsOf(room, agents).map((agent) => agent.module))
    return works.filter((work) => modules.has(work.department))
}

/** The one-line preview of a room: its last line, or the invitation to write the first one. */
const roomPreviewOf = (room: OfficeRoom, words: OfficeWords, viewer: OfficeViewer): string => {
    if (room.lastBody === null) return words.t("groupPreviewEmpty")
    return officePreviewOf(
        { kind: room.lastKind, body: room.lastBody, author: room.lastAuthor, authorUserId: room.lastAuthorUserId },
        viewer,
        words,
    )
}

/** The rows of the room list: the Office room first, then the department rooms, with their one-line previews and unread state. */
export const roomRowsOf = (
    rooms: ReadonlyArray<OfficeRoom>,
    words: OfficeWords,
    timeOf: (iso: string) => string,
    viewer: OfficeViewer,
): ReadonlyArray<OfficeRoomRowView> =>
    (rooms.length === 0 ? [null] : rooms).map((room) => {
        const at = room?.lastAt ?? null
        return {
            id: room?.key ?? "office",
            label: room?.key == null ? words.t("title") : room.name,
            description: room === null ? words.t("groupPreviewEmpty") : roomPreviewOf(room, words, viewer),
            time: at === null ? null : timeOf(at),
            sortAt: at,
            unread: room?.unread ?? 0,
            state: room?.state ?? NO_CONVERSATION_STATE,
            members: room?.members ?? null,
        }
    })

/** The DOM id of a result card, for the jumps of the right panel. */
export const resultCardAnchor = (messageId: string): string => `office-card-${messageId}`

/** The words of a card state. */
const stateLabelOf = (state: OfficeResultCardView["state"], words: OfficeWords): string => words.t(`cardState_${state}`)

/** A result card line with its words, its live state and who may act on it. */
export const resultCardView = (
    entry: Extract<ThreadEntry, { kind: "card" }>,
    words: OfficeWords,
    context: OfficeContext,
): OfficeResultCardView => {
    const message: OfficeMessage = entry.message
    const card = entry.card
    const state = CARD_STATES.find((candidate) => candidate === message.cardState) ?? "info"
    const canAct = state === "pending" && card.ref !== null && context.canDecide(null)
    return {
        kind: "card",
        key: entry.key,
        id: message.id,
        anchor: resultCardAnchor(message.id),
        author: message.authorName,
        avatar: message.agentId === null ? NIVO_AVATAR : avatarOfAgentId(context, message.agentId, message.authorName),
        isAi: message.authorKind === "agent",
        time: words.time(message.createdAt),
        lead: message.body === card.title ? null : message.body,
        type: card.type,
        typeLabel: words.t(`cardType_${card.type}`),
        title: card.title,
        subtitle: card.subtitle,
        badge: card.badge ?? (state === "info" ? null : stateLabelOf(state, words)),
        state,
        body: card.body,
        fields: card.fields,
        media: card.media.map((media) => ({
            kind: media.kind,
            url: media.url,
            caption: media.caption,
            captions:
                media.captions === null
                    ? null
                    : {
                          src: media.captions.url,
                          label: words.t("cardCaptions"),
                          ...(media.captions.lang === null ? {} : { srcLang: media.captions.lang }),
                      },
        })),
        lines: card.lines,
        link: card.link,
        sources: card.sources.map((source) => {
            const layer = words.t(`sourceLayer_${source.layer}`)
            return { label: `${layer}: ${source.label}` }
        }),
        refKind: card.ref?.kind ?? null,
        refId: card.ref?.id ?? null,
        canApprove: canAct && card.canApprove,
        canDecline: canAct && card.canDecline,
        canEdit: canAct && card.canEdit && card.body !== null,
        isFocused: context.focusedId === message.id,
    }
}

/** The pending result cards of the shown lines, as jump rows of the right panel. */
export const pendingCardRowsOf = (messages: ReadonlyArray<OfficeMessage>, context: OfficeContext) =>
    messages
        .filter((message) => message.card !== null && message.cardState === "pending")
        .map((message) => ({
            id: message.id,
            title: message.card?.title ?? message.body,
            subtitle: message.authorName,
            avatar:
                message.agentId === null ? NIVO_AVATAR : avatarOfAgentId(context, message.agentId, message.authorName),
        }))

/** One channel connection as the right panel lists it. */
export interface OfficeChannelWire {
    readonly id: string
    readonly provider: string
    readonly name: string
    readonly status: string
    readonly agentIds: ReadonlyArray<string>
}

/** The channels of a room: those its agents answer on; the Office room lists every channel. */
export const roomChannelsOf = (
    room: OfficeRoom | null,
    channels: ReadonlyArray<OfficeChannelWire>,
    agents: ReadonlyArray<OfficeAgent>,
    words: OfficeWords,
): ReadonlyArray<OfficeChannelRowView> => {
    const shown =
        room === null
            ? channels
            : channels.filter((channel) => channel.agentIds.some((id) => room.agentIds.includes(id)))
    return shown.map((channel) => ({
        id: channel.id,
        name: channel.name === "" ? channel.provider : channel.name,
        detail: agents
            .filter((agent) => channel.agentIds.includes(agent.id))
            .map((agent) => agent.name)
            .join(" · "),
        isConnected: channel.status === "active" || channel.status === "connected",
        statusLabel: words.t(
            channel.status === "active" || channel.status === "connected" ? "channelConnected" : "channelAttention",
        ),
    }))
}

/** The pinned documents of a room. */
export const roomPinsOf = (room: OfficeRoom | null): ReadonlyArray<OfficePinRowView> =>
    room === null ? [] : room.pins.map((pin) => ({ id: pin.id, title: pin.title, note: pin.note, href: pin.href }))
