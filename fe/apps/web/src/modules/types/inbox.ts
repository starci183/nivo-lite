import type { BadgeTone, FilterFields } from "@starci/grammar/common"

/** Where a read of the inbox stands. */
export type InboxReadStatus = "loading" | "failed" | "ready"

/** One mark of a lead row: its words and tone, already in the reader's language. */
export interface InboxChipView {
    readonly key: string
    readonly label: string
    readonly tone: BadgeTone
}

/** The agent that owns a customer, as a row and the head draw it. */
export interface InboxAgentView {
    readonly id: string
    readonly name: string
    readonly avatarUrl: string | null
}

/** One customer of the lead list, every word already in the reader's language. */
export interface InboxLeadRowView {
    readonly id: string
    /** The name, or the words for an unnamed sender. */
    readonly name: string
    /** The raw channel key, for the mark. */
    readonly channelKey: string
    /** The short code drawn on the channel badge ("Z", "TG"). */
    readonly channelBadge: string
    /** The channel in words, for the accessible name of the badge. */
    readonly channelLabel: string
    /** The time of the latest input: a clock time today, else a short date. */
    readonly time: string
    /** The section the row sits under: today, yesterday or earlier. */
    readonly section: "today" | "yesterday" | "earlier"
    readonly summary: string
    readonly chips: ReadonlyArray<InboxChipView>
    readonly agent: InboxAgentView | null
}

/** One option of a select above the list. */
export interface InboxOptionView {
    readonly id: string
    readonly label: string
}

/** The lead list pane: its tabs, search, selects and rows. */
export interface InboxListView {
    readonly tabs: FilterFields["items"]
    readonly selectedTab: string
    readonly query: string
    readonly channels: ReadonlyArray<InboxOptionView>
    readonly channel: string
    readonly agents: ReadonlyArray<InboxOptionView>
    readonly agent: string
    readonly sorts: ReadonlyArray<InboxOptionView>
    readonly sort: string
    readonly rows: ReadonlyArray<InboxLeadRowView>
    /** The facts of the header's one summary line, each with its number and words. */
    readonly stats: ReadonlyArray<string>
    /** How many customers came in today (the staff home reads it). */
    readonly newToday: number
    readonly selectedId: string | null
}

/** The pending approval of the opened customer, with its words. */
export interface InboxApprovalView {
    readonly title: string
    readonly body: string
    /** The order the buttons decide, or null when what waits is no order (the buttons are then absent). */
    readonly orderId: string | null
}

/** One term and value of a facts table. */
export interface InboxFactView {
    readonly id: string
    readonly term: string
    readonly text: string
}

/** One entry of the journey, drawn the way the team chat draws the same thing. */
export interface InboxJourneyEntryView {
    readonly id: string
    /** `customer`: a bubble of the customer; `reply`: a bubble of the shop; `action`: a card of an agent or the owner; `milestone`: a centred line. */
    readonly kind: "customer" | "reply" | "action" | "milestone"
    /** `message` for what the customer sent, `agent` for what an agent or the owner did. */
    readonly group: "message" | "agent"
    readonly who: string
    /** The clock time of the entry. */
    readonly time: string
    /** The calendar day the entry falls on: entries of one day share it. */
    readonly day: string
    /** The words that head that day (today, yesterday or the date). */
    readonly dayLabel: string
    readonly text: string
    /** The channel of the entry, for the badge on the customer's avatar. */
    readonly channelKey: string
    readonly channelBadge: string
    readonly channelLabel: string
}

/** One order of the aside. */
export interface InboxOrderView {
    readonly id: string
    readonly title: string
    readonly description: string
    readonly badge: InboxChipView
}

/** One step of the stage stepper. */
export interface InboxStepView {
    readonly id: string
    readonly label: string
}

/** The opened customer: the head, the cards and the aside. */
export interface InboxDetailView {
    readonly id: string
    readonly name: string
    readonly channelKey: string
    readonly channelBadge: string
    readonly channelLabel: string
    readonly stageChip: InboxChipView
    readonly sourceLine: string
    readonly agent: InboxAgentView | null
    readonly steps: ReadonlyArray<InboxStepView>
    readonly currentStep: string
    readonly approval: InboxApprovalView | null
    readonly needsSummary: string
    readonly needsFacts: ReadonlyArray<InboxFactView>
    readonly journey: ReadonlyArray<InboxJourneyEntryView>
    readonly customerFacts: ReadonlyArray<InboxFactView>
    readonly sourceFacts: ReadonlyArray<InboxFactView>
    readonly orders: ReadonlyArray<InboxOrderView>
    /** The phone of the customer for the copy action of the head menu, or null. */
    readonly phone: string | null
}

/** The website intake drawer: its tabs, snippet, switches and agent. */
export interface InboxWebsiteView {
    readonly isOpen: boolean
    readonly isLoading: boolean
    readonly isPending: boolean
    readonly isEnabled: boolean
    readonly tab: string
    readonly snippet: string
    /** The address of the hosted form: the link, and the source of the embed. */
    readonly formUrl: string
    readonly chatOn: boolean
    readonly formOn: boolean
    readonly pricesOn: boolean
    readonly agent: string
    readonly agents: ReadonlyArray<InboxOptionView>
}

/** What the visitor typed into the hosted form of a shop website. */
export interface WebsiteFormValues {
    readonly name: string
    readonly phone: string
    readonly message: string
}

/** What came of the last send of the hosted form. */
export type WebsiteFormStatus = "idle" | "sending" | "sent" | "off" | "empty" | "failed"
