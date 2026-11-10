import { TEAM_CHAT_LINES_MAX, TEAM_CHAT_LINE_MAX, TEAM_CHAT_TEXT_MAX } from "@nivo-lite/blocks-core"
import type { TeamChatLine, TeamChatStanding } from "@nivo-lite/blocks-core"
import { parseJsonText } from "@modules/platform/primitives"
import type {
    ChatTurnLimit,
    HeardReply,
    PersonLineHeard,
    RoomAdmission,
    TurnParams,
    TurnTargets,
} from "./team-chat-turns.contracts"

/** The kinds of agent lines a person decides on: a reply to one is that decision's door (P1's stop door, BG4's card), never a chat turn. */
const DECISION_CARD_KINDS: ReadonlyArray<string> = ["workflow.stopped", "brain.change"]

/** The message kind of an approval card. */
const APPROVAL_KIND = "approval"

/** The default rate limit: twenty turns per room per ten minutes. */
export const DEFAULT_CHAT_TURN_LIMIT: ChatTurnLimit = { turns: 20, windowMs: 10 * 60 * 1000 }

/** The kind of a stored agent message (its JSON text), or null for a plain line or text that does not parse. */
export const agentMessageKindOf = (agentMessage: string | null): string | null => {
    if (agentMessage === null) return null
    const read = parseJsonText(agentMessage)
    if (!read.ok || typeof read.value !== "object" || read.value === null) return null
    const kind: unknown = Reflect.get(read.value, "kind")
    return typeof kind === "string" ? kind : null
}

/** True for a line a person decides on (a stop card, an approval card, a truth change card): a reply to it is that card's own door. */
export const isDecisionCard = (line: HeardReply): boolean =>
    line.kind === APPROVAL_KIND || DECISION_CARD_KINDS.includes(agentMessageKindOf(line.agentMessage) ?? "")

/** The agent of a direct room, read from its sorted pair (`"agent:<id>|user:<id>"`); null for a room of two people. */
export const agentOfDirectKey = (directKey: string | null): string | null => {
    if (directKey === null) return null
    const agent = directKey.split("|").find((part) => part.startsWith("agent:"))
    const id = agent?.slice("agent:".length) ?? ""
    return id === "" ? null : id
}

/**
 * Whom a person's message is for (THE COMMON-ROOM RULE, owner 2026-11-11). A private room with an agent: every message is for that
 * agent. A room of several people: each agent the message names, once, in the order written, then the agent whose line it replies to.
 * Nobody: a message that names nobody and replies to no agent, an empty message, and any reply to a card a person decides on (a stop,
 * an approval, a truth change: those cards have their own door). Pure: it reads only what the team chat already holds.
 */
export const turnTargetsOf = (line: PersonLineHeard): TurnTargets => {
    const none: TurnTargets = { agentIds: [], room: line.room.kind === "direct" ? "direct" : "common" }
    if (line.message.body.trim() === "") return none
    if (line.repliedTo !== null && isDecisionCard(line.repliedTo)) return none
    if (line.room.kind === "direct") {
        const agent = agentOfDirectKey(line.room.directKey)
        return agent === null ? none : { agentIds: [agent], room: "direct" }
    }
    const repliedAgent =
        line.repliedTo?.authorKind === "agent" && line.repliedTo.authorId !== null ? [line.repliedTo.authorId] : []
    return { agentIds: [...new Set([...line.agentMentions, ...repliedAgent])], room: "common" }
}

/** The standing of a workspace role: owner and manager govern, everyone else is staff. */
export const standingOf = (role: string): TeamChatStanding => (role === "owner" || role === "manager" ? role : "staff")

/** True for a standing that may file a truth change by hand ("Ghi vào Second Brain"). */
export const mayCapture = (standing: TeamChatStanding): boolean => standing === "owner" || standing === "manager"

/** One stored room line as a chat turn is shown it: who wrote it (a name), the words cut to a line. */
export interface StoredLine {
    readonly id: string
    readonly authorKind: string
    readonly authorId: string | null
    readonly body: string
    readonly createdAt: Date
}

/** A stored line as the turn reads it, named by the given names (an unnamed author keeps an empty name). */
export const turnLineOf = (line: StoredLine, names: ReadonlyMap<string, string>): TeamChatLine => ({
    id: line.id,
    by: line.authorKind === "user" ? "person" : line.authorKind === "agent" ? "agent" : "system",
    name: line.authorId === null ? "" : (names.get(line.authorId) ?? ""),
    text: line.body.trim().slice(0, TEAM_CHAT_LINE_MAX),
    at: line.createdAt.toISOString(),
})

