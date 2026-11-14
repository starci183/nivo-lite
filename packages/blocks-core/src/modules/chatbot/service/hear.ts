import type { LineFile } from "@nivo-lite/agent-sdk/customer-send"
import type { EntitiesApi } from "@nivo-lite/agent-sdk/entity/port"
import type { RunContext } from "@nivo-lite/agent-sdk/port"
import { CHATBOT_CHAT_ENTITY } from "../../../entities/chat/chatbot-entity-names"
import { factsOf, liveOfRoute, oneConversationQuery, plainFactsOf, type ConversationFacts } from "./chat-conversation.policy"
import { CustomerChatError } from "./chat-types"

/** The channel whose bot command opens a fresh visit. */
const TELEGRAM = "telegram"

/** Telegram's bot command that opens a fresh visit (https://core.telegram.org/bots/features#commands: a command starts with `/`). */
const TELEGRAM_START = "/start"

/** The channel a chat is opened on when the event names none (the entity's default). */
const NO_CHANNEL = "website"

/** The person a channel line is from, as the event's subject names them: the channel, the channel's own id of the person, the name it shows. */
export interface HeardSubject {
    /** The channel of the identity (`zalo`, `telegram`, `facebook`, `instagram`). */
    readonly channel: string
    /** The channel's own id of the person on the account. */
    readonly id: string
    /** The name the channel shows, when the event gives one. */
    readonly name?: string | null | undefined
}

/** One customer line as the event carries it: its key, its words, its time and its pictures, and who said it. */
export interface HeardLine {
    /** The channel's own id of the message (the engine keeps the line once under it). */
    readonly messageKey: string
    /** What the person said. */
    readonly text: string
    /** When the channel says the message was sent, ISO; empty: the time of the run. */
    readonly at?: string | null | undefined
    /** The pictures and files that came with the message. */
    readonly files?: ReadonlyArray<LineFile> | null | undefined
    /** The person on the channel (the event's subject); absent on an event without one. */
    readonly subject?: HeardSubject | null | undefined
}

/**
 * What the hear step is told: the generic members of the trigger scope (ROAD-API 3.1: the route, the contact, the account, the event's
 * subject) and the event's own line (its `data`), then the lines of the events queued on the run (`ctx.run.queue`), oldest first.
 */
export interface HearInput {
    /** The route the engine ensured for the person on the account: the chat is the route's live chat, opened by this step when there is none. */
    readonly routeId?: string | null | undefined
    /** The core contact the person is. */
    readonly contactId?: string | null | undefined
    /** The event's own line (absent on an event that carries none: the release door's `resume`). */
    readonly line?: HeardLine | null | undefined
    /** The lines of the events queued on the run, in the order they came. */
    readonly queued?: ReadonlyArray<HeardLine> | null | undefined
    /** `held` when a person released the conversation and the front desk wakes with no new words (the release door's event). */
    readonly resume?: string | null | undefined
    /**
     * On a resume: the words the person said after the shop's last line in the chat's window (`since` = its `startedAt`), one per line,
     * read from the engine's conversation by the node; absent: a resume answers nothing.
     */
    readonly unansweredSince?: ((since: string | null) => Promise<string>) | undefined
}

/** Where the run goes after the hear step. */
export type HearRoute =
    /** The person is to be answered: words, pictures, or a fresh visit (`/start`) with neither (the model greets, ruling R45). */
    | "go"
    /** There is nothing to answer: no words, no files, no fresh visit, nothing unanswered. */
    | "nothing"

/** What the hear step found and did. */
export interface Heard {
    /** The route the run takes. */
    readonly route: HearRoute
    /** The chatbot's own conversation, or null when the run ends before any (nothing could open one). */
    readonly conversationId: string | null
    /** The channel of the conversation (`zalo`, `telegram`...), empty when the run ends before any. */
    readonly channel: string
    /** What the person said: the words of the lines heard (after the last `/start`), or on a resume the unanswered lines, one per line. */
    readonly text: string
    /** Where the chat's window on the route's lines starts (ISO), or null: what the chatbot's nodes pass as `since` when they read. */
    readonly startedAt: string | null
    /** The lines this run heard (after the last `/start`), in order: their words and pictures, for the steps that read them. */
    readonly lines: ReadonlyArray<HeardLine>
    /** True when the run heard words but no chat holds the person and this step cannot open one (no route): the node reports it. */
    readonly unopened: boolean
}

const ended = (route: HearRoute, text: string): Heard => ({
    route,
    conversationId: null,
    channel: "",
    text,
    startedAt: null,
    lines: [],
    unopened: false,
})

/** True for an id that is present. */
const given = (value: string | null | undefined): value is string => value !== undefined && value !== null && value !== ""

/**
 * True for Telegram's `/start`: the channel's own bot command, the same test the Telegram intake made before the one pipeline
 * (`telegram-update.policy.ts`: the text, trimmed, starts with `/start`). Telegram only; a protocol command, not a reading of words.
 */
export const isTelegramStart = (line: HeardLine): boolean =>
    line.subject?.channel === TELEGRAM && line.text.trim().startsWith(TELEGRAM_START)

/** The live chat of the engine's route (the one no `/start` archived), or null. */
const liveChatOf = async (entities: EntitiesApi, routeId: string): Promise<ConversationFacts | null> => {
    const page = await entities.list(oneConversationQuery(liveOfRoute(routeId)))
    const [row] = page.rows
    return row === undefined ? null : factsOf(row)
}

/** The instant a line was said, never after the run's own instant; the run's instant for a line without one. */
const instantOf = (at: string | null | undefined, run: RunContext): string => {
    const said = given(at) ? Date.parse(at) : Number.NaN
    return Number.isNaN(said) || said > run.now.getTime() ? run.now.toISOString() : new Date(said).toISOString()
}

