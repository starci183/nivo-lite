import type {
    FreezeState,
    FreezeSubject,
    LeadFreeze,
    PendingContextValue,
    PendingEvent,
    PendingKind,
} from "./lead-freezes.contracts"

/** The prefix of the key of a freeze about a lead. */
export const LEAD_KEY = "lead:"

/** The prefix of the key of a freeze about the conversation of a customer who is not a lead yet. */
export const CONVERSATION_KEY = "conversation:"

/** The subject kind of a wake about a bank transaction (`bank-transaction:<id>`). */
const TRANSACTION_SUBJECT = "bank-transaction"

/** The tag source of the bank feed. */
const BANK_FEED = "bank_feed"

/** The most events one freeze keeps; past it the oldest folded ones go first, then nothing new is lost but the count. */
export const PENDING_MAX = 500

/** What joins the lines of a customer into one text, as the flows join a burst. */
const LINE = "\n"

/** The mark of a wake written again after a freeze, so a replay is never held for the freeze it came from. */
export const REPLAY_MARK = "~after-freeze-"

/** The words of the owner's item: a key of the capability's messages, with its parameters filled, in the owner's language. */
export type Say = (key: string, params?: Readonly<Record<string, string | number>>) => string

/** The prefix of the words of an error code; a code with no words of its own is named as it is. */
const ERROR_KEY = "leadFreezes.error."

/** The language of a run's context: Vietnamese unless it speaks English. */
export const localeOf = (context: Readonly<Record<string, unknown>>): "vi" | "en" =>
    context.locale === "en" ? "en" : "vi"

const textOf = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null)

/** The subject of a trigger scope as the flows wrote it (`{ kind, id }`) or as a wake's label (`<kind>:<id>`), or null. */
const subjectOf = (value: unknown): { readonly kind: string; readonly id: string } | null => {
    if (typeof value === "string") {
        const at = value.indexOf(":")
        return at <= 0 || at === value.length - 1 ? null : { kind: value.slice(0, at), id: value.slice(at + 1) }
    }
    if (typeof value !== "object" || value === null) return null
    const kind = textOf(Reflect.get(value, "kind"))
    const id = textOf(Reflect.get(value, "id"))
    return kind === null || id === null ? null : { kind, id }
}

/**
 * What ties a freeze to ONE workflow of its customer inside the key (`lead:<id>|wf:<workflowId>`). A freeze holds the workflow whose
 * run stopped, never the customer as a whole: their other workflows, and so their other messages, are still served. A key without
 * the mark is a freeze written before workflows were told apart (or of an agent's own graph) and holds the customer as a whole.
 */
export const WORKFLOW_MARK = "|wf:"

/** The workflow a trigger scope is about (the workflow its run is pinned to), or null. */
export const workflowOfTrigger = (trigger: Readonly<Record<string, unknown>>): string | null => textOf(trigger.workflowId)

/** The workflow a freeze holds, read from its key; null for a freeze that holds its customer as a whole. */
export const workflowOfKey = (key: string): string | null => {
    const at = key.indexOf(WORKFLOW_MARK)
    return at < 0 ? null : key.slice(at + WORKFLOW_MARK.length)
}

const keyed = (base: string, workflowId: string | null): string =>
    workflowId === null ? base : `${base}${WORKFLOW_MARK}${workflowId}`

/** Who a trigger is about, by what it names itself: the lead, else the conversation, in the workflow it names; null when it names neither. */
export const subjectOfTrigger = (trigger: Readonly<Record<string, unknown>>): FreezeSubject | null => {
    const leadId = textOf(trigger.leadId)
    const conversationId = textOf(trigger.conversationId)
    const workflowId = workflowOfTrigger(trigger)
    if (leadId !== null) return { key: keyed(`${LEAD_KEY}${leadId}`, workflowId), leadId, conversationId }
    if (conversationId !== null) {
        return { key: keyed(`${CONVERSATION_KEY}${conversationId}`, workflowId), leadId: null, conversationId }
    }
    return null
}

