import { textOf, valueAt } from "../../slots/paths"
import { AWAITING_REPLY } from "./attention"

/** The message key of the count in the heading of the list: "{count} items". */
export const ATTENTION_COUNT_KEY = "attention_count"

/** The kinds of work that wait for the owner on the Sales "needs attention" view, in the order they are listed. */
export const ATTENTION_KINDS: readonly ["waiting", "overdue", "needs-reply", "owner", "failed"] = [
    "waiting",
    "overdue",
    "needs-reply",
    "owner",
    "failed",
]

/** One kind of attention. */
export type AttentionKind = (typeof ATTENTION_KINDS)[number]

/** The row action a kind offers; the block takes one action slot of this name per command. */
export type AttentionCommand = "respond" | "follow" | "reply" | "review" | "resume"

/** The tone of a chip of a kind: the colour pair of a state that needs a look. */
export type AttentionTone = "warning" | "danger" | "info"

/** How one kind is drawn: its chip, its command and whether pressing the row opens the customer. */
export interface AttentionKindView {
    /** The message key of the chip words. */
    readonly chipKey: string
    /** The tone of the chip. */
    readonly tone: AttentionTone
    /** The command under the row. */
    readonly command: AttentionCommand
    /** The message key of the words on the command. */
    readonly commandKey: string
    /** Whether the row is a customer, so pressing it writes the customer to the selection param. */
    readonly opensLead: boolean
}

/** How every kind is drawn. */
export const ATTENTION_KIND_VIEWS: Readonly<Record<AttentionKind, AttentionKindView>> = {
    waiting: {
        chipKey: "attention_kind_waiting",
        tone: "warning",
        command: "respond",
        commandKey: "attention_command_respond",
        opensLead: true,
    },
    overdue: {
        chipKey: "attention_kind_overdue",
        tone: "danger",
        command: "follow",
        commandKey: "attention_command_follow",
        opensLead: true,
    },
    "needs-reply": {
        chipKey: "attention_kind_needs_reply",
        tone: "info",
        command: "reply",
        commandKey: "attention_command_reply",
        opensLead: true,
    },
    owner: {
        chipKey: "attention_kind_owner",
        tone: "warning",
        command: "review",
        commandKey: "attention_command_review",
        opensLead: false,
    },
    failed: {
        chipKey: "attention_kind_failed",
        tone: "danger",
        command: "resume",
        commandKey: "attention_command_resume",
        opensLead: false,
    },
}

/** One row of the list as the block draws it. */
export interface AttentionEntry {
    /** The id of the customer, or of the order the row is about. */
    readonly id: string
    /** The kind of attention. */
    readonly kind: AttentionKind
    /** The name the row is headed by. */
    readonly title: string
    /** The line under the name. */
    readonly description: string
    /** Since when the row waits, ISO text; empty when the read does not say. */
    readonly at: string
    /** The message key of the name, when the name is a step the list has words for; the raw name is the fallback. */
    readonly titleKey?: string
    /** The message key of the line, when it is a failure the list has words for; the raw line is the fallback. */
    readonly descriptionKey?: string
}

/** The steps of Sales a run can park at, with the message that names each. */
export const PARKED_STEP_KEYS: ReadonlyMap<string, string> = new Map<string, string>([
    ["confirm", "failed_step_confirm"],
    ["notify", "failed_step_notify"],
    ["invoice", "failed_step_invoice"],
    ["order.complete", "failed_step_order_complete"],
    ["order.ask-missing", "failed_step_order_ask_missing"],
])

/** The failures of those steps, by the code the engine keeps, with the message that says each. */
export const PARKED_REASON_KEYS: ReadonlyMap<string, string> = new Map<string, string>([
    ["DELIVERY_FAILED", "failed_reason_delivery"],
    ["invoice_unreachable", "failed_reason_invoice"],
    ["TIMEOUT", "failed_reason_timeout"],
])

/** The kind each reason code of the three reads names; a code the list does not know asks the owner for a reply. */
const REASON_KINDS: ReadonlyMap<string, AttentionKind> = new Map<string, AttentionKind>([
    [AWAITING_REPLY, "waiting"],
    ["overdue", "overdue"],
    ["needs_reply", "needs-reply"],
    ["owner", "owner"],
])

/** The kind a reason code names. */
export const kindOfReason = (reason: string): AttentionKind => REASON_KINDS.get(reason) ?? "needs-reply"

/** The entries of one read's records; a record without an id draws no row. */
export const attentionEntriesOf = (records: ReadonlyArray<unknown>): ReadonlyArray<AttentionEntry> =>
    records.flatMap((record) => {
        const id = textOf(valueAt(record, "id"))
        if (id === "") return []
        return [
            {
                id,
                kind: kindOfReason(textOf(valueAt(record, "reason"))),
                title: textOf(valueAt(record, "title")),
                description: textOf(valueAt(record, "description")),
                at: textOf(valueAt(record, "at")),
            },
        ]
    })

/** The kinds in the order of the list, each kind keeping the order its read gave; kinds the spec hides are left out. */
export const attentionListOf = (
    entries: ReadonlyArray<AttentionEntry>,
    shown: ReadonlyArray<AttentionKind>,
): ReadonlyArray<AttentionEntry> =>
    ATTENTION_KINDS.filter((kind) => shown.includes(kind)).flatMap((kind) =>
        entries.filter((entry) => entry.kind === kind),
    )

/**
 * The entries of the runs the engine parked, as `platform.parked-runs` lists them: the id is the run's, which the pill that runs it
 * again hands to `platform.resume-run`; the step it stopped at heads the row, what the error says is its line and when it was
 * parked is its time. A record without an id draws no row.
 */
export const parkedEntriesOf = (records: ReadonlyArray<unknown>): ReadonlyArray<AttentionEntry> =>
    records.flatMap((record) => {
        const id = textOf(valueAt(record, "id"))
        if (id === "") return []
        const step = PARKED_STEP_KEYS.get(textOf(valueAt(record, "step")))
        const reason = PARKED_REASON_KEYS.get(textOf(valueAt(record, "errorCode")))
        return [
            {
                id,
                kind: "failed" as const,
                title: textOf(valueAt(record, "step")),
                description: textOf(valueAt(record, "errorWords")),
                at: textOf(valueAt(record, "parkedAt")),
                ...(step === undefined ? {} : { titleKey: step }),
                ...(reason === undefined ? {} : { descriptionKey: reason }),
            },
        ]
    })