/**
 * The room lines a turn is shown: the latest before the asked message (never the message itself, which is `text`), oldest first,
 * bounded to `TEAM_CHAT_LINES_MAX`; empty lines are left out.
 */
export const turnLinesOf = (
    lines: ReadonlyArray<StoredLine>,
    askedId: string,
    names: ReadonlyMap<string, string>,
): ReadonlyArray<TeamChatLine> =>
    lines
        .filter((line) => line.id !== askedId && line.body.trim() !== "")
        .toSorted((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
        .slice(-TEAM_CHAT_LINES_MAX)
        .map((line) => turnLineOf(line, names))

/** The asked words as the turn reads them. */
export const askedTextOf = (body: string): string => body.trim().slice(0, TEAM_CHAT_TEXT_MAX)

/** The event key of one chat turn: one per message and agent, so a retried send or a replayed listener wakes the agent once. */
export const turnKeyOf = (messageId: string, agentId: string): string => `chat-turn:${messageId}:${agentId}`

/** The event key of a capture ("Ghi vào Second Brain"): once per message and agent. */
export const captureKeyOf = (messageId: string, agentId: string): string => `chat-capture:${messageId}:${agentId}`

/** The workflow namespace of a module's chat turn, as the thread flag names it. */
export const chatTurnNamespaceOf = (moduleKey: string, workflowKey: string): string => `${moduleKey}.${workflowKey}`

/**
 * One more turn in a room, against the starts of the window (newest last): run while under the limit; the first refusal of a window
 * says once that the agent pauses; every later one stays quiet until the window frees a place.
 */
export const roomAdmissionOf = (
    starts: ReadonlyArray<number>,
    noticed: boolean,
    now: number,
    limit: ChatTurnLimit,
): RoomAdmission => {
    const inWindow = starts.filter((at) => at > now - limit.windowMs)
    if (inWindow.length < limit.turns) return "run"
    return noticed ? "quiet" : "pause_notice"
}

/** The most characters of a turn's params as JSON: under what a tag wake keeps (8000), with room for the pin. */
export const TURN_PARAMS_MAX = 7400

/**
 * The params cut to what a wake keeps: the oldest room lines go first, then the line replied to is shortened, then the asked words; the
 * asked words are never dropped.
 */
export const fittedParamsOf = (params: TurnParams, max: number = TURN_PARAMS_MAX): TurnParams => {
    const size = (one: TurnParams): number => JSON.stringify(one).length
    let fitted = params
    while (size(fitted) > max && fitted.lines.length > 0) fitted = { ...fitted, lines: fitted.lines.slice(1) }
    if (size(fitted) > max && fitted.replyTo !== null)
        fitted = { ...fitted, replyTo: { ...fitted.replyTo, text: fitted.replyTo.text.slice(0, 80) } }
    const over = size(fitted) - max
    return over > 0 ? { ...fitted, text: fitted.text.slice(0, Math.max(1, fitted.text.length - over)) } : fitted
}

/** The one line an agent says when its room reached the limit of turns, in the team's language. */
export const pauseLineOf = (locale: "vi" | "en"): { readonly title: string; readonly text: string } =>
    locale === "en"
        ? {
              title: "Pausing for a moment",
              text: "Many questions in this room in a short time: I pause for a few minutes, then I answer again.",
          }
        : {
              title: "Em tạm dừng một lúc",
              text: "Phòng này vừa hỏi em nhiều quá: em tạm dừng vài phút rồi trả lời tiếp nhé.",
          }

/**
 * The reason a hand-filed truth change carries ("Ghi vào Second Brain" with the truth named on the form): who pressed it, on their own
 * message or a message of the room; never a copy of the value.
 */
export const captureReasonOf = (name: string, value: string | null): string =>
    value === null
        ? `${name} bấm "Ghi vào Second Brain" trên tin nhắn này để bỏ sự thật đang dùng; chờ chủ tiệm đồng ý.`
        : `${name} bấm "Ghi vào Second Brain" trên tin nhắn này để ghi thành quy định của tiệm, thay cho giá trị đang dùng (nếu có); không nói thời hạn thì giữ một năm.`