/** The subject of a lead in one workflow, with the conversation it came from when known. */
export const leadSubjectOf = (
    leadId: string,
    conversationId: string | null,
    workflowId: string | null = null,
): FreezeSubject => ({
    key: keyed(`${LEAD_KEY}${leadId}`, workflowId),
    leadId,
    conversationId,
})

/**
 * The keys a trigger may be held under, most specific first: its lead then its conversation in the workflow it names, then the same
 * two without a workflow (a freeze that holds the customer as a whole).
 */
export const keysOf = (trigger: Readonly<Record<string, unknown>>): ReadonlyArray<string> => {
    const leadId = textOf(trigger.leadId)
    const conversationId = textOf(trigger.conversationId)
    const workflowId = workflowOfTrigger(trigger)
    const bases = [
        ...(leadId === null ? [] : [`${LEAD_KEY}${leadId}`]),
        ...(conversationId === null ? [] : [`${CONVERSATION_KEY}${conversationId}`]),
    ]
    return workflowId === null ? bases : [...bases.map((base) => keyed(base, workflowId)), ...bases]
}

/** Whether a freeze holds a wake of the workflow named: its own workflow, or every workflow when it holds the customer as a whole. */
export const holdsWorkflow = (freeze: LeadFreeze, workflowId: string | null): boolean => {
    const own = workflowOfKey(freeze.key)
    return own === null || own === workflowId
}

/** The bank transaction a wake is about (the bank feed's tag), or null. */
export const transactionOf = (trigger: Readonly<Record<string, unknown>>): string | null => {
    const subject = subjectOf(trigger.subject)
    return subject?.kind === TRANSACTION_SUBJECT ? subject.id : null
}

/** What kind of event a held wake is, from where it came and what it names. */
export const pendingKindOf = (source: string, trigger: Readonly<Record<string, unknown>>): PendingKind => {
    if (transactionOf(trigger) !== null || trigger.tagSource === BANK_FEED || trigger.source === BANK_FEED)
        return "payment"
    if (source === "customer") return "message"
    if (source === "schedule" || textOf(trigger.triggerId) !== null || textOf(trigger.taskId) !== null) return "timer"
    if (source === "tag" || source === "agent") return "handoff"
    return "event"
}

/** The flags and texts of a wake's context, as a pending event keeps them; anything else is dropped. */
export const contextRecordOf = (context: object): Readonly<Record<string, PendingContextValue>> =>
    Object.fromEntries(
        Object.entries(context).filter(
            (entry): entry is [string, PendingContextValue] =>
                typeof entry[1] === "string" || typeof entry[1] === "boolean",
        ),
    )

/** The customer messages a trigger scope carries, oldest first. */
export const messageIdsOf = (trigger: Readonly<Record<string, unknown>>): ReadonlyArray<string> => {
    const ids = trigger.messageIds
    if (Array.isArray(ids)) return ids.filter((id): id is string => typeof id === "string")
    const first = textOf(trigger.messageId)
    const merged = textOf(trigger.mergedMessageIds)
    return [...(first === null ? [] : [first]), ...(merged === null ? [] : merged.split(","))]
}

/** The held wake as the freeze keeps it. */
export interface HeldWake {
    /** The wake. */
    readonly wakeId: string
    /** The agent it woke. */
    readonly agentId: string
    /** Where it came from. */
    readonly source: string
    /** The fact's key. */
    readonly eventKey: string
    /** The lock scope it ran under. */
    readonly scopeKey: string
    /** Its ids and flags. */
    readonly context: object
    /** The member behind it, when a person was. */
    readonly actorMemberId: string | null
}

/** The pending event of a held wake. */
export const pendingEventOf = (
    wake: HeldWake,
    trigger: Readonly<Record<string, unknown>>,
    at: string,
): PendingEvent => {
    const kind = pendingKindOf(wake.source, trigger)
    return {
        wakeId: wake.wakeId,
        agentId: wake.agentId,
        source: wake.source,
        eventKey: wake.eventKey,
        scopeKey: wake.scopeKey,
        context: contextRecordOf(wake.context),
        actorMemberId: wake.actorMemberId,
        kind,
        at,
        conversationId: kind === "message" ? textOf(trigger.conversationId) : null,
        messageIds: kind === "message" ? messageIdsOf(trigger) : [],
        folded: false,
    }
}

