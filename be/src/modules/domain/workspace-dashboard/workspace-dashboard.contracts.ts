/** The periods the dashboard switches between; each reads the same data over a different window. */
export type DashboardPeriod = "today" | "last_7_days" | "last_30_days" | "this_month"

/** The window of a period: the period and the one before it of the same length. */
export interface DashboardWindow {
    /** The period asked. */
    readonly period: DashboardPeriod
    /** The first instant of the period. */
    readonly from: Date
    /** The first instant after the period (the start of tomorrow in the workspace's time zone). */
    readonly to: Date
    /** The first instant of the period before it, of the same length. */
    readonly previousFrom: Date
}

/** A figure in the period and in the period before it. */
export interface Compared {
    /** In the period. */
    readonly current: number
    /** In the period before. */
    readonly previous: number
}

/** A share between zero and one in the period and in the period before it; null while there is nothing to divide by. */
export interface Rate {
    /** In the period. */
    readonly current: number | null
    /** In the period before. */
    readonly previous: number | null
}

/** The items that wait for the owner: how many wait in all and the oldest few. */
export interface ApprovalList {
    /** Every item that waits. */
    readonly total: number
    /** The oldest items. */
    readonly items: ReadonlyArray<ApprovalRow>
}

/** What the engine's records (conversations, runs) say about the period. */
export interface RecordsFacts {
    /** Conversations with a line said in the period. */
    readonly conversations: Compared
    /** New contacts: conversations opened in the period, one per channel identity. */
    readonly newContacts: Compared
    /** Runs that finished (done or compensated). */
    readonly runsDone: Compared
    /** Runs that failed or were handed to a person. */
    readonly runsFailed: Compared
    /** Replies an agent posted to customers. */
    readonly messagesAnswered: number
    /** Runs that failed or were handed to a person in the period, by agent id. */
    readonly failedRunsByAgent: ReadonlyMap<string, number>
}

/** One finished action with its minutes: a line of the hours-saved definition shown on hover. */
export interface SavingLine {
    /** The action key. */
    readonly action: string
    /** How many were finished in the period. */
    readonly count: number
    /** Minutes one is worth. */
    readonly minutesEach: number
}

/** One installed agent's row of the performance table. */
export interface AgentRow {
    /** The agent. */
    readonly agentId: string
    /** The display name. */
    readonly name: string
    /** The @handle. */
    readonly handle: string
    /** The module the agent belongs to. */
    readonly module: string
    /** Items finished in the period. */
    readonly tasksDone: number
    /** Of those, finished by policy alone; null when none finished. */
    readonly autoRate: number | null
    /** Items that wait for the owner now. */
    readonly waiting: number
    /** Failed items and failed runs in the period. */
    readonly errors: number
    /** The middle time to finish an item by policy alone, seconds; null when none. */
    readonly medianResponseSeconds: number | null
    /** Minutes saved in the period. */
    readonly minutesSaved: number
    /** Credits spent in the period. */
    readonly credits: number
}

/** One item that waits for the owner, ready to open. */
export interface ApprovalRow {
    /** The work item. */
    readonly id: string
    /** The agent that raised it, or null when it has none. */
    readonly agentName: string | null
    /** The action key. */
    readonly action: string
    /** The one-line summary, or null. */
    readonly summary: string | null
    /** The customer, or null. */
    readonly customer: string | null
    /** When it was raised, ISO 8601. */
    readonly createdAt: string
    /** The workbench path that opens it, inside the workspace. */
    readonly href: string
}

/** What the agents did for the owner in the period. */
export interface SavingsFacts {
    /** Minutes saved, by the table of `saved-minutes.policy`. */
    readonly minutesSaved: number
    /** The lines of that sum, the largest first. */
    readonly lines: ReadonlyArray<SavingLine>
    /** Minutes one finished item is worth. */
    readonly defaultMinutes: number
    /** Replies an agent posted to customers. */
    readonly messagesAnswered: number
    /** Credits used this month. */
    readonly creditsUsed: number
    /** The credits of the month, with the carry-over; null is unlimited. */
    readonly creditsLimit: number | null
}

/** Every figure of the workspace dashboard: the engine's own, no module's records. */
export interface WorkspaceDashboardData {
    /** The window read. */
    readonly window: DashboardWindow
    /** Conversations with a line said. */
    readonly conversations: Compared
    /** New contacts. */
    readonly newContacts: Compared
    /** Runs that finished. */
    readonly runsDone: Compared
    /** Runs that failed or were handed to a person. */
    readonly runsFailed: Compared
    /** Items finished by policy alone over items finished, 0..1; null while none finished. */
    readonly agentAutoRate: Rate
    /** The items that wait for the owner (the stops). */
    readonly approvals: ApprovalList
    /** What the agents did: minutes saved, credits used. */
    readonly savings: SavingsFacts
    /** The installed agents. */
    readonly agents: ReadonlyArray<AgentRow>
}
