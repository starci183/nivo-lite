/** What starts a wake. */
export type AgentWakeSource = "customer" | "tag" | "internal" | "schedule"

/** Where a wake stands. */
export type AgentWakeStatus = "pending" | "running" | "done" | "skipped" | "held" | "failed" | "dead"

/** How a wake ends once a turn has run, or has been refused: `failed` is the only ending that is retried. */
export type AgentWakeEnd = "done" | "skipped" | "held" | "failed"

/** Where a turn stands. */
export type AgentTurnStatus = "running" | "proposed" | "settled" | "failed" | "abandoned"

/** Which road a workspace's customer intake takes. */
export type AgentRoad = "legacy" | "core"

/** Who put a goal on an agent's list. */
export type AgentGoalSource = "owner" | "module" | "agent"

/** Where a goal stands. */
export type AgentGoalStatus = "active" | "paused" | "done" | "dropped"

/** Where a task stands. */
export type AgentTaskStatus = "open" | "waiting" | "done" | "dropped"

/** What a waiting task waits for. */
export type AgentTaskWaitingOn = "approval" | "member" | "event"

/** How often a schedule trigger fires; the owner picks a preset, never free cron. */
export type AgentTriggerPreset = "every_15m" | "hourly" | "daily_at" | "weekdays_at"

/** A trigger wakes the agent on a clock or on an internal event. */
export type AgentTriggerKind = "schedule" | "event"

/** The language of a reply. */
export type AgentLocale = "vi" | "en"

/**
 * What a wake carries: ids and flags only, the same rule as a queue payload. Words of a customer or a colleague are read from
 * their own tables when the turn runs, never copied here.
 */
export interface AgentWakeContext {
    /** The customer conversation. */
    readonly conversationId?: string
    /** The message that woke the agent. */
    readonly messageId?: string
    /** The channel's own id of the message. */
    readonly channelEventId?: string
    /** True when the customer was just met, so the turn should ask the channel for their name. */
    readonly lookupName?: boolean
    /** The Office room of a tag. */
    readonly room?: string
    /** The work thread of a tag. */
    readonly threadId?: string
    /** The account that wrote the tagging message. */
    readonly authorUserId?: string
    /** The language of the reply. */
    readonly locale?: AgentLocale
    /** The trigger that fired. */
    readonly triggerId?: string
    /** The slot (epoch ms) of the schedule that fired. */
    readonly slot?: string
    /** The internal event that fired. */
    readonly eventName?: string
    /** The subject of the event or the task. */
    readonly subjectId?: string
    /** The task that is due. */
    readonly taskId?: string
    /** The probe that decides whether a schedule has work. */
    readonly probeKey?: string
}

/** One fact that wakes an agent. */
export interface AgentWake {
    /** The workspace of the agent. */
    readonly workspaceId: string
    /** The agent to wake. */
    readonly agentId: string
    /** What woke it. */
    readonly source: AgentWakeSource
    /** Stable for one fact: the message id, `<triggerId>:<slot>`, `<eventName>:<dedupeKey>`, `task:<id>:<at>`. */
    readonly eventKey: string
    /** Ids and flags of the fact. */
    readonly context: AgentWakeContext
    /** The member behind the wake, when a person is. */
    readonly actorMemberId: string | null
}

/** The wake a worker picked for a turn, with the fence that guards every later write. */
export interface AgentTurnView {
    /** The workspace of the agent. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The lock scope the turn runs under. */
    readonly scopeKey: string
    /** The fence of this attempt: it rises on every begin. */
    readonly fence: number
    /** The turn row. */
    readonly turnId: string
    /** The wake it answers. */
    readonly wakeId: string
    /** What woke the agent. */
    readonly source: AgentWakeSource
    /** The fact's key. */
    readonly eventKey: string
    /** Ids and flags of the fact. */
    readonly context: AgentWakeContext
    /** The member behind the wake. */
    readonly actorMemberId: string | null
    /** The attempt, counting this one. */
    readonly attempts: number
    /** The attempts the wake may have. */
    readonly maxAttempts: number
    /** When the wake was written. */
    readonly wakeCreatedAt: Date
    /** The proposal an earlier attempt stored, or null: the model is not asked again when it is there. */
    readonly proposal: unknown
}

/** A turn that is running, with the wake it answers: what a tool call of that turn is looked up by. */
export interface AgentRunningTurn {
    /** The turn row. */
    readonly turnId: string
    /** The workspace of the agent. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The wake it answers. */
    readonly wakeId: string
    /** What woke the agent. */
    readonly source: AgentWakeSource
    /** The runtime's session key of the turn. */
    readonly threadKey: string
    /** Ids and flags of the fact. */
    readonly context: AgentWakeContext
}

