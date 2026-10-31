import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the agent-work capability. */
export enum AgentWorkErrorCode {
    /** A database function answered something the store cannot read. */
    ResultRejected = "AGENT_WORK_RESULT_REJECTED",
    /** The agent is not an agent of the workspace. */
    AgentNotFound = "AGENT_WORK_AGENT_NOT_FOUND",
    /** The goal is not a goal of the agent. */
    GoalNotFound = "AGENT_WORK_GOAL_NOT_FOUND",
    /** The task is not a task of the agent. */
    TaskNotFound = "AGENT_WORK_TASK_NOT_FOUND",
    /** The trigger is not a trigger of the agent. */
    TriggerNotFound = "AGENT_WORK_TRIGGER_NOT_FOUND",
    /** The agent already has the most triggers it may have. */
    TooManyTriggers = "AGENT_WORK_TOO_MANY_TRIGGERS",
    /** The trigger does not say when it fires. */
    TriggerShapeInvalid = "AGENT_WORK_TRIGGER_SHAPE_INVALID",
    /** The time of day is not `HH:MM`. */
    TimeInvalid = "AGENT_WORK_TIME_INVALID",
    /** Two handlers claim the same wake source. */
    HandlerDuplicate = "AGENT_WORK_HANDLER_DUPLICATE",
}

/** How each agent-work code travels. */
export const AGENT_WORK_ERROR_KINDS: Record<AgentWorkErrorCode, ErrorKind> = {
    [AgentWorkErrorCode.ResultRejected]: "internal",
    [AgentWorkErrorCode.AgentNotFound]: "not-found",
    [AgentWorkErrorCode.GoalNotFound]: "not-found",
    [AgentWorkErrorCode.TaskNotFound]: "not-found",
    [AgentWorkErrorCode.TriggerNotFound]: "not-found",
    [AgentWorkErrorCode.TooManyTriggers]: "conflict",
    [AgentWorkErrorCode.TriggerShapeInvalid]: "invalid",
    [AgentWorkErrorCode.TimeInvalid]: "invalid",
    [AgentWorkErrorCode.HandlerDuplicate]: "internal",
}

/** The one error class of the agent-work capability. */
export class AgentWorkError extends DomainError<AgentWorkErrorCode> {}
