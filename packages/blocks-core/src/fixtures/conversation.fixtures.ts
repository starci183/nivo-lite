import type { DataSlot } from "@nivo-lite/agent-sdk/client"
import type { MessagePaths, PendingSend } from "../rows/conversation.types"

/** One message record as a thread read yields it. */
export interface ConversationRecord {
    /** The key of the message. */
    readonly id: string
    /** The words of the message. */
    readonly text: string
    /** The name of the author; empty for a line the system adds. */
    readonly who: string
    /** The moment it was written, as an ISO 8601 text. */
    readonly at: string
    /** Whose message it is. */
    readonly side: "incoming" | "outgoing" | "notice"
    /** How far a message of the viewer has travelled; empty for the rest. */
    readonly state: string
    /** The short marker beside the author; empty draws none. */
    readonly mark: string
}

/** The paths a spec names for the records of these fixtures. */
export const CONVERSATION_PATHS: MessagePaths = {
    idPath: "id",
    textPath: "text",
    authorPath: "who",
    timePath: "at",
    statusPath: "state",
    sidePath: "side",
    markPath: "mark",
}

/** Everything the conversation block draws from, for one state of a thread. */
export interface ConversationFixture {
    /** The status of the messages read. */
    readonly slot: DataSlot<ReadonlyArray<ConversationRecord>>
    /** The messages the viewer sent that the thread has not confirmed. */
    readonly pending: ReadonlyArray<PendingSend>
    /** The words in the composer. */
    readonly draft: string
    /** Whether the viewer may send a message. */
    readonly canSend: boolean
    /** Whether the viewer may hand the thread to a person. */
    readonly canHandoff: boolean
    /** Whether the viewer may close the thread. */
    readonly canClose: boolean
}

const CUSTOMER = "Minh Anh Nguyen"
const AGENT = "Nivo assistant"
const STAFF = "Thu Ha Le"

const GREETING: ConversationRecord = {
    id: "m1",
    text: "Hi, I would like to order 2 flower pots like last time.",
    who: CUSTOMER,
    at: "2026-11-03T14:02:00.000Z",
    side: "incoming",
    state: "",
    mark: "",
}
const ANSWER: ConversationRecord = {
    id: "m2",
    text: "Hello Minh Anh, we have 5 pots left. Should we deliver to the same address, 69 Hang Xanh?",
    who: AGENT,
    at: "2026-11-03T14:02:40.000Z",
    side: "outgoing",
    state: "sent",
    mark: "AI",
}
const FOLLOW_UP: ConversationRecord = {
    id: "m3",
    text: "Yes, can you deliver tomorrow morning?",
    who: CUSTOMER,
    at: "2026-11-04T01:06:00.000Z",
    side: "incoming",
    state: "",
    mark: "",
}
const CONFIRM: ConversationRecord = {
    id: "m4",
    text: "Yes, the total is 5,000 VND. Please send the payment by bank transfer.",
    who: AGENT,
    at: "2026-11-04T01:06:30.000Z",
    side: "outgoing",
    state: "delivered",
    mark: "AI",
}
const OWNER_QUESTION: ConversationRecord = {
    id: "m5",
    text: "Does this pot come with a root warranty?",
    who: CUSTOMER,
    at: "2026-11-04T01:09:00.000Z",
    side: "incoming",
    state: "",
    mark: "",
}
const WAITING_NOTICE: ConversationRecord = {
    id: "m6",
    text: "This question is waiting for the shop owner to answer.",
    who: "",
    at: "2026-11-04T01:09:05.000Z",
    side: "notice",
    state: "",
    mark: "",
}
const HANDED_NOTICE: ConversationRecord = {
    id: "m7",
    text: "Thu Ha Le took over this conversation.",
    who: "",
    at: "2026-11-04T01:12:00.000Z",
    side: "notice",
    state: "",
    mark: "",
}
const STAFF_REPLY: ConversationRecord = {
    id: "m8",
    text: "Hello, the pot has a 30 day root warranty.",
    who: STAFF,
    at: "2026-11-04T01:13:00.000Z",
    side: "outgoing",
    state: "sent",
    mark: "",
}

const READY_RECORDS: ReadonlyArray<ConversationRecord> = [GREETING, ANSWER, FOLLOW_UP, CONFIRM]

const OPEN_RIGHTS = { canSend: true, canHandoff: true, canClose: true }

/** A thread with a few messages over two days: every control is open. */
export const READY_CONVERSATION: ConversationFixture = {
    slot: { items: READY_RECORDS },
    pending: [],
    draft: "",
    ...OPEN_RIGHTS,
}

/** A thread whose list holds no message yet. */
export const EMPTY_CONVERSATION: ConversationFixture = {
    slot: { isEmpty: true },
    pending: [],
    draft: "",
    ...OPEN_RIGHTS,
}

/** The first read of the thread is in flight: the skeleton keeps the geometry of the ready thread. */
export const LOADING_CONVERSATION: ConversationFixture = {
    slot: { isLoading: true },
    pending: [],
    draft: "",
    ...OPEN_RIGHTS,
}

/** The read of the thread failed: the thread offers to try again. */
export const ERROR_CONVERSATION: ConversationFixture = {
    slot: { isError: true },
    pending: [],
    draft: "",
    ...OPEN_RIGHTS,
}

/** A message the viewer just sent is in flight: it shows at once, with a spinner on the send control and no skeleton. */
export const SENDING_CONVERSATION: ConversationFixture = {
    slot: { items: READY_RECORDS, isValidating: true },
    pending: [{ key: "pending-1", text: "Sure, I am sending the invoice now.", afterId: "m4", state: "sending" }],
    draft: "",
    ...OPEN_RIGHTS,
}

/** The send failed: the message stays in place, marked, with a retry and a way to discard it. */
export const FAILED_CONVERSATION: ConversationFixture = {
    slot: { items: READY_RECORDS },
    pending: [{ key: "pending-1", text: "Sure, I am sending the invoice now.", afterId: "m4", state: "failed" }],
    draft: "",
    ...OPEN_RIGHTS,
}

/** A person took the thread over: a notice says so, and the hand-off control is gone. */
export const HANDED_OFF_CONVERSATION: ConversationFixture = {
    slot: { items: [...READY_RECORDS, OWNER_QUESTION, HANDED_NOTICE, STAFF_REPLY] },
    pending: [],
    draft: "",
    canSend: true,
    canHandoff: false,
    canClose: true,
}

/** The assistant handed a question to the owner: a notice says it waits, and the viewer may not reply. */
export const WAITING_FOR_OWNER_CONVERSATION: ConversationFixture = {
    slot: { items: [...READY_RECORDS, OWNER_QUESTION, WAITING_NOTICE] },
    pending: [],
    draft: "",
    canSend: false,
    canHandoff: true,
    canClose: false,
}

/** Every state of the conversation block by name. */
export const CONVERSATION_FIXTURES: Readonly<Record<string, ConversationFixture>> = {
    ready: READY_CONVERSATION,
    empty: EMPTY_CONVERSATION,
    loading: LOADING_CONVERSATION,
    error: ERROR_CONVERSATION,
    sending: SENDING_CONVERSATION,
    failed: FAILED_CONVERSATION,
    handedOff: HANDED_OFF_CONVERSATION,
    waitingForOwner: WAITING_FOR_OWNER_CONVERSATION,
}
