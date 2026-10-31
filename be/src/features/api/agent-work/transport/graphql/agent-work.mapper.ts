import type {
    AgentGoalRecord,
    AgentTriggerRecord,
    AgentWorkSettingsRecord,
    AgentWorkState,
    AgentWorkView,
    WorkspaceAgentWorkView,
} from "@modules/domain/agent-work"
import type { CloseAgentTaskRequest } from "../../application/close-agent-task.contracts"
import type { ReadAgentWorkRequest } from "../../application/read-agent-work.contracts"
import type { RemoveAgentTriggerRequest } from "../../application/remove-agent-trigger.contracts"
import type { SaveAgentGoalRequest } from "../../application/save-agent-goal.contracts"
import type { SaveAgentTriggerRequest } from "../../application/save-agent-trigger.contracts"
import type { SetAgentWorkRequest } from "../../application/set-agent-work.contracts"
import type { SetWorkspaceAgentWorkRequest } from "../../application/set-workspace-agent-work.contracts"
import type { AgentGoalType } from "./dto/agent-goal.type"
import type { AgentTriggerType } from "./dto/agent-trigger.type"
import type { AgentWorkAckType } from "./dto/agent-work-ack.type"
import type { AgentWorkInstanceInput } from "./dto/agent-work-instance.input"
import type { AgentWorkStateType } from "./dto/agent-work-state.type"
import type { AgentWorkType } from "./dto/agent-work.type"
import type { CloseAgentTaskInput } from "./dto/close-agent-task.input"
import type { RemoveAgentTriggerInput } from "./dto/remove-agent-trigger.input"
import type { SaveAgentGoalInput } from "./dto/save-agent-goal.input"
import type { SaveAgentTriggerInput } from "./dto/save-agent-trigger.input"
import type { SetAgentWorkInput } from "./dto/set-agent-work.input"
import type { SetWorkspaceAgentWorkInput } from "./dto/set-workspace-agent-work.input"
import type { WorkspaceAgentWorkType } from "./dto/workspace-agent-work.type"

/** Maps the instance of the GraphQL input, with the workspace it names, to the request that reads its Work tab. */
export const toReadAgentWorkRequest = (workspaceId: string, input: AgentWorkInstanceInput): ReadAgentWorkRequest => ({
    workspaceId,
    installationId: input.installationId,
})

/** Maps the switch of the GraphQL input, with the workspace it names, to the request. */
export const toSetAgentWorkRequest = (workspaceId: string, input: SetAgentWorkInput): SetAgentWorkRequest => ({
    workspaceId,
    installationId: input.installationId,
    enabled: input.enabled,
})

/** Maps the workspace switch of the GraphQL input, with the workspace it names, to the request. */
export const toSetWorkspaceAgentWorkRequest = (
    workspaceId: string,
    input: SetWorkspaceAgentWorkInput,
): SetWorkspaceAgentWorkRequest => ({ workspaceId, enabled: input.enabled })

/** Maps the goal of the GraphQL input, with the workspace it names, to the request. */
export const toSaveAgentGoalRequest = (workspaceId: string, input: SaveAgentGoalInput): SaveAgentGoalRequest => ({
    workspaceId,
    installationId: input.installationId,
    goalId: input.goalId,
    title: input.title,
    detail: input.detail,
    status: input.status,
    dueAt: input.dueAt,
})

/** Maps the trigger of the GraphQL input, with the workspace it names, to the request. */
export const toSaveAgentTriggerRequest = (
    workspaceId: string,
    input: SaveAgentTriggerInput,
): SaveAgentTriggerRequest => ({
    workspaceId,
    installationId: input.installationId,
    triggerId: input.triggerId,
    kind: input.kind,
    preset: input.preset,
    atTime: input.atTime,
    timeZone: input.timeZone,
    eventName: input.eventName,
    probeKey: input.probeKey,
    enabled: input.enabled,
})

/** Maps the trigger to remove, with the workspace it names, to the request. */
export const toRemoveAgentTriggerRequest = (
    workspaceId: string,
    input: RemoveAgentTriggerInput,
): RemoveAgentTriggerRequest => ({ workspaceId, installationId: input.installationId, triggerId: input.triggerId })

/** Maps the task to close, with the workspace it names, to the request. */
export const toCloseAgentTaskRequest = (workspaceId: string, input: CloseAgentTaskInput): CloseAgentTaskRequest => ({
    workspaceId,
    installationId: input.installationId,
    taskId: input.taskId,
})

/** The answer of a mutation that returns nothing else. */
export const toAgentWorkAckType = (): AgentWorkAckType => ({ ok: true })

/** Maps the switch of an agent to the GraphQL type. */
export const toAgentWorkStateType = (state: AgentWorkState): AgentWorkStateType => ({ ...state })

/** Maps a goal to the GraphQL type. */
export const toAgentGoalType = (goal: AgentGoalRecord): AgentGoalType => ({ ...goal })

/** Maps a trigger to the GraphQL type. */
export const toAgentTriggerType = (trigger: AgentTriggerRecord): AgentTriggerType => ({ ...trigger })

/** Maps the Work tab of an agent to the GraphQL type. A turn carries usage and ending only, never a prompt, a proposal or a customer's words. */
export const toAgentWorkType = (view: AgentWorkView): AgentWorkType => ({
    state: { ...view.state },
    goals: view.goals.map((goal) => ({ ...goal })),
    tasks: view.tasks.map((task) => ({ ...task })),
    triggers: view.triggers.map((trigger) => ({ ...trigger })),
    turns: view.turns.map((turn) => ({ ...turn })),
    pendingWakes: view.pendingWakes,
})

/** Maps the workspace switch with its counts to the GraphQL type. */
export const toWorkspaceAgentWorkType = (view: WorkspaceAgentWorkView): WorkspaceAgentWorkType => ({
    ...view.settings,
    agentsOff: view.agentsOff,
    pendingWakes: view.pendingWakes,
    heldWakes: view.heldWakes,
})

/** Maps the settings a workspace switch answers to the GraphQL type; the counts are read by the query, not here. */
export const toWorkspaceSwitchType = (settings: AgentWorkSettingsRecord): WorkspaceAgentWorkType => ({
    ...settings,
    agentsOff: 0,
    pendingWakes: 0,
    heldWakes: 0,
})
