import {
    TEAM_CHAT_LINES_MAX,
    TEAM_CHAT_LINE_MAX,
    TEAM_CHAT_TEXT_MAX,
    type TeamChatLine,
    type TeamChatStanding,
} from "@nivo-lite/agent-sdk/team-chat"
import type { HeardReply, PersonLineHeard } from "@modules/domain/team-chat"
import { parseJsonText } from "@modules/platform/primitives"
import {
    PAUSE_LINES,
    UNHANDLED_LINES,
    captureFileReason,
    captureRetireReason,
} from "./messages/team-chat-turns.messages"
import type {
    ChatTurnLimit,
    PauseLine,
    RoomAdmission,
    TurnParams,
    TurnTargets,
    UnroutedTurn,
} from "./team-chat-turns.contracts"

/** The kinds of agent lines a person decides on: a reply to one is that decision's door (P1's stop door, BG4's card), never a chat turn. */
const DECISION_CARD_KINDS: ReadonlySet<string> = new Set(["workflow.stopped", "brain.change"])

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
    line.kind === APPROVAL_KIND || DECISION_CARD_KINDS.has(agentMessageKindOf(line.agentMessage) ?? "")

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

/** True for a standing that may file a truth change by hand ("Save to Second Brain"). */
export const mayCapture = (standing: TeamChatStanding): boolean => standing === "owner" || standing === "manager"

/** One stored room line as a chat turn is shown it: who wrote it (a name), the words cut to a line. */
export interface StoredLine {
    /** The message. */
    readonly id: string
    /** `user`, `agent` or `system`. */
    readonly authorKind: string
    /** The account or the agent; null for a system line. */
    readonly authorId: string | null
    /** Its words. */
    readonly body: string
    /** When it was written. */
    readonly createdAt: Date
}

/** Who wrote a stored line, as a chat turn names it. */
const lineByOf = (authorKind: string): TeamChatLine["by"] => {
    if (authorKind === "user") return "person"
    return authorKind === "agent" ? "agent" : "system"
}

/** A stored line as the turn reads it, named by the given names (an unnamed author keeps an empty name). */
export const turnLineOf = (line: StoredLine, names: ReadonlyMap<string, string>): TeamChatLine => ({
    id: line.id,
    by: lineByOf(line.authorKind),
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

/** The event key of a capture ("Save to Second Brain"): once per message and agent. */
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
export const pauseLineOf = (locale: "vi" | "en"): PauseLine => ({ ...PAUSE_LINES[locale] })

/**
 * The reason a hand-filed truth change carries ("Save to Second Brain" with the truth named on the form): who pressed it, on their own
 * message or a message of the room; never a copy of the value.
 */
export const captureReasonOf = (name: string, value: string | null): string =>
    value === null ? captureRetireReason(name) : captureFileReason(name)

/** The key of the one line NIVO writes under a message whose named agents started no chat turn. */
export const unhandledKeyOf = (messageId: string): string => `chat-unhandled:${messageId}`

/** The agents a message names that the router starts no turn for at all (they are none of its targets), each once. */
export const outsideTurnsOf = (
    mentions: ReadonlyArray<string>,
    targets: ReadonlyArray<string>,
): ReadonlyArray<UnroutedTurn> =>
    [...new Set(mentions)]
        .filter((agentId) => !targets.includes(agentId))
        .map((agentId): UnroutedTurn => ({ agentId, code: "outside_turn" }))

/** The words of the line NIVO writes for the turns that did not start, in the team's language. */
export const unhandledLineOf = (locale: "vi" | "en"): PauseLine => ({ ...UNHANDLED_LINES[locale] })

/**
 * The structured message of that line, as stored JSON text: a notice with the agents and the code of each turn that did not start
 * (ids and codes; the words are the line's own).
 */
export const unhandledMessageOf = (line: PauseLine, turns: ReadonlyArray<UnroutedTurn>): string =>
    JSON.stringify({
        kind: "message.text",
        intent: "notify",
        title: line.title,
        summary: line.text,
        payload: { text: line.text, unrouted: turns.map((turn) => ({ agentId: turn.agentId, code: turn.code })) },
    })