/** Where a line comes in: the route and the person on it, as the event names them. */
interface Entrance {
    readonly routeId: string
    readonly contactId: string | null | undefined
    readonly subject: HeardSubject | null | undefined
}

/**
 * Opens the route's chat with its window starting at `startedAt`. The chat names no agent: the record is the calling agent's by its row
 * stamp (coordinator ruling R1 / R12). A writer that opened the route's live chat first (`route_key`) is the answer.
 */
const opened = async (entities: EntitiesApi, at: Entrance, startedAt: string): Promise<ConversationFacts> => {
    const made = await entities.insert(CHATBOT_CHAT_ENTITY, {
        channel: at.subject?.channel ?? NO_CHANNEL,
        routeId: at.routeId,
        name: at.subject?.name ?? "",
        startedAt,
        ...(given(at.contactId) ? { contactId: at.contactId } : {}),
    })
    const facts = made.ok ? plainFactsOf(made.row) : made.reason === "taken" ? await liveChatOf(entities, at.routeId) : null
    if (facts === null) throw new CustomerChatError("CUSTOMER_CHAT_NOT_STORED", "open")
    return facts
}

/** The route's live chat, or a new one whose window starts at `startedAt`. */
const chatOf = async (entities: EntitiesApi, at: Entrance, startedAt: string): Promise<ConversationFacts> =>
    (await liveChatOf(entities, at.routeId)) ?? (await opened(entities, at, startedAt))

/** True for a line with words or files. */
const said = (line: HeardLine): boolean => line.text.trim() !== "" || (line.files ?? []).length > 0

/**
 * The chatbot's own marks on a person's line: the chat waits for an answer (`unanswered`), its activity stamp (`lastAt`, the inbox order)
 * moves to the line, and the contact it lacks is named (the engine met the person before any module). One write; best effort: a writer
 * that moved the record first keeps its values.
 */
const markHeard = async (entities: EntitiesApi, chat: ConversationFacts, at: Entrance, lastAt: string | null): Promise<void> => {
    const contact = given(at.contactId) && chat.data.contactId === null ? { contactId: at.contactId } : {}
    const heard = lastAt === null ? {} : { unanswered: true, lastAt }
    if (Object.keys(contact).length === 0 && Object.keys(heard).length === 0) return
    await entities.update(CHATBOT_CHAT_ENTITY, chat.id, chat.version, { ...contact, ...heard })
}

/** The lines the run hears, in order: the event's own, then the queued ones. */
const linesOf = (input: HearInput): ReadonlyArray<HeardLine> => [
    ...(input.line === undefined || input.line === null ? [] : [input.line]),
    ...(input.queued ?? []),
]

/**
 * The hear step of the front desk, over the chatbot's own records. It stores NO line: the engine kept every line the person said, once,
 * when the event was delivered (ruling R26). It walks the lines of the run in order (the event's own, then the queued ones): Telegram's
 * `/start` archives the route's live chat (`archivedAt`) and the next chat's window starts at the `/start` (a fresh visit: only what
 * follows is this run's to answer). Then it finds the route's live chat (else opens one) and marks it as waiting for an answer: a resume reads
 * the lines no reply followed; a run whose last line was a `/start` with no words after it goes on with no words (route `go`, text empty:
 * the model greets the person; no customer text is coded, ruling R45). A line with only pictures goes on with no words too. Who holds the thread is
 * NOT the chatbot's to read here: a staff hold is the engine's, on the route, and the engine's send door refuses every AI send to a held
 * route (`route_held`, ruling R43).
 */
export const hearOver = async (entities: EntitiesApi, run: RunContext, input: HearInput): Promise<Heard> => {
    const subject = input.line?.subject ?? input.queued?.find((one) => one.subject !== undefined && one.subject !== null)?.subject
    let startedAt: string | null = null
    let heard: Array<HeardLine> = []
    for (const line of linesOf(input)) {
        if (!isTelegramStart(line)) {
            heard.push(line)
            continue
        }
        // A fresh visit: the lines before it belong to the chat it archives; only what follows is this run's to answer.
        heard = []
        startedAt = instantOf(line.at, run)
        if (!given(input.routeId)) continue
        const live = await liveChatOf(entities, input.routeId)
        if (live !== null) await entities.update(CHATBOT_CHAT_ENTITY, live.id, live.version, { archivedAt: startedAt })
    }
    const hasWords = heard.some((one) => said(one))
    const text = heard.map((one) => one.text).join("\n")
    const fresh = startedAt !== null && !hasWords
    if (!given(input.routeId)) return { ...ended("nothing", text), lines: heard, unopened: hasWords || fresh }
    const at: Entrance = { routeId: input.routeId, contactId: input.contactId, subject }
    const first = heard.find((one) => said(one))
    const chat = await chatOf(entities, at, startedAt ?? instantOf(first?.at, run))
    const lastSaid = heard.findLast((one) => said(one))
    // A fresh visit waits for the shop's greeting from the `/start` on.
    await markHeard(entities, chat, at, lastSaid === undefined ? startedAt : instantOf(lastSaid.at, run))
    const base = { conversationId: chat.id, channel: chat.data.channel, startedAt: chat.data.startedAt, lines: heard, unopened: false }
    if (given(input.resume)) {
        const words = input.unansweredSince === undefined ? "" : await input.unansweredSince(chat.data.startedAt)
        return { ...base, route: words.trim() !== "" ? "go" : "nothing", text: words }
    }
    // A fresh visit with no words goes on with none: the model greets (R45).
    if (fresh) return { ...base, route: "go", text: "" }
    return { ...base, route: hasWords ? "go" : "nothing", text }
}