/** What `begin` answered. */
export type AgentBegin =
    { readonly result: "killed" | "busy" | "idle" } | { readonly result: "begun"; readonly turn: AgentTurnView }

/** What `propose` answered. */
export type AgentProposeResult = "stored" | "fenced" | "killed"

/** What `finish` answered. */
export interface AgentFinish {
    /** True when the lease had moved on, so nothing was written. */
    readonly fenced: boolean
    /** True when another wake of the scope is due now. */
    readonly more: boolean
}

/** What a run cost. */
export interface AgentTurnUsage {
    /** `provider/model`, or null. */
    readonly model: string | null
    /** Prompt tokens. */
    readonly promptTokens: number
    /** Completion tokens. */
    readonly completionTokens: number
    /** The provider cost. */
    readonly cost: number
    /** Wall time of the model call. */
    readonly durationMs: number
}

/** How a turn ended, for the finish call. */
export interface AgentTurnEnding {
    /** The end of the wake. */
    readonly status: AgentWakeEnd
    /** Why, for a skip, a hold or a failure. */
    readonly reason: string | null
    /** What was done, stored on the turn. */
    readonly outcome: unknown
    /** The error code of a failure. */
    readonly errorCode: string | null
    /** The usage, when a model ran. */
    readonly usage: AgentTurnUsage | null
}

/** One thing the minute sweep must look at. */
export interface AgentWorkDue {
    /** `lease` a lapsed lease, `wake` a due wake, `task` a due task, `trigger` an overdue schedule. */
    readonly kind: "lease" | "wake" | "task" | "trigger"
    /** The agent. */
    readonly agentId: string
    /** Its workspace. */
    readonly workspaceId: string
    /** The lock scope. */
    readonly scopeKey: string
    /** The task or trigger, or the lapsed turn; null for a wake. */
    readonly subjectId: string | null
    /** When it fell due. */
    readonly at: Date | null
}

/** The kill switch of an agent. */
export interface AgentWorkState {
    /** The agent. */
    readonly agentId: string
    /** False when work is switched off for the agent. */
    readonly workEnabled: boolean
    /** Failed turns in a row. */
    readonly failures: number
    /** Until when background work waits, or null. */
    readonly breakerUntil: Date | null
    /** The last turn that ended. */
    readonly lastTurnAt: Date | null
    /** The day of the background count. */
    readonly backgroundDay: string | null
    /** Background turns that day. */
    readonly backgroundTurns: number
}

/** The day's count of background turns an agent has run. */
export interface BackgroundCount {
    /** The day (`YYYY-MM-DD`) the count belongs to, or null while nothing was counted. */
    readonly backgroundDay: string | null
    /** Background turns counted that day. */
    readonly backgroundTurns: number
}

/** The workspace's switch, road and cap. */
export interface AgentWorkSettingsRecord {
    /** The workspace. */
    readonly workspaceId: string
    /** False when work is switched off for the whole workspace. */
    readonly workEnabled: boolean
    /** The customer intake road. */
    readonly road: AgentRoad
    /** The most background turns an agent may run per day. */
    readonly backgroundDailyCap: number
}

/** One goal of an agent. */
export interface AgentGoalRecord {
    /** The goal. */
    readonly id: string
    /** The agent. */
    readonly agentId: string
    /** Short title. */
    readonly title: string
    /** Longer text. */
    readonly detail: string
    /** Where it stands. */
    readonly status: AgentGoalStatus
    /** Who put it there. */
    readonly source: AgentGoalSource
    /** When it is due, or null. */
    readonly dueAt: Date | null
    /** When the agent last reviewed it, or null. */
    readonly reviewedAt: Date | null
}

/** What a person or a module writes for a goal. */
export interface AgentGoalWrite {
    /** The workspace. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The goal to change, or null for a new one. */
    readonly goalId: string | null
    /** Short title. */
    readonly title: string
    /** Longer text. */
    readonly detail: string
    /** Where it stands. */
    readonly status: AgentGoalStatus
    /** Who puts it there. */
    readonly source: AgentGoalSource
    /** The member who writes it, or null for a module. */
    readonly memberId: string | null
    /** When it is due, or null. */
    readonly dueAt: Date | null
}

/** One task of an agent. */
export interface AgentTaskRecord {
    /** The task. */
    readonly id: string
    /** The agent. */
    readonly agentId: string
    /** The goal it serves, or null. */
    readonly goalId: string | null
    /** The key the agent named it by. */
    readonly dedupeKey: string
    /** Short title. */
    readonly title: string
    /** Longer text. */
    readonly detail: string
    /** Where it stands. */
    readonly status: AgentTaskStatus
    /** What it waits for. */
    readonly waitingOn: AgentTaskWaitingOn | null
    /** When the agent wants to wake for it. */
    readonly nextActionAt: Date | null
    /** The work item it opened, or null. */
    readonly workItemId: string | null
}

