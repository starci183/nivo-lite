import type { ListSource } from "@nivo-lite/agent-sdk/block"
import type { PortDefinition, PortProvider } from "@nivo-lite/agent-sdk/port"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import type {
    AdjustmentStore,
    BookEntryStore,
    ClaimStore,
    ConversationFinder,
    Door,
    DoorCallResult,
    EnqueueOptions,
    EntryRow,
    InvoiceStore,
    LeadNames,
    OrderStore,
    Outbox,
    QuestionCounter,
    SettingsStore,
    TransactionStore,
} from "./accounting.types"

/**
 * In-memory doubles of the module's ports for the specs of its reads, actions and jobs: every method rejects as unused until a spec
 * gives it an answer, so a spec fails loudly when the code under test asks for data it did not expect.
 */

const unused = (): Promise<never> => Promise.reject(new Error("unused"))

/** A transaction store; a spec gives the methods it expects. */
export const transactionStore = (changes: Partial<TransactionStore> = {}): TransactionStore => ({
    get: unused,
    settle: unused,
    unmatchedIn: unused,
    settlesInvoice: unused,
    ...changes,
})

/** A stand-in a spec fills with only the answers the code under test may ask for; the rest reject. */
export const orderStore = (changes: Partial<OrderStore> = {}): OrderStore => ({
    get: unused,
    setStatus: unused,
    ...changes,
})

/** A stand-in a spec fills with only the answers the code under test may ask for; the rest reject. */
export const claimStore = (changes: Partial<ClaimStore> = {}): ClaimStore => ({
    get: unused,
    settle: unused,
    ...changes,
})

/** A stand-in a spec fills with only the answers the code under test may ask for; the rest reject. */
export const invoiceStore = (changes: Partial<InvoiceStore> = {}): InvoiceStore => ({
    get: unused,
    open: unused,
    ...changes,
})

/** A stand-in a spec fills with only the answers the code under test may ask for; the rest reject. */
export const adjustmentStore = (changes: Partial<AdjustmentStore> = {}): AdjustmentStore => ({
    get: unused,
    targetExists: unused,
    of: unused,
    insert: unused,
    ...changes,
})

/** The customers' names. */
export const leadNames = (changes: Partial<LeadNames> = {}): LeadNames => ({ nameOf: unused, ...changes })

/** A stand-in a spec fills with only the answers the code under test may ask for; the rest reject. */
export const conversationFinder = (changes: Partial<ConversationFinder> = {}): ConversationFinder => ({
    latestOfLead: unused,
    ...changes,
})

/** The waiting-question counter. */
export const questionCounter = (changes: Partial<QuestionCounter> = {}): QuestionCounter => ({
    waiting: unused,
    ...changes,
})

/** A stand-in a spec fills with only the answers the code under test may ask for; the rest reject. */
export const bookEntryStore = (changes: Partial<BookEntryStore> = {}): BookEntryStore => ({
    get: unused,
    upsert: unused,
    totals: unused,
    ...changes,
})

/** A settings store; the first save of a workspace has none yet, so a spec says what `get` finds. */
export const settingsStore = (changes: Partial<SettingsStore> = {}): SettingsStore => ({
    get: unused,
    save: unused,
    ...changes,
})

/** The entries list source. */
export const entriesSource = (changes: Partial<ListSource<EntryRow>> = {}): ListSource<EntryRow> => ({
    page: unused,
    counts: unused,
    ...changes,
})

/** One job a recording outbox was asked to enqueue. */
export interface Enqueued {
    /** The job name. */
    readonly name: string
    /** The input of the job. */
    readonly input: Readonly<Record<string, JsonValue>>
    /** The enqueue options. */
    readonly options: EnqueueOptions | undefined
}

/** A recording outbox with the jobs it was asked to enqueue, in order. */
export interface RecordingOutbox {
    /** The outbox to hand to the code under test. */
    readonly outbox: Outbox
    /** What it was asked to enqueue. */
    readonly jobs: Array<Enqueued>
}

/** An outbox that records what it was asked to enqueue. */
export const recordingOutbox = (): RecordingOutbox => {
    const jobs: Array<Enqueued> = []
    return {
        jobs,
        outbox: {
            enqueue: (name, input, options) => {
                jobs.push({ name, input, options })
                return Promise.resolve()
            },
        },
    }
}

/** One tool a scripted door was asked to call. */
export interface DoorCall {
    /** The tool name. */
    readonly tool: string
    /** The input of the call. */
    readonly input: Readonly<Record<string, JsonValue>>
}

/** A scripted door with the calls it received, in order. */
export interface ScriptedDoor {
    /** The door to hand to the code under test. */
    readonly door: Door
    /** The calls it received. */
    readonly calls: Array<DoorCall>
}

/** A door that answers each tool as the script says (a tool the script does not name is unknown) and records the calls. */
export const scriptedDoor = (answers: Readonly<Record<string, DoorCallResult>>): ScriptedDoor => {
    const calls: Array<DoorCall> = []
    return {
        calls,
        door: {
            call: (tool, input) => {
                calls.push({ tool, input })
                return Promise.resolve(answers[tool] ?? { ok: false, reason: "unknown_tool", message: tool })
            },
        },
    }
}

/** A provider that answers each port id with the implementation given for it. */
export const providerOf = (
    implementations: ReadonlyArray<readonly [PortDefinition<unknown>, unknown]>,
): PortProvider => ({
    implementationOf: (port) => implementations.find(([candidate]) => candidate.id === port.id)?.[1],
})
