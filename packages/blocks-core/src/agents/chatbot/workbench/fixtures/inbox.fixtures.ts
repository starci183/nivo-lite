import type { DataSlot } from "@nivo-lite/agent-sdk/client"
import type { ThreadView } from "../../chatbot.types"
import type { ChatbotSettings } from "../../rules/settings"
import data from "./inbox.data.json"

/** One conversation as `blocks-core.chatbot.api.chat.list` yields it: the fields the list reads. */
export interface ThreadFixtureRecord {
    /** The id of the conversation. */
    readonly id: string
    /** The name of the customer; empty for a visitor the inbox does not know. */
    readonly name: string
    /** The key of the channel the customer writes from. */
    readonly channel: string
    /** Where the conversation stands: needs, handled or ai. */
    readonly status: string
    /** The person who holds the conversation; empty while the AI answers. */
    readonly handledBy: string
    /** The last words of the conversation. */
    readonly lastText: string
    /** Who said them: user or agent. */
    readonly lastRole: string
    /** When the conversation last moved, as ISO 8601. */
    readonly lastAt: string
}

/** The contact of an open conversation as `blocks-core.chatbot.api.chat.get` yields it; the status is the text of the record. */
export interface ContactFixtureRecord extends Omit<ThreadView, "status"> {
    /** Where the conversation stands, as the text of the record. */
    readonly status: string
}

/** The counts of the tabs of the inbox, as `blocks-core.chatbot.api.chat.status-counts` yields them. */
export interface ThreadCountsFixture {
    /** The conversations per tab. */
    readonly counts: Readonly<Record<string, number>>
    /** The conversations of the all tab. */
    readonly total: number
}

/** The four conversations of the inbox board: one waiting for a person, one the AI answers, one a person holds, one unnamed. */
export const THREAD_RECORDS: ReadonlyArray<ThreadFixtureRecord> = data.threads

/** The contact of the first conversation. */
export const THREAD_CONTACT: ContactFixtureRecord = data.contact

/** The settings the owner saved. */
export const SETTINGS: ChatbotSettings = data.settings

/** The counts of the tabs of the inbox board: all, needs a person, moved today. */
export const THREAD_COUNTS: ThreadCountsFixture = data.counts

/** The states of one read of the inbox: ready, loading, empty, error, and refused for the viewer. */
export interface InboxStates<T> {
    /** The read settled with data. */
    readonly ready: DataSlot<T>
    /** The first read is in flight. */
    readonly loading: DataSlot<T>
    /** The read settled with nothing to draw. */
    readonly empty: DataSlot<T>
    /** The read failed. */
    readonly error: DataSlot<T>
    /** The viewer may not see the read. */
    readonly forbidden: DataSlot<T>
}

/** The states of a read around its ready data. */
const statesOf = <T>(ready: T): InboxStates<T> => ({
    ready: { items: ready },
    loading: { isLoading: true },
    empty: { isEmpty: true },
    error: { isError: true },
    forbidden: { isForbidden: true },
})

/** Every state of the list of conversations. */
export const THREAD_LIST_FIXTURES: InboxStates<ReadonlyArray<ThreadFixtureRecord>> = statesOf(THREAD_RECORDS)

/** Every state of the contact of the open conversation. */
export const CONTACT_FIXTURES: InboxStates<ContactFixtureRecord> = statesOf(THREAD_CONTACT)

/** Every state of the rules form. */
export const RULES_FIXTURES: InboxStates<ChatbotSettings> = statesOf(SETTINGS)