/** What an agent's proposal asks for one task. */
export interface AgentTaskOp {
    /** `add` opens or reopens, `done` closes, `wait` parks the task until the given moment or an event. */
    readonly op: "add" | "done" | "wait"
    /** The agent's own key for the task: the dedupe key. */
    readonly key: string
    /** Short title, for `add`. */
    readonly title?: string
    /** When to wake the agent for it. */
    readonly nextActionAt?: Date
    /** What a `wait` waits for. */
    readonly waitingOn?: AgentTaskWaitingOn
    /** The goal it serves. */
    readonly goalId?: string
    /** The wake that opened it. */
    readonly originWakeId?: string
    /** The work item it opened. */
    readonly workItemId?: string
}

/** One trigger of an agent. */
export interface AgentTriggerRecord {
    /** The trigger. */
    readonly id: string
    /** The agent. */
    readonly agentId: string
    /** Clock or event. */
    readonly kind: AgentTriggerKind
    /** The schedule preset, for a clock. */
    readonly preset: AgentTriggerPreset | null
    /** The time of day (`HH:MM`), for the daily presets. */
    readonly atTime: string | null
    /** The zone of the time of day. */
    readonly timeZone: string
    /** The internal event, for an event trigger. */
    readonly eventName: string | null
    /** The probe that decides whether there is work. */
    readonly probeKey: string | null
    /** Off means the trigger stays and fires nothing. */
    readonly enabled: boolean
    /** The next slot the scheduler holds. */
    readonly nextRunAt: Date | null
    /** The last slot that fired. */
    readonly lastFiredAt: Date | null
}

/** What an owner writes for a trigger. */
export interface AgentTriggerWrite {
    /** The workspace. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The trigger to change, or null for a new one. */
    readonly triggerId: string | null
    /** Clock or event. */
    readonly kind: AgentTriggerKind
    /** The schedule preset, for a clock. */
    readonly preset: AgentTriggerPreset | null
    /** The time of day (`HH:MM`), for the daily presets. */
    readonly atTime: string | null
    /** The zone of the time of day; the default zone when null. */
    readonly timeZone: string | null
    /** The internal event, for an event trigger. */
    readonly eventName: string | null
    /** The probe that decides whether there is work. */
    readonly probeKey: string | null
    /** Off means the trigger stays and fires nothing. */
    readonly enabled: boolean
}

/** One turn as the work tab lists it: no prompt and no customer words. */
export interface AgentTurnRecord {
    /** The turn. */
    readonly id: string
    /** What woke the agent. */
    readonly source: AgentWakeSource
    /** How the wake ended. */
    readonly wakeStatus: AgentWakeStatus
    /** Why it was skipped, held or failed. */
    readonly reason: string | null
    /** Where the turn stands. */
    readonly status: AgentTurnStatus
    /** The model. */
    readonly model: string | null
    /** Prompt tokens. */
    readonly promptTokens: number | null
    /** Completion tokens. */
    readonly completionTokens: number | null
    /** The provider cost. */
    readonly cost: number | null
    /** Wall time of the model call. */
    readonly durationMs: number | null
    /** When the wake was written. */
    readonly wokeAt: Date
}

/** Everything the work tab of one agent shows. */
export interface AgentWorkView {
    /** The kill switch and the breaker. */
    readonly state: AgentWorkState
    /** Active and paused goals. */
    readonly goals: ReadonlyArray<AgentGoalRecord>
    /** Open and waiting tasks. */
    readonly tasks: ReadonlyArray<AgentTaskRecord>
    /** The triggers. */
    readonly triggers: ReadonlyArray<AgentTriggerRecord>
    /** The last turns. */
    readonly turns: ReadonlyArray<AgentTurnRecord>
    /** Wakes waiting to run. */
    readonly pendingWakes: number
}

/** Counts for the workspace-wide switch. */
export interface WorkspaceAgentWorkView {
    /** The workspace's switch, road and cap. */
    readonly settings: AgentWorkSettingsRecord
    /** Agents whose own switch is off. */
    readonly agentsOff: number
    /** Wakes waiting to run. */
    readonly pendingWakes: number
    /** Wakes held by a switch. */
    readonly heldWakes: number
}

/** The source that woke an agent, or null when the wake is gone (wakes are kept for a while, not for ever). */
export type OptionalWakeSource = AgentWakeSource | null
