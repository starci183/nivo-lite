/** One provider attached to an agent, read only: what the agent may do through it. */
export interface ConnectionRow {
    /** The key the list draws the row under: the connection id of the attached account. */
    readonly id: string
    /** The provider and the account, in the viewer's words ("SePay . MB **** 5252"). */
    readonly name: string
    /** The abilities the agent holds on it, with the mode of each ("Doc giao dich . Tao QR (Hoi)"), or the words that it holds none. */
    readonly description: string
    /** The provider key (`sepay`, `zalo_oa`), which picks its mark. */
    readonly provider: string
    /** The highest level the agent holds on it as a raw value (`read`, `ask`, `auto`); absent when it holds no ability. */
    readonly access?: string | undefined
    /** The masked account of the connection, when it has one (a bank feed). */
    readonly accountMasked?: string | undefined
    /** The account's own label ("MB **** 5252", the OA name, the sheet name). */
    readonly account?: string | undefined
    /** Whether this is the shop's default receiving account (every agent's QR draws on it); data only, the aside draws no marker. */
    readonly isDefaultReceiving?: boolean | undefined
}

/** What the connections region shows once read: the accounts attached to the agent, one row each, and the link to its rights. */
export interface ConnectionsRegionView {
    /** The heading of the region, in the viewer's words ("Tai khoan da gan"); empty keeps the block's own label. */
    readonly label: string
    /** The words of the one link of the region, to the agent's rights ("Quyen"). */
    readonly rightsLabel: string
    /** Where that link goes: the agent's connections route. */
    readonly rightsHref: string
    /** The accounts attached to the agent. */
    readonly rows: ReadonlyArray<ConnectionRow>
}

/** One open knowledge gap. */
export interface KnowledgeGapRow {
    /** The key the list draws the gap under. */
    readonly id: string
    /** The question the agent could not answer. */
    readonly title: string
    /** What the agent was asked when it met the gap. */
    readonly description: string
    /** When or how often the gap was met, in words. */
    readonly asked: string
}

/** The open knowledge gaps of the agent. */
export interface KnowledgeGapsView {
    /** The heading of the gaps card. */
    readonly label: string
    /** The count badge; null when there is none. */
    readonly count: string | null
    /** The words of the link that opens the gaps page. */
    readonly openLabel: string
    /** Where the open link goes. */
    readonly openHref: string
    /** The gaps the card lists. */
    readonly rows: ReadonlyArray<KnowledgeGapRow>
}

/** What the knowledge region shows once read. */
export interface KnowledgeRegionView {
    /** The words of the link that opens the knowledge page. */
    readonly openLabel: string
    /** Where the open link goes. */
    readonly openHref: string
    /** The line under the two parts, saying how the agent uses them. */
    readonly footer: string
    /** The heading of the part customers' turns may read. */
    readonly publicTitle: string
    /** What the public part holds, in a line. */
    readonly publicDescription: string
    /** The heading of the part only the business reads. */
    readonly internalTitle: string
    /** What the internal part holds, in a line. */
    readonly internalDescription: string
    /** Null shows no gaps card. */
    readonly gaps: KnowledgeGapsView | null
    /** How much the agent reads and how much of it the owner approved; absent draws no summary. */
    readonly summary?: KnowledgeSummary | undefined
}

/** What the agent reads, in numbers and words. */
export interface KnowledgeSummary {
    /** The documents and their kinds in one line, for instance "6 documents, 2 public". */
    readonly documentsLine: string
    /** The facts in one line, for instance "0 / 63 facts". */
    readonly factsLine: string
    /** The facts the owner approved. */
    readonly approvedFacts: number
    /** The facts approved and waiting. */
    readonly totalFacts: number
    /** The fact that waits for the owner and keeps the agent from acting on its own, as words; null when none waits. */
    readonly blocker: string | null
    /** The words of the line that names the waiting fact. */
    readonly blockerLine: string | null
}