/** The events with one more at the end; a wake already recorded is not recorded twice. */
export const withPending = (pending: ReadonlyArray<PendingEvent>, event: PendingEvent): ReadonlyArray<PendingEvent> => {
    if (pending.some((each) => each.wakeId === event.wakeId)) return pending
    const kept = pending.length < PENDING_MAX ? pending : dropOldestFolded(pending)
    return [...kept, event]
}

const dropOldestFolded = (pending: ReadonlyArray<PendingEvent>): ReadonlyArray<PendingEvent> => {
    const at = pending.findIndex((each) => each.folded)
    return at < 0 ? pending : [...pending.slice(0, at), ...pending.slice(at + 1)]
}

/** The lines a frozen customer wrote in the conversation of the failed run: what a retry shows the failed turn. */
export const linesToFold = (
    pending: ReadonlyArray<PendingEvent>,
    conversationId: string | null,
): ReadonlyArray<string> =>
    conversationId === null
        ? []
        : pending
              .filter((each) => each.kind === "message" && each.conversationId === conversationId)
              .flatMap((each) => each.messageIds)

/** The events with the lines of the conversation marked as shown to the failed turn. */
export const foldLines = (
    pending: ReadonlyArray<PendingEvent>,
    conversationId: string | null,
): ReadonlyArray<PendingEvent> =>
    pending.map((each) =>
        conversationId !== null && each.kind === "message" && each.conversationId === conversationId
            ? { ...each, folded: true }
            : each,
    )

/**
 * The events to replay on release, in the order they came: after a successful retry the lines it showed the failed turn were answered by
 * it, so they are left out; after a skip nothing answered them, so every event is replayed.
 */
export const replayOf = (
    pending: ReadonlyArray<PendingEvent>,
    reason: "retried" | "skipped",
): ReadonlyArray<PendingEvent> => (reason === "retried" ? pending.filter((each) => !each.folded) : pending)

/** The key a replayed wake is written under: the event's own, marked with the freeze and its episode, so one release writes it once. */
export const replayKeyOf = (event: PendingEvent, freezeId: string, episode: number): string =>
    `${event.eventKey}${REPLAY_MARK}${freezeId}-${episode}`

/** An object of plain data, as a step's input and its trigger are. */
export type JsonObject = Readonly<Record<string, unknown>>

/** Whether a value is an object (not a list, not null). */
export const isJsonObject = (value: unknown): value is JsonObject =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** One file a customer line carries. */
export interface SaidFile {
    /** The file. */
    readonly id: string
    /** Its name. */
    readonly name: string
    /** Its type. */
    readonly contentType: string
    /** A short-lived address. */
    readonly url: string
}

/** One customer message as a trigger scope carries it. */
export interface SaidLine {
    /** The message. */
    readonly id: string
    /** What the customer said. */
    readonly text: string
    /** When, ISO text. */
    readonly at: string
    /** The files sent with it. */
    readonly attachments: ReadonlyArray<SaidFile>
}

const lineJsonOf = (line: SaidLine): JsonObject => ({
    id: line.id,
    text: line.text,
    at: line.at,
    attachments: line.attachments.map((file) => ({
        id: file.id,
        name: file.name,
        contentType: file.contentType,
        url: file.url,
    })),
})

/**
 * The failed step's input with the lines the customer wrote while frozen: the trigger's text, messages and message ids grow by the lines
 * it does not hold yet, oldest first. A step whose input holds no trigger is left as it is.
 */
export const withLines = (input: JsonObject, said: ReadonlyArray<SaidLine>): JsonObject => {
    const trigger = input.trigger
    if (!isJsonObject(trigger) || said.length === 0) return input
    const held = new Set(messageIdsOf(trigger))
    const fresh = said.filter((line) => !held.has(line.id))
    if (fresh.length === 0) return input
    const text = textOf(trigger.text)
    const messages: ReadonlyArray<unknown> = Array.isArray(trigger.messages) ? trigger.messages : []
    return {
        ...input,
        trigger: {
            ...trigger,
            text: [...(text === null ? [] : [text]), ...fresh.map((line) => line.text)].join(LINE),
            messages: [...messages, ...fresh.map(lineJsonOf)],
            messageIds: [...held, ...fresh.map((line) => line.id)],
        },
    }
}

