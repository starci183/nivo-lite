import type { BadgeTone } from "@starci/grammar/common"

/** How an agent stands at the top of its Work tab. */
export type AgentWorkStatusKind = "working" | "idle" | "paused" | "breaker" | "off" | "workspaceOff"

/** The status band: the state in words, the next run and the queue. */
export interface AgentWorkStatusView {
    readonly kind: AgentWorkStatusKind
    readonly label: string
    readonly tone: BadgeTone
    /** The next run in words ("in 12 minutes"); a sentence saying there is none otherwise. */
    readonly nextRunLabel: string
    /** How many wakes wait to run, in words. */
    readonly queueLabel: string
    /** Why work is stopped (the switch, the breaker, the pause), empty while it is not. */
    readonly stopNotice: string
}

/** One goal of the agent. */
export interface AgentWorkGoalView {
    readonly id: string
    readonly title: string
    readonly detail: string
    /** "Active", "Paused" and so on. */
    readonly statusLabel: string
    readonly dueLabel: string
    /** A goal that is done or dropped is no longer asked of the agent. */
    readonly isOpen: boolean
    readonly source: string
}

/** One task the agent is on. */
export interface AgentWorkTaskView {
    readonly id: string
    readonly title: string
    readonly detail: string
    readonly statusLabel: string
    /** What the task waits for, with when the agent wakes for it; empty when it waits for nothing. */
    readonly waitLabel: string
    /** Where the work item the task opened is decided; null when it opened none. */
    readonly workItemHref: string | null
}

/** The shapes a schedule trigger takes in the form. */
export type AgentWorkPreset = "every_15m" | "hourly" | "daily_at" | "weekdays_at"

/** One trigger as a sentence with its switch. */
export interface AgentWorkTriggerView {
    readonly id: string
    readonly sentence: string
    readonly nextRunLabel: string
    readonly isEnabled: boolean
    /** A clock the person can edit and remove; the triggers a module seeded stay and can only be switched. */
    readonly isRemovable: boolean
    readonly kind: string
    readonly preset: AgentWorkPreset | null
    readonly atTime: string
    readonly timeZone: string
    readonly eventName: string
    readonly probeKey: string
}

/** One row of the turn list: why it woke, what it did, what it cost. No prompt and no customer words. */
export interface AgentWorkTurnView {
    readonly id: string
    readonly sourceLabel: string
    readonly outcomeLabel: string
    readonly outcomeTone: BadgeTone
    readonly wokeLabel: string
    /** "1 200 tokens - 0.0042 - 8 s", only what is known. */
    readonly usageLabel: string
    /** Where the work item the turn opened is decided; null when it opened none. */
    readonly workItemHref: string | null
}

/** The turn list: the rows that did something, and the wakes that found nothing to do collapsed into a count. */
export interface AgentWorkTurnsView {
    readonly rows: ReadonlyArray<AgentWorkTurnView>
    /** "14 wakes found nothing to do"; empty when every wake did something. */
    readonly quietLabel: string
}

/** Everything the Work tab draws, every word resolved. */
export interface AgentWorkView {
    readonly status: AgentWorkStatusView
    readonly goals: ReadonlyArray<AgentWorkGoalView>
    readonly tasks: ReadonlyArray<AgentWorkTaskView>
    readonly triggers: ReadonlyArray<AgentWorkTriggerView>
    readonly turns: AgentWorkTurnsView
    /** Owners and managers change goals, triggers and tasks. */
    readonly canEdit: boolean
}

/** The kill switch of one agent and the person's right to move it. */
export interface AgentWorkSwitchView {
    readonly isOn: boolean
    readonly statusLabel: string
    readonly tone: BadgeTone
    /** Owner only. */
    readonly canChange: boolean
}

/** The kill switch of the whole workspace with the counts beside it. */
export interface WorkspaceAgentWorkView {
    readonly isOn: boolean
    readonly canChange: boolean
    /** "2 agents are off, 3 wakes wait, 1 is held". */
    readonly countsLabel: string
}
