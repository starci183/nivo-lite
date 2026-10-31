import type { AgentGoalStatus, AgentTriggerKind, AgentTriggerPreset } from "@modules/domain/agent-work"

/** The states a goal may be written in. */
export const AGENT_GOAL_STATUSES: ReadonlyArray<AgentGoalStatus> = ["active", "paused", "done", "dropped"]

/** The kinds a trigger may be written in. */
export const AGENT_TRIGGER_KINDS: ReadonlyArray<AgentTriggerKind> = ["schedule", "event"]

/** The presets an owner may pick; never free cron. */
export const AGENT_TRIGGER_PRESETS: ReadonlyArray<AgentTriggerPreset> = ["every_15m", "hourly", "daily_at", "weekdays_at"]