/** The title of a step in the owner's language: the node's own title, else the key of the node. */
export const stepTitleOf = (title: unknown, nodeKey: string, locale: "vi" | "en"): string => {
    if (typeof title !== "object" || title === null) return nodeKey
    const words = textOf(Reflect.get(title, locale)) ?? textOf(Reflect.get(title, "vi"))
    return words ?? nodeKey
}

/** The error of a code in the owner's language; a code with no words of its own is named as it is. */
export const errorSummaryOf = (code: string | null, say: Say): string => {
    if (code === null) return say(`${ERROR_KEY}unknown`)
    const key = `${ERROR_KEY}${code}`
    const words = say(key)
    return words === key ? code : words
}

/** The one-line title of a freeze's item. */
export const itemTitleOf = (freeze: LeadFreeze, say: Say): string =>
    say("leadFreezes.item.title", {
        name: freeze.customerName ?? say("leadFreezes.item.unnamed"),
        step: freeze.stepTitle ?? freeze.stepKey ?? "?",
    })

/** The whole text of a freeze's item: the title, the error, the waiting events and what each answer will do. */
export const itemSummaryOf = (freeze: LeadFreeze, say: Say): string => {
    const waiting = freeze.pending.filter((each) => !each.folded).length
    return [
        `${itemTitleOf(freeze, say)}.`,
        say("leadFreezes.item.error", { summary: errorSummaryOf(freeze.frozenReason, say) }),
        ...(freeze.failures > 1 ? [say("leadFreezes.item.failures", { n: freeze.failures })] : []),
        waiting === 0 ? say("leadFreezes.item.waitingNone") : say("leadFreezes.item.waiting", { n: waiting }),
        say("leadFreezes.item.retry"),
        say("leadFreezes.item.takeOver"),
        say("leadFreezes.item.skip"),
    ].join(" ")
}

/** What each answer does, as the item's fields name them for the cards that draw them. */
export const itemAnswersOf = (say: Say): Readonly<Record<string, string>> => ({
    retry: say("leadFreezes.item.retry"),
    takeOver: say("leadFreezes.item.takeOver"),
    skip: say("leadFreezes.item.skip"),
})

/** Whether a freeze still holds its customer. */
export const holds = (freeze: LeadFreeze | null): freeze is LeadFreeze & { readonly status: "frozen" | "retrying" } =>
    freeze !== null && freeze.status !== "released"

/** What the pages read of a freeze that holds its customer; null for one that does not. */
export const stateOf = (freeze: LeadFreeze | null): FreezeState | null => {
    if (!holds(freeze)) return null
    return {
        id: freeze.id,
        status: freeze.status,
        workflowId: workflowOfKey(freeze.key),
        leadId: freeze.leadId,
        conversationId: freeze.conversationId,
        runId: freeze.frozenRunId,
        stepTitle: freeze.stepTitle,
        reason: freeze.frozenReason,
        workItemId: freeze.workItemId,
        pendingCount: freeze.pending.filter((each) => !each.folded).length,
        heldBy: freeze.heldBy,
        frozenAt: freeze.frozenAt,
    }
}

/** The transfer code of an order number, as the payment request writes it: letters and digits, upper case. */
export const transferCodeOf = (orderNo: string): string => orderNo.replace(/[^A-Za-z0-9]/g, "").toUpperCase()

/** Whether the content of a transfer names one of the orders, by its transfer code. */
export const namesAnOrder = (reference: string | null, orderNos: ReadonlyArray<string>): boolean => {
    if (reference === null) return false
    const content = reference.replace(/[^A-Za-z0-9]/g, "").toUpperCase()
    return orderNos.some((orderNo) => {
        const code = transferCodeOf(orderNo)
        return code !== "" && content.includes(code)
    })
}
