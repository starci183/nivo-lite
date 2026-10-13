/** What recording an outcome answered. */
export interface RecordedOutcomeItem {
    readonly leadId: string
    readonly stage: string
    readonly contactName: string
    readonly company: string
    readonly channel: string
    readonly need: string
    readonly origin: string | null
    readonly handedToAccounting: boolean
}

/** One step of a lead journey as the back end answers it. */
export interface ResponsibilityItem {
    readonly id: string
    readonly leadId: string
    readonly title: string
    readonly ownerKind: string
    readonly ownerAgentId: string | null
    readonly ownerName: string
    readonly nextAction: string
    readonly dueAt: string | null
    readonly status: string
}
